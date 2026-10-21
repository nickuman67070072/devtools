'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ImportedPayload } from '@/lib/place-import';
import { categoryDefinitions } from '@/lib/domain';
import { reviewImport } from './import-actions';

export function ImportReviewForm({
  id,
  version,
  initial,
  provinces,
  editable,
}: {
  id: string;
  version: number;
  initial: ImportedPayload;
  provinces: { code: string; nameTh: string }[];
  editable: boolean;
}) {
  const [payload, setPayload] = useState(initial);
  const [reason, setReason] = useState('');
  const [linkPlaceId, setLink] = useState('');
  const [confirmDistinct, setDistinct] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  const fieldClass = 'mt-1 w-full rounded-lg border bg-white p-3';
  const decide = (decision: 'APPROVE' | 'REJECT') => {
    if (
      !window.confirm(
        decision === 'APPROVE'
          ? 'ยืนยันว่าตรวจข้อมูลและต้องการเผยแพร่สถานที่นี้?'
          : 'ยืนยันไม่อนุมัติรายการนี้?',
      )
    )
      return;
    startTransition(async () => {
      const result = await reviewImport({
        id,
        version,
        payload,
        decision,
        reason,
        linkPlaceId: linkPlaceId || undefined,
        confirmDistinct,
      });
      setMessage(result.ok ? 'บันทึกผลแล้ว' : (result.formError ?? 'ข้อมูลไม่ถูกต้อง'));
      if (result.ok) router.refresh();
    });
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        decide('APPROVE');
      }}
      className="space-y-5 rounded-2xl border bg-white p-6"
    >
      <fieldset disabled={busy || !editable} className="grid gap-4 sm:grid-cols-2">
        {(['name', 'nameEn', 'address', 'phone', 'website'] as const).map((key) => (
          <label key={key}>
            {
              {
                name: 'ชื่อสถานที่',
                nameEn: 'ชื่ออังกฤษ (ถ้ามี)',
                address: 'ที่อยู่',
                phone: 'โทรศัพท์',
                website: 'เว็บไซต์',
              }[key]
            }
            <input
              className={fieldClass}
              value={payload[key]}
              onChange={(event) => setPayload({ ...payload, [key]: event.target.value })}
            />
          </label>
        ))}
        <label>
          จังหวัด
          <select
            className={fieldClass}
            value={payload.provinceCode ?? ''}
            onChange={(event) =>
              setPayload({ ...payload, provinceCode: event.target.value || null })
            }
          >
            <option value="">กรุณาตรวจจังหวัด</option>
            {provinces.map((province) => (
              <option key={province.code} value={province.code}>
                {province.nameTh}
              </option>
            ))}
          </select>
        </label>
        {(['latitude', 'longitude'] as const).map((key) => (
          <label key={key}>
            {key === 'latitude' ? 'ละติจูด' : 'ลองจิจูด'}
            <input
              type="number"
              step="any"
              required
              className={fieldClass}
              value={payload[key]}
              onChange={(event) => setPayload({ ...payload, [key]: Number(event.target.value) })}
            />
          </label>
        ))}
        <label className="sm:col-span-2">
          รายละเอียดที่ตรวจสอบแล้ว
          <textarea
            rows={5}
            className={fieldClass}
            value={payload.description}
            onChange={(event) => setPayload({ ...payload, description: event.target.value })}
          />
        </label>
        <fieldset className="sm:col-span-2">
          <legend>หมวดหมู่ (รายการแรกเป็นหมวดหลัก)</legend>
          <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
            {categoryDefinitions.map((category) => (
              <label key={category.code} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={payload.categoryCodes.includes(category.code)}
                  onChange={(event) =>
                    setPayload({
                      ...payload,
                      categoryCodes: event.target.checked
                        ? [...payload.categoryCodes, category.code]
                        : payload.categoryCodes.filter((code) => code !== category.code),
                    })
                  }
                />
                {category.nameTh}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="sm:col-span-2">
          เชื่อมกับ ID สถานที่เดิม (ไม่เขียนทับข้อมูลเดิม)
          <input
            className={fieldClass}
            value={linkPlaceId}
            onChange={(event) => setLink(event.target.value.trim())}
          />
        </label>
        <label className="sm:col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={confirmDistinct}
            onChange={(event) => setDistinct(event.target.checked)}
          />
          ตรวจแล้วว่าเป็นคนละสถานที่ แม้ชื่อและพิกัดใกล้เคียง
        </label>
        <label className="sm:col-span-2">
          หมายเหตุ / เหตุผลที่ไม่อนุมัติ
          <textarea
            className={fieldClass}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <div className="flex gap-3 sm:col-span-2">
          <button type="submit" className="rounded-lg bg-[var(--forest)] px-4 py-3 text-white">
            {busy ? 'กำลังบันทึก…' : 'อนุมัติและเผยแพร่'}
          </button>
          <button
            type="button"
            className="rounded-lg border px-4 py-3"
            onClick={() => decide('REJECT')}
          >
            ไม่อนุมัติ
          </button>
        </div>
      </fieldset>
      <p role="status">{message}</p>
    </form>
  );
}
