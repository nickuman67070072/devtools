import { Ban, Home, LogIn } from 'lucide-react';

import { PageShell } from '@/components/page-shell';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';

export function UnauthorizedPage({ locale }: { locale: Locale }) {
  const isThai = locale === 'th';
  return (
    <PageShell locale={locale}>
      <main className="container-shell grid min-h-[65vh] place-items-center py-20 text-center">
        <div className="max-w-lg">
          <span className="mx-auto grid size-20 place-items-center rounded-full bg-[#fff0ee] text-[#c23934]">
            <Ban className="size-9" />
          </span>
          <h1 className="mt-6 text-4xl font-black">
            {isThai ? 'ไม่มีสิทธิ์เข้าถึงหน้านี้' : 'You cannot access this page'}
          </h1>
          <p className="mt-3 leading-7 text-[#5e6561]">
            {isThai
              ? 'บัญชีของคุณอาจไม่มีสิทธิ์ที่จำเป็น หรือถูกระงับชั่วคราว หากคิดว่าเป็นข้อผิดพลาด โปรดติดต่อผู้ดูแลระบบ'
              : 'Your account may lack the required role or may be suspended. Contact an administrator if this seems incorrect.'}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#2d5a43] px-5 text-sm font-bold text-white"
              href={withLocale(locale, '/')}
            >
              <Home className="size-4" />
              {isThai ? 'กลับหน้าแรก' : 'Go home'}
            </a>
            <a
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#b9d8ce] bg-[#e7efe9] px-5 text-sm font-bold text-[#1c382b]"
              href={withLocale(locale, '/login')}
            >
              <LogIn className="size-4" />
              {isThai ? 'เข้าสู่ระบบใหม่' : 'Sign in again'}
            </a>
          </div>
        </div>
      </main>
    </PageShell>
  );
}
