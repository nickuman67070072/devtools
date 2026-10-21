'use client';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  MapPin,
  Save,
  Search,
  UploadCloud,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';

import { useBrandLoading } from '@/components/brand-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/field';
import { saveSubmission, type SubmissionInput } from '@/features/submissions/actions';
import { categoryDefinitions, type DistrictSummary, type ProvinceSummary } from '@/lib/domain';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';

interface UploadedImage {
  objectKey: string;
  mediaUrl: string;
  name: string;
}

export interface SubmissionFormInitial {
  id: string;
  kind: 'CREATE' | 'UPDATE';
  targetPlaceId?: string;
  nameTh: string;
  nameEn?: string;
  descriptionTh: string;
  descriptionEn?: string;
  addressTh: string;
  provinceCode: string;
  districtCode?: string;
  categoryCode: string;
  latitude: number;
  longitude: number;
  phone?: string;
  website?: string;
  petTypes: Array<'DOG' | 'CAT' | 'SMALL_PET' | 'BIRD' | 'EXOTIC'>;
  indoorAllowed: boolean;
  outdoorAllowed: boolean;
  leashRequired: boolean;
  open24Hours: boolean;
  imageKeys: string[];
}

const steps = [
  ['ข้อมูลพื้นฐาน', 'Basics'],
  ['ตำแหน่ง', 'Location'],
  ['กฎสัตว์เลี้ยง', 'Pet rules'],
  ['หลักฐานและตรวจทาน', 'Evidence & review'],
] as const;

