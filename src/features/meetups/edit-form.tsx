'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { updateMeetup } from './actions';
import { PlaceAutocomplete, type MeetupPlaceOption } from './place-autocomplete';

interface Existing {
  id: string;
  version: number;
  title: string;
  description: string;
  rules: string;
  place: MeetupPlaceOption;
  startsAt: string;
  endsAt: string;
  maxMembers: number;
}

function bangkokInput(iso: string) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (key: string) => parts.find((part) => part.type === key)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
}

export function EditMeetupForm({ locale, meetup }: { locale: Locale; meetup: Existing }) {
  const th = locale === 'th';
  const [place, setPlace] = useState<MeetupPlaceOption | null>(meetup.place);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(form: HTMLFormElement) {
    if (!place) {
      setError(th ? 'เลือกสถานที่ที่อนุมัติแล้วก่อน' : 'Choose an approved place first');
      return;
    }
    const data = new FormData(form);
    setPending(true);
    setError('');
    try {
      const result = await updateMeetup(meetup.id, meetup.version, {
        title: String(data.get('title')),
        description: String(data.get('description')),
        rules: String(data.get('rules')),
        placeId: place.id,
        startsAt: new Date(`${String(data.get('startsAt'))}:00+07:00`).toISOString(),
        endsAt: new Date(`${String(data.get('endsAt'))}:00+07:00`).toISOString(),
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
      window.location.href = withLocale(locale, `/meetups/${meetup.id}`);
    } catch {
      setError(th ? 'กรุณาตรวจข้อมูลและลองอีกครั้ง' : 'Check the form and try again');
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="container-shell max-w-3xl py-10">
      <h1 className="text-3xl font-semibold">{th ? 'แก้ไข Meetup' : 'Edit Meetup'}</h1>
      <form
        className="mt-6 grid gap-4 rounded-2xl border bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
      >
        <label className="grid gap-1 text-sm font-semibold">
          {th ? 'หัวข้อ' : 'Title'}
          <Input name="title" defaultValue={meetup.title} required minLength={5} maxLength={120} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {th ? 'รายละเอียด' : 'Description'}
          <Textarea
            name="description"
            defaultValue={meetup.description}
            required
            minLength={10}
            maxLength={4000}
          />
        </label>
        <div className="rounded-xl border p-3">
          <PlaceAutocomplete
            id="meetup-place-edit"
            locale={locale}
            label={th ? 'ค้นหาสถานที่ใหม่' : 'Find another place'}
            selectedPlace={place}
            onSelect={setPlace}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            {th ? 'เวลาเริ่ม (เวลาไทย)' : 'Start (Thailand time)'}
            <Input
              name="startsAt"
              type="datetime-local"
              defaultValue={bangkokInput(meetup.startsAt)}
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {th ? 'เวลาจบ (เวลาไทย)' : 'End (Thailand time)'}
            <Input
              name="endsAt"
              type="datetime-local"
              defaultValue={bangkokInput(meetup.endsAt)}
              required
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-semibold">
          {th ? 'จำนวนสมาชิกสูงสุด' : 'Maximum members'}
          <Input
            name="maxMembers"
            type="number"
            min={2}
            max={50}
            defaultValue={meetup.maxMembers}
            required
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {th ? 'กฎ' : 'Rules'}
          <Textarea name="rules" defaultValue={meetup.rules} maxLength={2000} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-[var(--terracotta)]">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? (th ? 'กำลังบันทึก…' : 'Saving…') : th ? 'บันทึก' : 'Save'}
        </Button>
      </form>
    </main>
  );
}
