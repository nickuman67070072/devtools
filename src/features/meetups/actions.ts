'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getCurrentSession } from '@/lib/auth-guards';
import type { ActionResult } from '@/lib/action-result';
import { deleteObject } from '@/lib/object-storage';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit } from '@/lib/rate-limit';
import { createMeetupSchema, canWriteMeetupChat, canAccessMeetupChat } from './service';
import { notifyMeetupChat } from './chat-notifications';

async function actor() {
  const session = await getCurrentSession();
  if (!session || session.user.suspendedAt) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, name: true, suspendedAt: true, deletedAt: true },
  });
  return user && !user.suspendedAt && !user.deletedAt ? user : null;
}

function refreshMeetup(id?: string) {
  revalidatePath('/meetups');
  revalidatePath('/en/meetups');
  revalidatePath('/my-meetups');
  revalidatePath('/en/my-meetups');
  if (id) {
    revalidatePath(`/meetups/${id}`);
    revalidatePath(`/en/meetups/${id}`);
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.startsWith('MEETUP_')) return error.message;
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}

async function notify(
  tx: Prisma.TransactionClient,
  userIds: string[],
  meetupId: string,
  titleTh: string,
  titleEn: string,
  bodyTh: string,
  bodyEn: string,
) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  await tx.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: 'MEETUP',
      titleTh,
      titleEn,
      bodyTh,
      bodyEn,
      link: `/meetups/${meetupId}`,
    })),
  });
}

export async function createMeetup(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'กรุณาเข้าสู่ระบบ' };
  const parsed = createMeetupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const value = parsed.data;
  const startsAt = new Date(value.startsAt);
  const endsAt = new Date(value.endsAt);
  if (startsAt <= new Date() || endsAt <= startsAt)
    return { ok: false, formError: 'วันและเวลาต้องอยู่ในอนาคต และเวลาจบต้องหลังเวลาเริ่ม' };
  const place = await prisma.place.findFirst({
    where: { id: value.placeId, status: 'VERIFIED', isVisible: true, deletedAt: null },
    select: { id: true },
  });
  if (!place) return { ok: false, formError: 'เลือกสถานที่ที่อนุมัติแล้วเท่านั้น' };
  const limit = await consumeRateLimit({
    key: user.id,
    action: 'create-meetup',
    limit: 5,
    windowMs: 86_400_000,
  });
  if (!limit.allowed) return { ok: false, formError: 'สร้าง Meetup ได้สูงสุด 5 ครั้งต่อวัน' };
  const meetup = await prisma.meetup.create({
    data: {
      title: value.title,
      description: value.description,
      rules: value.rules || null,
      startsAt,
      endsAt,
      maxMembers: value.maxMembers,
      hostId: user.id,
      placeId: place.id,
      members: { create: { userId: user.id } },
      messages: { create: { kind: 'SYSTEM', text: `${user.name} created the Meetup.` } },
    },
    select: { id: true },
  });
  refreshMeetup(meetup.id);
  return { ok: true, data: meetup };
}