export function SubmissionForm({
  locale,
  initial,
}: {
  locale: Locale;
  initial?: SubmissionFormInitial;
}) {
  const router = useRouter();
  const brandLoading = useBrandLoading();
  const isThai = locale === 'th';
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draftId, setDraftId] = useState<string | undefined>(initial?.id);
  const [provinces, setProvinces] = useState<ProvinceSummary[]>([]);
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [provinceCode, setProvinceCode] = useState(initial?.provinceCode ?? '');
  const [districtCode, setDistrictCode] = useState(initial?.districtCode ?? '');
  const [images, setImages] = useState<UploadedImage[]>(
    initial?.imageKeys.map((objectKey, index) => ({
      objectKey,
      mediaUrl: `/api/media/${encodeURIComponent(objectKey)}`,
      name: `${locale === 'th' ? 'รูปหลักฐาน' : 'Evidence'} ${index + 1}`,
    })) ?? [],
  );
  const [formError, setFormError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [geocodeResults, setGeocodeResults] = useState<
    Array<{ displayName: string; latitude: number; longitude: number }>
  >([]);

  useEffect(() => {
    void fetch('/api/geography')
      .then((response) => response.json())
      .then((data: { provinces: ProvinceSummary[] }) => setProvinces(data.provinces));
  }, []);
  useEffect(() => {
    if (!provinceCode) return;
    void fetch(`/api/geography?province=${provinceCode}`)
      .then((response) => response.json())
      .then((data: { districts: DistrictSummary[] }) => setDistricts(data.districts));
  }, [provinceCode]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const progress = useMemo(() => `${((step + 1) / steps.length) * 100}%`, [step]);

  function inputFromForm(form: HTMLFormElement): SubmissionInput {
    const values = new FormData(form);
    return {
      id: draftId,
      kind: initial?.kind ?? 'CREATE',
      targetPlaceId: initial?.targetPlaceId,
      nameTh: String(values.get('nameTh') ?? ''),
      nameEn: String(values.get('nameEn') ?? ''),
      descriptionTh: String(values.get('descriptionTh') ?? ''),
      descriptionEn: String(values.get('descriptionEn') ?? ''),
      addressTh: String(values.get('addressTh') ?? ''),
      provinceCode: String(values.get('provinceCode') ?? ''),
      districtCode: String(values.get('districtCode') ?? '') || undefined,
      categoryCode: String(values.get('categoryCode') ?? ''),
      latitude: String(values.get('latitude') ?? ''),
      longitude: String(values.get('longitude') ?? ''),
      phone: String(values.get('phone') ?? ''),
      website: String(values.get('website') ?? ''),
      petTypes: values.getAll('petTypes') as SubmissionInput['petTypes'],
      indoorAllowed: values.get('indoorAllowed') === 'on',
      outdoorAllowed: values.get('outdoorAllowed') === 'on',
      leashRequired: values.get('leashRequired') === 'on',
      open24Hours: values.get('open24Hours') === 'on',
      imageKeys: images.map((image) => image.objectKey),
    };
  }

  async function persist(form: HTMLFormElement, intent: 'draft' | 'submit') {
    setPending(true);
    setFormError(undefined);
    setFieldErrors({});
    const result = await saveSubmission(inputFromForm(form), intent);
    setPending(false);
    if (!result.ok) {
      setFormError(result.formError);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    setDraftId(result.data.id);
    setDirty(false);
    if (intent === 'draft') toast.success(isThai ? 'บันทึกฉบับร่างแล้ว' : 'Draft saved');
    else {
      if (result.data.duplicateCount)
        toast.warning(
          isThai
            ? `พบสถานที่คล้ายกัน ${result.data.duplicateCount} แห่ง ผู้ดูแลจะตรวจสอบ`
            : `${result.data.duplicateCount} possible duplicates will be reviewed`,
        );
      toast.success(isThai ? 'ส่งข้อมูลให้ผู้ดูแลตรวจแล้ว' : 'Submitted for review');
      router.push(withLocale(locale, '/my-submissions'));
      router.refresh();
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    if (images.length + files.length > 8) {
      setFormError(isThai ? 'อัปโหลดได้สูงสุด 8 รูป' : 'Maximum 8 images');
      return;
    }
    setPending(true);
    const loadingToken = brandLoading.begin(
      isThai ? 'กำลังอัปโหลดหลักฐานอย่างปลอดภัย…' : 'Securely uploading evidence…',
      locale,
    );
    try {
      for (const file of files) {
        const body = new FormData();
        body.set('file', file);
        body.set('scope', 'submission');
        if (draftId) body.set('entityId', draftId);
        const response = await fetch('/api/uploads', { method: 'POST', body });
        const result = (await response.json()) as {
          objectKey?: string;
          mediaUrl?: string;
          error?: string;
        };
        if (!response.ok || !result.objectKey || !result.mediaUrl)
          throw new Error(result.error ?? 'Upload failed');
        setImages((current) => [
          ...current,
          { objectKey: result.objectKey!, mediaUrl: result.mediaUrl!, name: file.name },
        ]);
      }
      setDirty(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      brandLoading.end(loadingToken);
      setPending(false);
      event.target.value = '';
    }
  }

  async function geocode(form: HTMLFormElement) {
    const query = String(new FormData(form).get('addressTh') ?? '').trim();
    if (query.length < 3) return;
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const data = (await response.json()) as {
      results?: Array<{ displayName: string; latitude: number; longitude: number }>;
    };
    setGeocodeResults(data.results ?? []);
  }

  return (
    <form
      className="mx-auto max-w-4xl"
      onSubmit={(event) => {
        event.preventDefault();
        void persist(event.currentTarget, 'submit');
      }}
      onChange={() => setDirty(true)}
    >
      <div className="mb-8 overflow-hidden rounded-full bg-[#dce8e2]">
        <div className="h-2 bg-[#2d5a43] transition-all" style={{ width: progress }} />
      </div>
      <ol
        className="mb-8 grid grid-cols-4 gap-2"
        aria-label={isThai ? 'ขั้นตอนการส่งข้อมูล' : 'Submission steps'}
      >
        {steps.map(([th, en], index) => (
          <li key={en} className={index <= step ? 'text-[#1c382b]' : 'text-[#849297]'}>
            <span
              className={`mx-auto mb-2 grid size-8 place-items-center rounded-full text-xs font-black ${index <= step ? 'bg-[#2d5a43] text-white' : 'bg-[#e9eeeb]'}`}
            >
              {index < step ? <Check className="size-4" /> : index + 1}
            </span>
            <span className="hidden text-center text-xs font-bold sm:block">
              {isThai ? th : en}
            </span>
          </li>
        ))}
      </ol>

      <section className="surface p-6 sm:p-8">
        <div className={step === 0 ? 'grid gap-5' : 'hidden'} aria-hidden={step !== 0}>
          <div>
            <p className="eyebrow">01 — {isThai ? 'ข้อมูลพื้นฐาน' : 'Basics'}</p>
            <h1 className="mt-2 text-3xl font-black">
              {isThai ? 'สถานที่นี้ชื่ออะไร?' : 'Tell us about the place'}
            </h1>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-bold">
              {isThai ? 'ชื่อภาษาไทย *' : 'Thai name *'}
              <Input
                name="nameTh"
                defaultValue={initial?.nameTh}
                required
                minLength={2}
                maxLength={160}
                aria-invalid={Boolean(fieldErrors.nameTh)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              {isThai ? 'ชื่อภาษาอังกฤษ' : 'English name'}
              <Input name="nameEn" maxLength={160} defaultValue={initial?.nameEn} />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-bold">
            {isThai ? 'หมวดหมู่ *' : 'Category *'}
            <Select name="categoryCode" required defaultValue={initial?.categoryCode ?? ''}>
              <option value="" disabled>
                {isThai ? 'เลือกหมวดหมู่' : 'Choose category'}
              </option>
              {categoryDefinitions.map((category) => (
                <option key={category.code} value={category.code}>
                  {isThai ? category.nameTh : category.nameEn}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            {isThai ? 'คำอธิบาย *' : 'Description *'}
            <Textarea
              name="descriptionTh"
              required
              minLength={20}
              maxLength={2000}
              rows={5}
              defaultValue={initial?.descriptionTh}
            />
            <span className="text-xs font-normal text-[#5e6561]">
              {isThai
                ? 'ข้อความธรรมดาเท่านั้น อย่างน้อย 20 ตัวอักษร'
                : 'Plain text only, at least 20 characters'}
            </span>
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            {isThai ? 'คำอธิบายภาษาอังกฤษ' : 'English description'}
            <Textarea
              name="descriptionEn"
              maxLength={2000}
              rows={3}
              defaultValue={initial?.descriptionEn}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-bold">
              {isThai ? 'โทรศัพท์' : 'Phone'}
              <Input name="phone" maxLength={40} inputMode="tel" defaultValue={initial?.phone} />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              {isThai ? 'เว็บไซต์' : 'Website'}
              <Input
                name="website"
                type="url"
                placeholder="https://"
                defaultValue={initial?.website}
              />
            </label>
          </div>
        </div>

        <div className={step === 1 ? 'grid gap-5' : 'hidden'} aria-hidden={step !== 1}>
          <div>
            <p className="eyebrow">02 — {isThai ? 'ตำแหน่ง' : 'Location'}</p>
            <h2 className="mt-2 text-3xl font-black">
              {isThai ? 'ช่วยปักหมุดให้แม่นยำ' : 'Pin the exact location'}
            </h2>
          </div>
          <label className="grid gap-1.5 text-sm font-bold">
            {isThai ? 'ที่อยู่ *' : 'Address *'}
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
              {isThai ? 'จังหวัด *' : 'Province *'}
              <Select
                name="provinceCode"
                required
                value={provinceCode}
                onChange={(event) => {
                  setProvinceCode(event.target.value);
                  setDistrictCode('');
                  setDistricts([]);
                }}
              >
                <option value="">{isThai ? 'เลือกจังหวัด' : 'Choose province'}</option>
                {provinces.map((province) => (
                  <option key={province.code} value={province.code}>
                    {isThai ? province.nameTh : province.nameEn}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              {isThai ? 'อำเภอ / เขต' : 'District'}
              <Select
                name="districtCode"
                disabled={!provinceCode}
                value={districtCode}
                onChange={(event) => setDistrictCode(event.target.value)}
              >
                <option value="">{isThai ? 'เลือกอำเภอ' : 'Choose district'}</option>
                {districts.map((district) => (
                  <option key={district.code} value={district.code}>
                    {isThai ? district.nameTh : district.nameEn}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <div className="rounded-2xl border border-[#cfe0d8] bg-[#e7efe9] p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid flex-1 grid-cols-2 gap-3">
                <label className="grid gap-1 text-xs font-bold">
                  Latitude
                  <Input
                    name="latitude"
                    required
                    type="number"
                    step="any"
                    min="5"
                    max="21"
                    placeholder="13.7563"
                    defaultValue={initial?.latitude}
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold">
                  Longitude
                  <Input
                    name="longitude"
                    required
                    type="number"
                    step="any"
                    min="97"
                    max="106"
                    placeholder="100.5018"
                    defaultValue={initial?.longitude}
                  />
                </label>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={(event) => void geocode(event.currentTarget.form!)}
              >
                <Search className="size-4" />
                {isThai ? 'ค้นหาจากที่อยู่' : 'Search address'}
              </Button>
            </div>
            {geocodeResults.length > 0 && (
              <div className="mt-3 grid gap-2">
                {geocodeResults.map((result) => (
                  <button
                    key={`${result.latitude}-${result.longitude}`}
                    type="button"
                    className="flex items-start gap-2 rounded-xl bg-white p-3 text-left text-xs hover:ring-2 hover:ring-[#75b7a2]"
                    onClick={(event) => {
                      const form = event.currentTarget.form!;
                      (form.elements.namedItem('latitude') as HTMLInputElement).value = String(
                        result.latitude,
                      );
                      (form.elements.namedItem('longitude') as HTMLInputElement).value = String(
                        result.longitude,
                      );
                      setGeocodeResults([]);
                      setDirty(true);
                    }}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[#2d5a43]" />
                    {result.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="flex items-start gap-2 text-sm text-[#5e6561]">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            {isThai
              ? 'หากระบบค้นหาที่อยู่ไม่พร้อม ให้กรอกพิกัดหรือปักหมุดด้วยตัวเองได้เสมอ'
              : 'If address search is unavailable, enter the coordinates manually.'}
          </p>
        </div>

        <div className={step === 2 ? 'grid gap-6' : 'hidden'} aria-hidden={step !== 2}>
          <div>
            <p className="eyebrow">03 — {isThai ? 'กฎสัตว์เลี้ยง' : 'Pet rules'}</p>
            <h2 className="mt-2 text-3xl font-black">
              {isThai ? 'เพื่อนแบบไหนเข้าได้บ้าง?' : 'Which pets are welcome?'}
            </h2>
          </div>
          <fieldset>
            <legend className="mb-3 text-sm font-extrabold">
              {isThai ? 'ประเภทสัตว์ *' : 'Pet types *'}
            </legend>
            <div className="flex flex-wrap gap-2">
              {[
                ['DOG', 'สุนัข', 'Dogs'],
                ['CAT', 'แมว', 'Cats'],
                ['SMALL_PET', 'สัตว์เล็ก', 'Small pets'],
                ['BIRD', 'นก', 'Birds'],
                ['EXOTIC', 'สัตว์พิเศษ', 'Exotic pets'],
              ].map(([value, th, en]) => (
                <label key={value} className="cursor-pointer">
                  <input
                    className="peer sr-only"
                    type="checkbox"
                    name="petTypes"
                    value={value}
                    defaultChecked={initial?.petTypes.includes(
                      value as SubmissionFormInitial['petTypes'][number],
                    )}
                  />
                  <span className="inline-flex min-h-10 items-center rounded-full border border-[#d5d7d2] bg-white px-4 text-sm font-bold peer-checked:border-[#2d5a43] peer-checked:bg-[#e7efe9] peer-checked:text-[#1c382b]">
                    {isThai ? th : en}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['indoorAllowed', 'อนุญาตพื้นที่ในอาคาร', 'Indoor allowed'],
              ['outdoorAllowed', 'อนุญาตพื้นที่กลางแจ้ง', 'Outdoor allowed'],
              ['leashRequired', 'ต้องใช้สายจูง', 'Leash required'],
              ['open24Hours', 'เปิด 24 ชั่วโมง', 'Open 24 hours'],
            ].map(([name, th, en]) => (
              <label
                key={name}
                className="flex min-h-14 items-center justify-between rounded-2xl border border-[#e7e5df] bg-white px-4 text-sm font-bold"
              >
                {isThai ? th : en}
                <input
                  type="checkbox"
                  name={name}
                  className="size-5 accent-[#2d5a43]"
                  defaultChecked={Boolean(
                    initial?.[
                      name as keyof Pick<
                        SubmissionFormInitial,
                        'indoorAllowed' | 'outdoorAllowed' | 'leashRequired' | 'open24Hours'
                      >
                    ],
                  )}
                />
              </label>
            ))}
          </div>
        </div>

        <div className={step === 3 ? 'grid gap-6' : 'hidden'} aria-hidden={step !== 3}>
          <div>
            <p className="eyebrow">04 — {isThai ? 'หลักฐานและตรวจทาน' : 'Evidence & review'}</p>
            <h2 className="mt-2 text-3xl font-black">
              {isThai ? 'เพิ่มรูปเพื่อช่วยผู้ตรวจ' : 'Add helpful evidence'}
            </h2>
          </div>
          <div className="rounded-[24px] border-2 border-dashed border-[#a9cabe] bg-[#f4f7f4] p-7 text-center">
            <ImagePlus className="mx-auto size-9 text-[#2d5a43]" />
            <p className="mt-3 font-extrabold">
              {isThai ? 'JPEG, PNG หรือ WebP สูงสุด 8 รูป' : 'JPEG, PNG or WebP, up to 8 images'}
            </p>
            <p className="mt-1 text-xs text-[#5e6561]">
              {isThai
                ? 'รูปละไม่เกิน 5 MB ระบบตรวจชนิดไฟล์จากเนื้อหาจริง'
                : '5 MB each; actual file signatures are verified.'}
            </p>
            <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-[#2d5a43] px-5 text-sm font-bold text-white">
              <UploadCloud className="size-4" />
              {isThai ? 'เลือกรูป' : 'Choose images'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(event) => void upload(event)}
                disabled={pending}
              />
            </label>
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((image, index) => (
                <div
                  key={image.objectKey}
                  className="relative overflow-hidden rounded-2xl border bg-white"
                >
                  <img
                    src={image.mediaUrl}
                    alt={image.name}
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setImages((current) =>
                        current.filter((item) => item.objectKey !== image.objectKey),
                      )
                    }
                    className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-white shadow"
                    aria-label={isThai ? `ลบรูป ${index + 1}` : `Remove image ${index + 1}`}
                  >
                    <X className="size-4" />
                  </button>
                  {index === 0 && (
                    <Badge className="absolute bottom-2 left-2">{isThai ? 'ภาพปก' : 'Cover'}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-[#f0d69e] bg-[#fff9e8] p-4 text-sm leading-6">
            <strong>{isThai ? 'ก่อนส่งข้อมูล' : 'Before submitting'}</strong>
            <p>
              {isThai
                ? 'ข้อมูลนี้จะยังไม่แสดงต่อสาธารณะจนกว่าผู้ดูแลจะอนุมัติ และสถานะเป็น VERIFIED'
                : 'This information remains private until an administrator approves it as VERIFIED.'}
            </p>
          </div>
        </div>

        {(formError || Object.keys(fieldErrors).length > 0) && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-[#e9b8b5] bg-[#fff1ef] p-4 text-sm font-semibold text-[#c23934]"
          >
            <p>
              {formError ??
                (isThai ? 'กรุณาตรวจข้อมูลที่ระบุ' : 'Please review the highlighted information')}
            </p>
            {Object.entries(fieldErrors).map(([name, errors]) => (
              <p key={name} className="mt-1">
                {name}: {errors.join(', ')}
              </p>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((value) => value - 1)}>
              <ArrowLeft className="size-4" />
              {isThai ? 'ย้อนกลับ' : 'Back'}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {step === steps.length - 1 && (
            <Button
              variant="secondary"
              type="button"
              disabled={pending}
              onClick={(event) => void persist(event.currentTarget.form!, 'draft')}
            >
              <Save className="size-4" />
              {isThai ? 'บันทึกฉบับร่าง' : 'Save draft'}
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button type="button" onClick={() => setStep((value) => value + 1)}>
              {isThai ? 'ถัดไป' : 'Next'}
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending
                ? isThai
                  ? 'กำลังส่ง…'
                  : 'Submitting…'
                : isThai
                  ? 'ส่งให้ตรวจสอบ'
                  : 'Submit for review'}
              <Check className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
