'use client';

import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { updateProfile } from '@/features/user/actions';
import type { Locale } from '@/lib/i18n';

export function ProfileForm({
  name,
  email,
  locale,
}: {
  name: string;
  email: string;
  locale: Locale;
}) {
  const router = useRouter();
  const isThai = locale === 'th';
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    setFormError(undefined);
    setFieldErrors({});
    const result = await updateProfile({
      name: String(values.get('name') ?? ''),
      locale: String(values.get('locale') ?? locale) as Locale,
    });
    setPending(false);
    if (!result.ok) {
      setFormError(result.formError);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    setDirty(false);
    toast.success(isThai ? 'บันทึกโปรไฟล์แล้ว' : 'Profile saved');
    router.refresh();
  }

  return (
    <form
      className="mt-6 grid gap-5 border-t border-[#e7e5df] pt-6"
      onSubmit={submit}
      onChange={() => setDirty(true)}
    >
      <div>
        <h3 className="text-xl font-black">{isThai ? 'แก้ไขโปรไฟล์' : 'Edit profile'}</h3>
        <p className="mt-1 text-sm text-[#667b83]">
          {isThai
            ? 'ปรับชื่อที่แสดงและภาษาที่ต้องการใช้'
            : 'Update your display name and preferred language.'}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold">
          {isThai ? 'ชื่อที่แสดง' : 'Display name'}
          <Input
            name="name"
            defaultValue={name}
            required
            minLength={2}
            maxLength={80}
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name?.map((error) => (
            <span key={error} className="text-xs font-semibold text-[#c23934]">
              {error}
            </span>
          ))}
        </label>
        <label className="grid gap-1.5 text-sm font-bold">
          {isThai ? 'ภาษาที่ต้องการ' : 'Preferred language'}
          <Select name="locale" defaultValue={locale}>
            <option value="th">ไทย</option>
            <option value="en">English</option>
          </Select>
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-bold text-[#667b83]">
        {isThai ? 'อีเมล (เปลี่ยนไม่ได้)' : 'Email (read only)'}
        <Input value={email} readOnly disabled />
      </label>
      {formError && (
        <p
          role="alert"
          className="rounded-2xl border border-[#e9b8b5] bg-[#fff1ef] p-4 text-sm font-semibold text-[#c23934]"
        >
          {formError}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending || !dirty}>
          <Save className="size-4" aria-hidden="true" />
          {pending
            ? isThai
              ? 'กำลังบันทึก…'
              : 'Saving…'
            : isThai
              ? 'บันทึกการเปลี่ยนแปลง'
              : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