export async function joinMeetup(id: string): Promise<ActionResult> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'MEETUP_LOGIN_REQUIRED' };
  if (user.role === 'ADMIN') return { ok: false, formError: 'MEETUP_ADMIN_CANNOT_JOIN' };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const meetup = await tx.meetup.findFirst({
            where: { id, deletedAt: null },
            include: {
              place: { select: { status: true, isVisible: true, deletedAt: true } },
              bans: { where: { userId: user.id } },
              members: { where: { state: 'ACTIVE' }, select: { userId: true } },
            },
          });
          if (!meetup) throw new Error('MEETUP_NOT_FOUND');
          if (
            meetup.place.status !== 'VERIFIED' ||
            !meetup.place.isVisible ||
            meetup.place.deletedAt
          )
            throw new Error('MEETUP_PLACE_UNAVAILABLE');
          if (meetup.status !== 'OPEN' || meetup.startsAt <= new Date())
            throw new Error('MEETUP_NOT_OPEN');
          if (meetup.bans.length) throw new Error('MEETUP_BANNED');
          if (meetup.members.some((member) => member.userId === user.id))
            throw new Error('MEETUP_ALREADY_JOINED');
          if (meetup.members.length >= meetup.maxMembers) throw new Error('MEETUP_FULL');
          const existing = await tx.meetupJoinRequest.findUnique({
            where: { meetupId_userId: { meetupId: id, userId: user.id } },
          });
          if (existing?.status === 'PENDING') throw new Error('MEETUP_REQUEST_PENDING');
          const limit = await consumeRateLimit({
            key: user.id,
            action: 'meetup-join-request',
            limit: 3,
            windowMs: 86_400_000,
            client: tx,
          });
          if (!limit.allowed) throw new Error('MEETUP_REQUEST_RATE_LIMITED');
          await tx.meetupJoinRequest.upsert({
            where: { meetupId_userId: { meetupId: id, userId: user.id } },
            create: { meetupId: id, userId: user.id },
            update: { status: 'PENDING', decidedAt: null, createdAt: new Date() },
          });
          await notify(
            tx,
            [meetup.hostId],
            id,
            'มีคำขอเข้าร่วม Meetup',
            'New Meetup join request',
            `${user.name} ขอเข้าร่วมกิจกรรมของคุณ`,
            `${user.name} requested to join your Meetup`,
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      refreshMeetup(id);
      return { ok: true, data: undefined };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 2
      )
        continue;
      return { ok: false, formError: errorMessage(error) };
    }
  }
  return { ok: false, formError: 'MEETUP_REQUEST_CONFLICT' };
}

export async function cancelMeetupJoinRequest(id: string): Promise<ActionResult> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'MEETUP_LOGIN_REQUIRED' };
  const result = await prisma.meetupJoinRequest.updateMany({
    where: { meetupId: id, userId: user.id, status: 'PENDING' },
    data: { status: 'CANCELLED', decidedAt: new Date() },
  });
  if (!result.count) return { ok: false, formError: 'MEETUP_REQUEST_NOT_FOUND' };
  refreshMeetup(id);
  return { ok: true, data: undefined };
}

export async function decideMeetupJoinRequest(
  id: string,
  requestId: string,
  decision: 'APPROVED' | 'DECLINED',
): Promise<ActionResult> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'MEETUP_LOGIN_REQUIRED' };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const meetup = await tx.meetup.findFirst({
            where: { id, deletedAt: null },
            include: { place: { select: { status: true, isVisible: true, deletedAt: true } } },
          });
          if (!meetup || meetup.hostId !== user.id) throw new Error('MEETUP_FORBIDDEN');
          const request = await tx.meetupJoinRequest.findFirst({
            where: { id: requestId, meetupId: id, status: 'PENDING' },
            include: { user: { select: { name: true, suspendedAt: true, deletedAt: true } } },
          });
          if (!request) throw new Error('MEETUP_REQUEST_NOT_FOUND');
          if (meetup.startsAt <= new Date() || ['CANCELLED', 'COMPLETED'].includes(meetup.status))
            throw new Error('MEETUP_NOT_OPEN');
          if (decision === 'APPROVED') {
            if (request.user.suspendedAt || request.user.deletedAt)
              throw new Error('MEETUP_USER_UNAVAILABLE');
            if (
              meetup.place.status !== 'VERIFIED' ||
              !meetup.place.isVisible ||
              meetup.place.deletedAt
            )
              throw new Error('MEETUP_PLACE_UNAVAILABLE');
            const banned = await tx.meetupBan.findUnique({
              where: { meetupId_userId: { meetupId: id, userId: request.userId } },
            });
            if (banned) throw new Error('MEETUP_BANNED');
            const count = await tx.meetupMember.count({ where: { meetupId: id, state: 'ACTIVE' } });
            if (count >= meetup.maxMembers) throw new Error('MEETUP_FULL');
            await tx.meetupMember.upsert({
              where: { meetupId_userId: { meetupId: id, userId: request.userId } },
              create: { meetupId: id, userId: request.userId },
              update: { state: 'ACTIVE', joinedAt: new Date(), leftAt: null },
            });
          }
          const updated = await tx.meetupJoinRequest.updateMany({
            where: { id: requestId, meetupId: id, status: 'PENDING' },
            data: { status: decision, decidedAt: new Date() },
          });
          if (!updated.count) throw new Error('MEETUP_REQUEST_NOT_FOUND');
          if (decision === 'APPROVED')
            await tx.meetupMessage.create({
              data: {
                meetupId: id,
                kind: 'SYSTEM',
                text: `${request.user.name} joined the Meetup.`,
              },
            });
          await notify(
            tx,
            [request.userId],
            id,
            decision === 'APPROVED' ? 'คำขอเข้าร่วมได้รับอนุมัติ' : 'คำขอเข้าร่วมไม่ผ่านการอนุมัติ',
            decision === 'APPROVED' ? 'Meetup request approved' : 'Meetup request declined',
            decision === 'APPROVED' ? 'คุณสามารถเข้าแชตกลุ่มได้แล้ว' : 'Host ไม่อนุมัติคำขอของคุณ',
            decision === 'APPROVED'
              ? 'You can now open the group chat'
              : 'The host declined your request',
          );
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: `MEETUP_JOIN_${decision}`,
              entityType: 'Meetup',
              entityId: id,
              newValue: { requestId, userId: request.userId },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      refreshMeetup(id);
      return { ok: true, data: undefined };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 2
      )
        continue;
      return { ok: false, formError: errorMessage(error) };
    }
  }
  return { ok: false, formError: 'MEETUP_REQUEST_CONFLICT' };
}

