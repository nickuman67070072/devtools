'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';

import { BrandLogo } from '@/components/brand-logo';
import { cn } from '@/lib/utils';

const INTRO_KEY = 'pawmap:intro-seen:v2';
const MIN_INTRO_MS = 1500;
const MAX_INTRO_MS = 5000;
const HEAVY_DELAY_MS = 600;

type LoadingLocale = 'th' | 'en';

export function BrandLoading({
  variant = 'panel',
  locale = 'th',
  label,
  className,
}: {
  variant?: 'fullscreen' | 'panel';
  locale?: LoadingLocale;
  label?: string;
  className?: string;
}) {
  const status = label ?? (locale === 'th' ? 'กำลังโหลด PawMap…' : 'Loading PawMap…');

  return (
    <div
      className={cn(
        'brand-loading',
        variant === 'fullscreen' && 'brand-loading--fullscreen',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={status}
      data-testid={`brand-loading-${variant}`}
    >
      <div className="brand-loading__mark" aria-hidden="true">
        <BrandLogo compact />
      </div>
      <p>{status}</p>
      <span className="brand-loading__progress" aria-hidden="true" />
    </div>
  );
}

interface GlobalLoadingContextValue {
  begin: (label?: string, locale?: LoadingLocale) => string;
  end: (token: string) => void;
}

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

export function BrandLoadingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale: LoadingLocale = pathname?.startsWith('/en') ? 'en' : 'th';
  const [introVisible, setIntroVisible] = useState(true);
  const [heavy, setHeavy] = useState<{
    token: string;
    label?: string;
    locale: LoadingLocale;
  } | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (sessionStorage.getItem(INTRO_KEY) === '1') {
      const hide = window.setTimeout(() => setIntroVisible(false), 0);
      return () => clearTimeout(hide);
    }
    const close = () => {
      sessionStorage.setItem(INTRO_KEY, '1');
      setIntroVisible(false);
    };
    const minimum = window.setTimeout(close, MIN_INTRO_MS);
    const failsafe = window.setTimeout(close, MAX_INTRO_MS);
    return () => {
      clearTimeout(minimum);
      clearTimeout(failsafe);
    };
  }, []);

  useEffect(() => () => timers.current.forEach((timer) => clearTimeout(timer)), []);

  const begin = useCallback((label?: string, locale: LoadingLocale = 'th') => {
    const token = crypto.randomUUID();
    timers.current.set(
      token,
      setTimeout(() => setHeavy({ token, label, locale }), HEAVY_DELAY_MS),
    );
    return token;
  }, []);

  const end = useCallback((token: string) => {
    const timer = timers.current.get(token);
    if (timer) clearTimeout(timer);
    timers.current.delete(token);
    setHeavy((current) => (current?.token === token ? null : current));
  }, []);

  const value = useMemo(() => ({ begin, end }), [begin, end]);

  return (
    <GlobalLoadingContext.Provider value={value}>
      {children}
      {introVisible && <BrandLoading variant="fullscreen" locale={locale} />}
      {heavy && <BrandLoading variant="fullscreen" locale={heavy.locale} label={heavy.label} />}
    </GlobalLoadingContext.Provider>
  );
}

export function useBrandLoading() {
  const value = useContext(GlobalLoadingContext);
  if (!value) throw new Error('useBrandLoading must be used inside BrandLoadingProvider');
  return value;
}
