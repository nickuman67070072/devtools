import type { Locale } from '@/lib/i18n';
import { additionalCategories } from './additional-categories';

export const categoryDefinitions = [
  {
    code: 'VET',
    slug: 'veterinary',
    nameTh: 'โรงพยาบาลสัตว์',
    nameEn: 'Veterinary',
    color: '#3288d1',
    icon: 'Stethoscope',
  },
  {
    code: 'STAY',
    slug: 'accommodation',
    nameTh: 'ที่พัก',
    nameEn: 'Accommodation',
    color: '#8c62c6',
    icon: 'BedDouble',
  },
  {
    code: 'MALL',
    slug: 'mall',
    nameTh: 'ห้างและคอมมูนิตี้มอลล์',
    nameEn: 'Malls',
    color: '#f26f5f',
    icon: 'Building2',
  },
  {
    code: 'CAFE',
    slug: 'cafe',
    nameTh: 'คาเฟ่และร้านอาหาร',
    nameEn: 'Cafés & restaurants',
    color: '#e8893d',
    icon: 'Coffee',
  },
  {
    code: 'PARK',
    slug: 'park',
    nameTh: 'สวนสาธารณะ',
    nameEn: 'Parks',
    color: '#3e9c72',
    icon: 'Trees',
  },
  {
    code: 'GROOMING',
    slug: 'grooming',
    nameTh: 'อาบน้ำและฝากเลี้ยง',
    nameEn: 'Grooming & boarding',
    color: '#d66f9f',
    icon: 'Scissors',
  },
  {
    code: 'SHOP',
    slug: 'pet-shop',
    nameTh: 'ร้านสินค้า',
    nameEn: 'Pet shops',
    color: '#d7a928',
    icon: 'ShoppingBag',
  },
  {
    code: 'RESCUE',
    slug: 'rescue',
    nameTh: 'ศูนย์ช่วยเหลือสัตว์',
    nameEn: 'Rescue centres',
    color: '#168b88',
    icon: 'HeartHandshake',
  },
  ...additionalCategories,
] as const;

export type CategoryCode = (typeof categoryDefinitions)[number]['code'];

export interface ProvinceSummary {
  code: string;
  slug: string;
  nameTh: string;
  nameEn: string;
  centroidLat: number;
  centroidLng: number;
  placeCount: number;
}

export interface DistrictSummary {
  code: string;
  provinceCode: string;
  slug: string;
  nameTh: string;
  nameEn: string;
}

export interface PlaceSummary {
  id: string;
  slug: string;
  nameTh: string;
  nameEn: string;
  descriptionTh: string;
  descriptionEn: string;
  addressTh: string;
  addressEn: string;
  provinceCode: string;
  provinceSlug: string;
  provinceNameTh: string;
  provinceNameEn: string;
  districtNameTh: string;
  districtNameEn: string;
  categoryCode: CategoryCode;
  categoryCodes: CategoryCode[];
  categoryNameTh: string;
  categoryNameEn: string;
  categoryColor: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  status: 'VERIFIED' | 'STALE' | 'TEMPORARILY_CLOSED' | 'PERMANENTLY_CLOSED';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  trustScore: number;
  lastVerifiedAt: string | null;
  isOpenNow: boolean;
  is24Hours: boolean;
  phone: string;
  website?: string;
  petTypes: string[];
  rules: string[];
  amenities: string[];
}

export type MapPoint = Pick<
  PlaceSummary,
  | 'id'
  | 'slug'
  | 'nameTh'
  | 'nameEn'
  | 'provinceCode'
  | 'categoryCode'
  | 'categoryCodes'
  | 'categoryColor'
  | 'latitude'
  | 'longitude'
>;

export function localize(locale: Locale, value: Pick<PlaceSummary, 'nameTh' | 'nameEn'>) {
  return locale === 'th' ? value.nameTh : value.nameEn;
}

export interface MapFilters {
  query?: string;
  province?: string;
  district?: string;
  categories?: CategoryCode[];
  petTypes?: string[];
  openNow?: boolean;
  twentyFourHours?: boolean;
  verifiedOnly?: boolean;
  indoor?: boolean;
  outdoor?: boolean;
  freeEntry?: boolean;
  petSize?: string;
  leashRequired?: boolean;
  carrierRequired?: boolean;
  parking?: boolean;
  minimumRating?: number;
  bbox?: [number, number, number, number];
}