export async function leaveMeetup(id: string): Promise<ActionResult> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'กรุณาเข้าสู่ระบบ' };
  try {
    await prisma.$transaction(async (tx) => {
      const meetup = await tx.meetup.findFirst({ where: { id, deletedAt: null } });
      if (!meetup) throw new Error('MEETUP_NOT_FOUND');
      if (meetup.hostId === user.id) throw new Error('MEETUP_TRANSFER_HOST_FIRST');
      const updated = await tx.meetupMember.updateMany({
        where: { meetupId: id, userId: user.id, state: 'ACTIVE' },
        data: { state: 'LEFT', leftAt: new Date() },
      });
      if (!updated.count) throw new Error('MEETUP_NOT_MEMBER');
      await tx.meetupMessage.create({
        data: { meetupId: id, kind: 'SYSTEM', text: `${user.name} left the Meetup.` },
      });
      await notify(
        tx,
        [meetup.hostId],
        id,
        'สมาชิกออกจาก Meetup',
        'A member left your Meetup',
        `${user.name} ออกจากกิจกรรม`,
        `${user.name} left`,
      );
    });
    refreshMeetup(id);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, formError: errorMessage(error) };
  }
}

export async function transferMeetupHost(id: string, nextHostId: string): Promise<ActionResult> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'กรุณาเข้าสู่ระบบ' };
  try {
    await prisma.$transaction(async (tx) => {
      const meetup = await tx.meetup.findFirst({
        where: { id, deletedAt: null },
        select: { hostId: true },
      });
      if (!meetup || (meetup.hostId !== user.id && user.role !== 'ADMIN'))
        throw new Error('MEETUP_FORBIDDEN');
      if (nextHostId === meetup.hostId) throw new Error('MEETUP_SAME_HOST');
      const candidate = await tx.meetupMember.findFirst({
        where: {
          meetupId: id,
          userId: nextHostId,
          state: 'ACTIVE',
          user: { suspendedAt: null, deletedAt: null },
        },
      });
      if (!candidate) throw new Error('MEETUP_NEW_HOST_NOT_MEMBER');
      await tx.meetup.update({
        where: { id },
        data: { hostId: nextHostId, version: { increment: 1 } },
      });
      await tx.meetupMessage.create({
        data: { meetupId: id, kind: 'SYSTEM', text: 'Meetup host changed.' },
      });
      await notify(
        tx,
        [nextHostId],
        id,
        'คุณเป็นหัวกลุ่ม Meetup',
        'You are the Meetup host',
        'หัวกลุ่มเดิมโอนสิทธิ์ให้คุณแล้ว',
        'The previous host transferred ownership to you',
      );
    });
    refreshMeetup(id);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, formError: errorMessage(error) };
  }
}

