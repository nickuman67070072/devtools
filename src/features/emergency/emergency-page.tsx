import { Siren, TriangleAlert } from 'lucide-react';

import { PageShell } from '@/components/page-shell';
import { Badge } from '@/components/ui/badge';
import { findPublicPlaces } from '@/lib/place-repository';
import type { Locale } from '@/lib/i18n';
import { EmergencyList } from '@/features/emergency/emergency-list';

export async function EmergencyPage({ locale }: { locale: Locale }) {
  const places = (await findPublicPlaces({ categories: ['VET'], twentyFourHours: true })).slice(
    0,
    12,
  );
  return (
    <PageShell locale={locale}>
      <section className="bg-[#c23934] py-12 text-white">
        <div className="container-shell">
          <div>
            <Badge tone="neutral" className="bg-white/90 text-[#8f2830]">
              <Siren className="mr-1 size-4" />
              Emergency mode
            </Badge>
            <h1 className="mt-4 text-4xl font-black">
              {locale === 'th'
                ? 'โรงพยาบาลสัตว์ที่พร้อมช่วยตอนนี้'
                : 'Veterinary help available now'}
            </h1>
            <p className="mt-3 max-w-2xl text-white/80">
              {locale === 'th'
                ? 'เรียงตามระยะทางเมื่ออนุญาตตำแหน่ง แสดงเฉพาะที่เปิดอยู่หรือเปิด 24 ชั่วโมง'
                : 'Sorted by distance when location is available, showing open and 24-hour services.'}
            </p>
          </div>
        </div>
      </section>
      <section className="container-shell py-10">
        <div className="mb-7 flex gap-3 rounded-2xl border border-[#efc5c8] bg-[#fff5f5] p-4 text-sm leading-6 text-[#7f3036]">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <p>
            <strong>
              {locale === 'th' ? 'กรุณาโทรยืนยันก่อนออกเดินทาง' : 'Call before travelling.'}
            </strong>{' '}
            {locale === 'th'
              ? 'เวลาเปิดและข้อมูลติดต่ออาจมีการเปลี่ยนแปลง โปรดตรวจสอบกับสถานที่โดยตรง'
              : 'Opening hours and contact details may change. Confirm directly with the venue.'}
          </p>
        </div>
        <EmergencyList places={places} locale={locale} />
      </section>
    </PageShell>
  );
}
