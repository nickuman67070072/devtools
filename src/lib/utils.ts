import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | Date, locale: 'th' | 'en' = 'th') {
  return new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-GB', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