export async function setMeetupClosed(id: string, closed: boolean): Promise<ActionResult> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'กรุณาเข้าสู่ระบบ' };
  const updated = await prisma.meetup.updateMany({
    where: {
      id,
      deletedAt: null,
      startsAt: { gt: new Date() },
      status: closed ? 'OPEN' : 'CLOSED',
      ...(user.role === 'ADMIN' ? {} : { hostId: user.id }),
    },
    data: { status: closed ? 'CLOSED' : 'OPEN', version: { increment: 1 } },
  });
  if (!updated.count) return { ok: false, formError: 'MEETUP_FORBIDDEN_OR_NOT_OPEN' };
  refreshMeetup(id);
  return { ok: true, data: undefined };
}

export async function cancelMeetup(id: string): Promise<ActionResult> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'กรุณาเข้าสู่ระบบ' };
  try {
    await prisma.$transaction(async (tx) => {
      const meetup = await tx.meetup.findFirst({
        where: { id, deletedAt: null },
        include: { members: { where: { state: 'ACTIVE' }, select: { userId: true } } },
      });
      if (!meetup || (meetup.hostId !== user.id && user.role !== 'ADMIN'))
        throw new Error('MEETUP_FORBIDDEN');
      if (['CANCELLED', 'COMPLETED'].includes(meetup.status) || meetup.endsAt <= new Date())
        throw new Error('MEETUP_ALREADY_ENDED');
      await tx.meetup.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), version: { increment: 1 } },
      });
      await tx.meetupJoinRequest.updateMany({
        where: { meetupId: id, status: 'PENDING' },
        data: { status: 'EXPIRED', decidedAt: new Date() },
      });
      await tx.meetupMessage.create({
        data: { meetupId: id, kind: 'SYSTEM', text: 'This Meetup has been cancelled.' },
      });
      await notify(
        tx,
        meetup.members.map((member) => member.userId).filter((memberId) => memberId !== user.id),
        id,
        'Meetup ถูกยกเลิก',
        'Meetup cancelled',
        'กิจกรรมที่คุณเข้าร่วมถูกยกเลิก',
        'A Meetup you joined was cancelled',
      );
    });
    refreshMeetup(id);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, formError: errorMessage(error) };
  }
}

export async function updateMeetup(
  id: string,
  version: number,
  input: unknown,
): Promise<ActionResult> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'กรุณาเข้าสู่ระบบ' };
  const parsed = createMeetupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const value = parsed.data;
  const startsAt = new Date(value.startsAt);
  const endsAt = new Date(value.endsAt);
  if (startsAt <= new Date() || endsAt <= startsAt)
    return { ok: false, formError: 'เวลาของกิจกรรมไม่ถูกต้อง' };
  try {
    await prisma.$transaction(async (tx) => {
      const meetup = await tx.meetup.findFirst({
        where: { id, deletedAt: null },
        include: { members: { where: { state: 'ACTIVE' }, select: { userId: true } } },
      });
      if (!meetup || (meetup.hostId !== user.id && user.role !== 'ADMIN'))
        throw new Error('MEETUP_FORBIDDEN');
      if (meetup.startsAt <= new Date() || meetup.status === 'CANCELLED')
        throw new Error('MEETUP_NOT_EDITABLE');
      const place = await tx.place.findFirst({
        where: { id: value.placeId, status: 'VERIFIED', isVisible: true, deletedAt: null },
      });
      if (!place) throw new Error('MEETUP_PLACE_UNAVAILABLE');
      const count = await tx.meetupMember.count({ where: { meetupId: id, state: 'ACTIVE' } });
      if (value.maxMembers < count) throw new Error('MEETUP_CAPACITY_TOO_SMALL');
      const changedSchedule =
        meetup.startsAt.getTime() !== startsAt.getTime() ||
        meetup.endsAt.getTime() !== endsAt.getTime();
      const changedPlace = meetup.placeId !== value.placeId;
      const updated = await tx.meetup.updateMany({
        where: { id, version, deletedAt: null },
        data: {
          title: value.title,
          description: value.description,
          rules: value.rules || null,
          startsAt,
          endsAt,
          maxMembers: value.maxMembers,
          placeId: value.placeId,
          reminderSentAt: changedSchedule ? null : meetup.reminderSentAt,
          version: { increment: 1 },
        },
      });
      if (!updated.count) throw new Error('MEETUP_VERSION_CONFLICT');
      if (changedSchedule || changedPlace) {
        await tx.meetupMessage.create({
          data: {
            meetupId: id,
            kind: 'SYSTEM',
            text: changedPlace ? 'Meetup location changed.' : 'Meetup time changed.',
          },
        });
        await notify(
          tx,
          meetup.members.map((member) => member.userId).filter((memberId) => memberId !== user.id),
          id,
          'รายละเอียด Meetup เปลี่ยนแปลง',
          'Meetup details changed',
          changedPlace ? 'หัวกลุ่มเปลี่ยนสถานที่นัดพบ' : 'หัวกลุ่มเปลี่ยนเวลานัดพบ',
          changedPlace ? 'The host changed the meeting place' : 'The host changed the meeting time',
        );
      }
    });
    refreshMeetup(id);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, formError: errorMessage(error) };
  }
}

