import '@fontsource-variable/noto-sans-thai';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/800.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

import type { Metadata } from 'next';
import { Toaster } from 'sonner';

import { BrandLoadingProvider } from '@/components/brand-loading';

export const metadata: Metadata = {
  title: {
    default: 'PawMap Thailand — เที่ยวด้วยกัน ได้ทุกที่ทั่วไทย',
    template: '%s | PawMap Thailand',
  },
  description:
    'ค้นหาและช่วยกันตรวจสอบโรงพยาบาล ที่พัก คาเฟ่ สวน และสถานที่ Pet-Friendly ทั่วประเทศไทย',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <BrandLoadingProvider>
          {children}
          <Toaster richColors position="top-center" />
        </BrandLoadingProvider>
      </body>
    </html>
  );
}
