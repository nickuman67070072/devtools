'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { createMeetup } from './actions';
import { PlaceAutocomplete, type MeetupPlaceOption } from './place-autocomplete';

export function CreateMeetupForm({ locale }: { locale: Locale }) {
  const th = locale === 'th';
  const [selectedPlace, setSelectedPlace] = useState<MeetupPlaceOption | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const startsAt = String(data.get('startsAt') ?? '');
    const endsAt = String(data.get('endsAt') ?? '');
    if (!selectedPlace) {
      setError(th ? 'เลือกสถานที่ที่อนุมัติแล้วก่อน' : 'Choose an approved place first');
      return;
    }
    setPending(true);
    setError('');
    try {
      const result = await createMeetup({
        title: String(data.get('title') ?? ''),
        description: String(data.get('description') ?? ''),
        rules: String(data.get('rules') ?? ''),
        placeId: selectedPlace.id,
        startsAt: new Date(`${startsAt}:00+07:00`).toISOString(),
        endsAt: new Date(`${endsAt}:00+07:00`).toISOString(),
        maxMembers: Number(data.get('maxMembers')),
      });
      if (!result.ok) {
        setError(
          result.formError ??
            Object.values(result.fieldErrors ?? {})
              .flat()
              .join(', '),
        );
        return;
      }
      const cover = data.get('cover');
      if (cover instanceof File && cover.size) {
        const upload = new FormData();
        upload.set('scope', 'cover');
        upload.set('file', cover);
        const uploaded = await fetch(`/api/meetups/${result.data.id}/upload`, {
          method: 'POST',
          body: upload,
        });
        if (!uploaded.ok)
          toast.error(
            th
              ? 'สร้างกิจกรรมแล้ว แต่รูปปกอัปโหลดไม่สำเร็จ'
              : 'Meetup created, but cover upload failed',
          );
      }
      window.location.href = withLocale(locale, `/meetups/${result.data.id}`);
    } catch {
      setError(th ? 'กรุณาตรวจวันเวลาและลองอีกครั้ง' : 'Check the date and time and try again');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="container-shell max-w-3xl py-10">
      <p className="eyebrow">PawMap Social</p>
      <h1 className="mt-2 text-3xl font-semibold">{th ? 'สร้าง Meetup' : 'Create a Meetup'}</h1>
      <p className="mt-2 text-[var(--text-muted)]">
        {th ? 'เลือกสถานที่ที่ได้รับอนุมัติใน PawMap แล้ว' : 'Choose an approved PawMap place.'}
      </p>
      <div className="mt-7 space-y-3 rounded-2xl border border-[var(--border)] bg-white p-5">
        <PlaceAutocomplete
          id="meetup-place-query"
          locale={locale}
          selectedPlace={selectedPlace}
          onSelect={setSelectedPlace}
          required
        />
        <a
          href={withLocale(locale, '/my-submissions/new')}
          className="text-sm text-[var(--forest)] underline"
        >
          {th
            ? 'ยังไม่มีสถานที่? ส่งสถานที่เข้าระบบก่อน'
            : 'Place missing? Submit it for approval first.'}
        </a>
      </div>
      <form
        className="mt-5 grid gap-5 rounded-2xl border border-[var(--border)] bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
      >
        <label className="grid gap-1 text-sm font-semibold">
          {th ? 'หัวข้อ' : 'Title'}
          <Input name="title" required minLength={5} maxLength={120} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {th ? 'รายละเอียด' : 'Description'}
          <Textarea name="description" required minLength={10} maxLength={4000} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            {th ? 'เวลาเริ่ม (เวลาไทย)' : 'Start (Thailand time)'}
            <Input name="startsAt" type="datetime-local" required />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {th ? 'เวลาจบ (เวลาไทย)' : 'End (Thailand time)'}
            <Input name="endsAt" type="datetime-local" required />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-semibold">
          {th ? 'จำนวนสมาชิกสูงสุด รวม Host' : 'Maximum members, including host'}
          <Input name="maxMembers" type="number" min={2} max={50} defaultValue={8} required />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {th ? 'กฎของ Meetup (ไม่บังคับ)' : 'Meetup rules (optional)'}
          <Textarea name="rules" maxLength={2000} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {th ? 'รูปปก (ไม่บังคับ, สูงสุด 5 MB)' : 'Cover image (optional, max 5 MB)'}
          <Input name="cover" type="file" accept="image/jpeg,image/png,image/webp" />
        </label>
        {error && (
          <p role="alert" className="text-sm text-[var(--terracotta)]">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? (th ? 'กำลังสร้าง…' : 'Creating…') : th ? 'เผยแพร่ Meetup' : 'Publish Meetup'}
        </Button>
      </form>
    </main>
  );
}