export async function moderateMeetupMember(
  id: string,
  targetUserId: string,
  mode: 'KICK' | 'BAN',
  successorId?: string,
): Promise<ActionResult> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'กรุณาเข้าสู่ระบบ' };
  try {
    await prisma.$transaction(async (tx) => {
      const meetup = await tx.meetup.findFirst({ where: { id, deletedAt: null } });
      if (!meetup || (meetup.hostId !== user.id && user.role !== 'ADMIN'))
        throw new Error('MEETUP_FORBIDDEN');
      if (targetUserId === user.id) throw new Error('MEETUP_CANNOT_REMOVE_SELF');
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { role: true, name: true },
      });
      if (!target) throw new Error('MEETUP_USER_NOT_FOUND');
      if (target.role === 'ADMIN') throw new Error('MEETUP_ADMIN_PROTECTED');
      if (targetUserId === meetup.hostId) {
        if (user.role !== 'ADMIN' || !successorId) throw new Error('MEETUP_SUCCESSOR_REQUIRED');
        const successor = await tx.meetupMember.findFirst({
          where: {
            meetupId: id,
            userId: successorId,
            state: 'ACTIVE',
            user: { suspendedAt: null, deletedAt: null },
          },
        });
        if (!successor || successorId === targetUserId)
          throw new Error('MEETUP_NEW_HOST_NOT_MEMBER');
        await tx.meetup.update({
          where: { id },
          data: { hostId: successorId, version: { increment: 1 } },
        });
      }
      const result = await tx.meetupMember.updateMany({
        where: { meetupId: id, userId: targetUserId, state: 'ACTIVE' },
        data: { state: 'KICKED', leftAt: new Date() },
      });
      if (!result.count) throw new Error('MEETUP_NOT_MEMBER');
      if (mode === 'BAN')
        await tx.meetupBan.upsert({
          where: { meetupId_userId: { meetupId: id, userId: targetUserId } },
          create: { meetupId: id, userId: targetUserId },
          update: {},
        });
      await tx.meetupMessage.create({
        data: {
          meetupId: id,
          kind: 'SYSTEM',
          text: `${target.name} was ${mode === 'BAN' ? 'banned' : 'removed'} from the Meetup.`,
        },
      });
      await notify(
        tx,
        [targetUserId],
        id,
        mode === 'BAN' ? 'คุณถูกแบนจาก Meetup' : 'คุณถูกนำออกจาก Meetup',
        mode === 'BAN' ? 'You were banned from a Meetup' : 'You were removed from a Meetup',
        'คุณไม่สามารถเข้าถึงห้องแชตนี้ได้แล้ว',
        'You can no longer access this chat',
      );
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: `MEETUP_${mode}`,
          entityType: 'Meetup',
          entityId: id,
          newValue: { targetUserId, successorId },
        },
      });
    });
    refreshMeetup(id);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, formError: errorMessage(error) };
  }
}

