export type Locale = 'th' | 'en';

export const messages = {
  th: {
    brand: 'PawMap Thailand',
    tagline: 'เที่ยวด้วยกัน ได้ทุกที่ทั่วไทย',
    explore: 'สำรวจแผนที่',
    emergency: 'ฉุกเฉิน',
    addPlace: 'เพิ่มสถานที่',
    login: 'เข้าสู่ระบบ',
    register: 'สมัครสมาชิก',
    favorites: 'รายการโปรด',
    submissions: 'ข้อมูลที่ฉันส่ง',
    notifications: 'การแจ้งเตือน',
    profile: 'โปรไฟล์',
    admin: 'ผู้ดูแลระบบ',
    searchPlaceholder: 'ค้นหาสถานที่ อำเภอ หรือจังหวัด',
    search: 'ค้นหา',
    verified: 'ตรวจสอบแล้ว',
    viewDetails: 'ดูรายละเอียด',
    lastVerified: 'ตรวจสอบล่าสุด',
    mapUnavailable: 'แผนที่ฐานไม่พร้อมใช้งาน กำลังแสดงขอบเขตจังหวัดแทน',
  },
  en: {
    brand: 'PawMap Thailand',
    tagline: 'Travel together, everywhere in Thailand',
    explore: 'Explore map',
    emergency: 'Emergency',
    addPlace: 'Add a place',
    login: 'Sign in',
    register: 'Create account',
    favorites: 'Favorites',
    submissions: 'My submissions',
    notifications: 'Notifications',
    profile: 'Profile',
    admin: 'Administration',
    searchPlaceholder: 'Search a place, district, or province',
    search: 'Search',
    verified: 'Verified',
    viewDetails: 'View details',
    lastVerified: 'Last verified',
    mapUnavailable: 'Basemap unavailable. Province boundaries are still available.',
  },
} as const;

export function t(locale: Locale) {
  return messages[locale];
}

export function withLocale(locale: Locale, href: string) {
  if (!href.startsWith('/')) return href;
  return locale === 'en' ? `/en${href === '/' ? '' : href}` : href;
}
