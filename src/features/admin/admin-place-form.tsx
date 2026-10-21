'use client';

import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/field';
import { saveAdminPlace, type AdminPlaceInput } from '@/features/admin/actions';

interface Option {
  code: string;
  label: string;
}

interface InitialPlace {
  id: string;
  version: number;
  nameTh: string;
  nameEn: string;
  descriptionTh: string;
  addressTh: string;
  provinceCode: string;
  categoryCode: string;
  latitude: number;
  longitude: number;
  phone: string;
  website: string;
  status: AdminPlaceInput['status'];
  isVisible: boolean;
}

export function AdminPlaceForm({
  provinces,
  categories,
  initial,
}: {
  provinces: Option[];
  categories: Option[];
  initial?: InitialPlace;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    setPending(true);
    const result = await saveAdminPlace({
      id: initial?.id,
      version: initial?.version,
      nameTh: String(values.get('nameTh') ?? ''),
      nameEn: String(values.get('nameEn') ?? ''),
      descriptionTh: String(values.get('descriptionTh') ?? ''),
      addressTh: String(values.get('addressTh') ?? ''),
      provinceCode: String(values.get('provinceCode') ?? ''),
      categoryCode: String(values.get('categoryCode') ?? ''),
      latitude: String(values.get('latitude') ?? ''),
      longitude: String(values.get('longitude') ?? ''),
      phone: String(values.get('phone') ?? ''),
      website: String(values.get('website') ?? ''),
      status: String(values.get('status')) as AdminPlaceInput['status'],
      isVisible: values.get('isVisible') === 'on',
    });
    setPending(false);
    if (!result.ok) return toast.error(result.formError);
    toast.success(initial ? 'บันทึกและเพิ่ม version แล้ว' : 'สร้างสถานที่แล้ว');
    router.push(`/admin/places/${result.data.id}`);
    router.refresh();
  }

  return (
    <form
      className="surface grid gap-5 p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold">
          ชื่อไทย *
          <Input name="nameTh" required minLength={2} defaultValue={initial?.nameTh} />
        </label>
        <label className="grid gap-1.5 text-sm font-bold">
          ชื่ออังกฤษ
          <Input name="nameEn" defaultValue={initial?.nameEn} />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-bold">
        คำอธิบาย *
        <Textarea
          name="descriptionTh"
          required
          minLength={20}
          maxLength={2000}
          rows={5}
          defaultValue={initial?.descriptionTh}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-bold">
        ที่อยู่ *
        <Textarea
          name="addressTh"
          required
          minLength={5}
          maxLength={500}
          rows={3}
          defaultValue={initial?.addressTh}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold">
          จังหวัด *
          <Select name="provinceCode" required defaultValue={initial?.provinceCode ?? ''}>
            <option value="" disabled>
              เลือกจังหวัด
            </option>
            {provinces.map((province) => (
              <option key={province.code} value={province.code}>
                {province.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm font-bold">
          หมวดหมู่ *
          <Select name="categoryCode" required defaultValue={initial?.categoryCode ?? ''}>
            <option value="" disabled>
              เลือกหมวดหมู่
            </option>
            {categories.map((category) => (
              <option key={category.code} value={category.code}>
                {category.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold">
          Latitude *
          <Input
            name="latitude"
            required
            type="number"
            step="any"
            min="5"
            max="21"
            defaultValue={initial?.latitude}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-bold">
          Longitude *
          <Input
            name="longitude"
            required
            type="number"
            step="any"
            min="97"
            max="106"
            defaultValue={initial?.longitude}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold">
          โทรศัพท์
          <Input name="phone" defaultValue={initial?.phone} />
        </label>
        <label className="grid gap-1.5 text-sm font-bold">
          เว็บไซต์
          <Input name="website" type="url" defaultValue={initial?.website} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold">
          สถานะ
          <Select name="status" defaultValue={String(initial?.status ?? 'VERIFIED')}>
            {['PENDING', 'VERIFIED', 'STALE', 'TEMPORARILY_CLOSED', 'PERMANENTLY_CLOSED'].map(
              (status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ),
            )}
          </Select>
        </label>
        <label className="flex items-center justify-between rounded-2xl border border-[#e7e5df] px-4 text-sm font-bold">
          แสดงต่อสาธารณะ
          <input
            name="isVisible"
            type="checkbox"
            defaultChecked={initial?.isVisible ?? true}
            className="size-5 accent-[#2d5a43]"
          />
        </label>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <Save className="size-4" /> {pending ? 'กำลังบันทึก…' : 'บันทึกสถานที่'}
        </Button>
      </div>
    </form>
  );
}