export async function sendMeetupMessage(
  id: string,
  text: string,
  replyToId?: string,
  important = false,
): Promise<ActionResult<{ id: string }>> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'กรุณาเข้าสู่ระบบ' };
  const content = z.string().trim().min(1).max(2000).safeParse(text);
  if (!content.success) return { ok: false, formError: 'ข้อความต้องยาว 1–2,000 ตัวอักษร' };
  const meetup = await prisma.meetup.findFirst({
    where: { id, deletedAt: null },
    include: { members: { where: { state: 'ACTIVE' }, select: { userId: true } } },
  });
  if (!meetup) return { ok: false, formError: 'MEETUP_NOT_FOUND' };
  if (user.role !== 'ADMIN' && !meetup.members.some((member) => member.userId === user.id))
    return { ok: false, formError: 'MEETUP_FORBIDDEN' };
  if (!canWriteMeetupChat(meetup.status, meetup.endsAt))
    return { ok: false, formError: 'MEETUP_CHAT_READ_ONLY' };
  if (important && meetup.hostId !== user.id && user.role !== 'ADMIN')
    return { ok: false, formError: 'MEETUP_FORBIDDEN' };
  if (replyToId) {
    const reply = await prisma.meetupMessage.findFirst({
      where: { id: replyToId, meetupId: id, deletedAt: null },
    });
    if (!reply) return { ok: false, formError: 'MEETUP_REPLY_NOT_FOUND' };
  }
  const limit = await consumeRateLimit({
    key: user.id,
    action: 'meetup-message',
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) return { ok: false, formError: 'ส่งข้อความเร็วเกินไป กรุณารอสักครู่' };
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.meetupMessage.create({
      data: {
        meetupId: id,
        authorId: user.id,
        kind: 'TEXT',
        text: content.data,
        replyToId,
        pinnedAt: important ? new Date() : null,
      },
      select: { id: true },
    });
    await notifyMeetupChat(
      tx,
      id,
      user.id,
      user.name,
      meetup.members.map((member) => member.userId),
      important,
    );
    return created;
  });
  return { ok: true, data: message };
}

export async function markMeetupChatRead(id: string): Promise<ActionResult> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'MEETUP_LOGIN_REQUIRED' };
  if (!(await canAccessMeetupChat(id, user.id, user.role === 'ADMIN')))
    return { ok: false, formError: 'MEETUP_FORBIDDEN' };
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null, link: `/meetups/${id}/chat` },
    data: { readAt: new Date() },
  });
  revalidatePath('/notifications');
  return { ok: true, data: undefined };
}

export async function deleteMeetupMessage(id: string, messageId: string): Promise<ActionResult> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'กรุณาเข้าสู่ระบบ' };
  const message = await prisma.meetupMessage.findFirst({
    where: { id: messageId, meetupId: id, deletedAt: null },
    include: { meetup: true },
  });
  if (
    !message ||
    (message.authorId !== user.id && message.meetup.hostId !== user.id && user.role !== 'ADMIN')
  )
    return { ok: false, formError: 'MEETUP_FORBIDDEN' };
  await prisma.meetupMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), text: null, pinnedAt: null },
  });
  if (message.objectKey) await deleteObject(message.objectKey).catch(() => undefined);
  return { ok: true, data: undefined };
}

export async function pinMeetupMessage(
  id: string,
  messageId: string,
  pinned: boolean,
): Promise<ActionResult> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'กรุณาเข้าสู่ระบบ' };
  const meetup = await prisma.meetup.findFirst({ where: { id, deletedAt: null } });
  if (!meetup || (meetup.hostId !== user.id && user.role !== 'ADMIN'))
    return { ok: false, formError: 'MEETUP_FORBIDDEN' };
  const updated = await prisma.meetupMessage.updateMany({
    where: { id: messageId, meetupId: id, deletedAt: null },
    data: { pinnedAt: pinned ? new Date() : null },
  });
  return updated.count
    ? { ok: true, data: undefined }
    : { ok: false, formError: 'MEETUP_MESSAGE_NOT_FOUND' };
}

const reportSchema = z.object({
  target: z.enum(['MEETUP', 'USER', 'MESSAGE', 'IMAGE']),
  targetId: z.string().min(1),
  reason: z.enum([
    'SPAM',
    'HARASSMENT',
    'INAPPROPRIATE_CONTENT',
    'SCAM',
    'FAKE_MEETUP',
    'DANGEROUS_BEHAVIOR',
    'OTHER',
  ]),
  details: z.string().trim().max(1000).optional(),
});

export async function reportMeetup(id: string, input: unknown): Promise<ActionResult> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'กรุณาเข้าสู่ระบบ' };
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const { target, targetId, reason, details } = parsed.data;
  const meetup = await prisma.meetup.findFirst({
    where: { id, deletedAt: null },
    include: { members: { where: { userId: user.id, state: 'ACTIVE' } } },
  });
  if (!meetup) return { ok: false, formError: 'MEETUP_NOT_FOUND' };
  if (target === 'MEETUP' && targetId !== id)
    return { ok: false, formError: 'MEETUP_INVALID_TARGET' };
  const publicCover = target === 'IMAGE' && meetup.coverObjectKey === targetId;
  if (target !== 'MEETUP' && !publicCover && !meetup.members.length && user.role !== 'ADMIN')
    return { ok: false, formError: 'MEETUP_FORBIDDEN' };
  if (
    target === 'USER' &&
    !(await prisma.meetupMember.findFirst({ where: { meetupId: id, userId: targetId } }))
  )
    return { ok: false, formError: 'MEETUP_INVALID_TARGET' };
  if (
    target === 'MESSAGE' &&
    !(await prisma.meetupMessage.findFirst({ where: { meetupId: id, id: targetId } }))
  )
    return { ok: false, formError: 'MEETUP_INVALID_TARGET' };
  if (
    target === 'IMAGE' &&
    meetup.coverObjectKey !== targetId &&
    !(await prisma.meetupMessage.findFirst({ where: { meetupId: id, objectKey: targetId } }))
  )
    return { ok: false, formError: 'MEETUP_INVALID_TARGET' };
  const limit = await consumeRateLimit({
    key: user.id,
    action: 'meetup-report',
    limit: 10,
    windowMs: 86_400_000,
  });
  if (!limit.allowed) return { ok: false, formError: 'ส่งรายงานมากเกินไปในวันนี้' };
  await prisma.meetupReport.create({
    data: { meetupId: id, reporterId: user.id, target, targetId, reason, details },
  });
  return { ok: true, data: undefined };
}

export async function setUserBlocked(blockedId: string, blocked: boolean): Promise<ActionResult> {
  const user = await actor();
  if (!user) return { ok: false, formError: 'กรุณาเข้าสู่ระบบ' };
  if (blockedId === user.id) return { ok: false, formError: 'ไม่สามารถบล็อกตัวเองได้' };
  const target = await prisma.user.findFirst({
    where: { id: blockedId, deletedAt: null },
    select: { id: true },
  });
  if (!target) return { ok: false, formError: 'ไม่พบผู้ใช้' };
  if (blocked)
    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
      create: { blockerId: user.id, blockedId },
      update: {},
    });
  else await prisma.userBlock.deleteMany({ where: { blockerId: user.id, blockedId } });
  return { ok: true, data: undefined };
}

export async function resolveMeetupReport(
  reportId: string,
  dismissed: boolean,
): Promise<ActionResult> {
  const user = await actor();
  if (user?.role !== 'ADMIN') return { ok: false, formError: 'MEETUP_FORBIDDEN' };
  const updated = await prisma.meetupReport.updateMany({
    where: { id: reportId, status: { in: ['OPEN', 'IN_REVIEW'] } },
    data: { status: dismissed ? 'DISMISSED' : 'RESOLVED', resolvedAt: new Date() },
  });
  if (!updated.count) return { ok: false, formError: 'MEETUP_REPORT_NOT_FOUND' };
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: dismissed ? 'DISMISS_MEETUP_REPORT' : 'RESOLVE_MEETUP_REPORT',
      entityType: 'MeetupReport',
      entityId: reportId,
    },
  });
  revalidatePath('/admin/meetup-reports');
  return { ok: true, data: undefined };
}

export async function deleteMeetupAsAdmin(id: string): Promise<ActionResult> {
  const user = await actor();
  if (user?.role !== 'ADMIN') return { ok: false, formError: 'MEETUP_FORBIDDEN' };
  const updated = await prisma.meetup.updateMany({
    where: { id, deletedAt: null },
    data: {
      deletedAt: new Date(),
      status: 'CANCELLED',
      cancelledAt: new Date(),
      version: { increment: 1 },
    },
  });
  if (!updated.count) return { ok: false, formError: 'MEETUP_NOT_FOUND' };
  await prisma.meetupJoinRequest.updateMany({
    where: { meetupId: id, status: 'PENDING' },
    data: { status: 'EXPIRED', decidedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: 'DELETE_MEETUP', entityType: 'Meetup', entityId: id },
  });
  refreshMeetup(id);
  revalidatePath('/admin/meetups');
  return { ok: true, data: undefined };
}
