import brandLogo from "@assets/brand/logo.png";
import brandMark from "@assets/brand/mark.png";
import heroIcon from "@assets/brand/hero-icon.png";
import heroLogo from "@assets/brand/hero-logo.png";
import pharmacyInterior from "../assets/pharmacy-interior.jpg";
import pharmacyInteriorBrand from "../assets/pharmacy-interior-brand.jpg";
import pharmacyInteriorCounter from "../assets/pharmacy-interior-counter.jpg";
import pharmacyInteriorShelves from "../assets/pharmacy-interior-shelves.jpg";
import pharmacyHomeWide from "../assets/pharmacy-home-wide.jpg";
import pharmacyHomePortrait from "../assets/pharmacy-home-portrait.jpg";
import { getServiceHoursSentence } from "./config";

/**
 * Generate a Google Maps embed URL from coordinates.
 * Uses the maps.google.com embed format which works without an API key
 * and always shows the exact pin at the given lat/lng.
 */
function buildMapEmbedUrl(lat: number, lng: number, zoom = 17): string {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&t=&ie=UTF8&iwloc=&output=embed`;
}

export const images = {
  pic0: pharmacyInteriorBrand,
  pic1: pharmacyInterior,
  pic2: pharmacyInteriorCounter,
  pic3: pharmacyInteriorShelves,
  homeWide: pharmacyHomeWide,
  homePortrait: pharmacyHomePortrait,
  logo: brandLogo,
  logoMark: brandMark,
  logoHero: heroIcon,
  heroLogo,
  videoLink: "https://www.canva.com/design/DAHFcw0san0/rFsIDX1QRsFF_QYZua20hA/watch?embed",
};

/** Additional promo clips (same or alternate embeds). */
export const promoVideoGallery = [
  {
    id: "main",
    titleAr: "تعريف بالمنصة",
    titleEn: "Platform overview",
    src: "https://www.canva.com/design/DAHFcw0san0/rFsIDX1QRsFF_QYZua20hA/watch?embed",
  },
  {
    id: "walkthrough",
    titleAr: "جولة إضافية في الخدمة",
    titleEn: "Additional service walkthrough",
    src: "https://www.canva.com/design/DAHFcw0san0/rFsIDX1QRsFF_QYZua20hA/watch?embed",
  },
] as const;

export const siteContact = {
  phoneDisplay: "010 12255595",
  phoneHref: "01012255595",
  whatsappDisplay: "+20 11 12343212",
  whatsappHref: "201112343212",
  email: "united.pharmacy.eg@gmail.com",
  whatsappUrl: "https://wa.me/201112343212?text=مرحباً،%20أود%20الاستفسار%20عن%20منتج",
  mainBranchAr: "جاردينيا سيتي - محل B1 مول CITY WALK",
  mainBranchEn: "Gardenia City - Shop B1, City Walk Mall",
} as const;

export const siteSocials = [
  { id: "facebook", label: "Facebook", href: "https://www.facebook.com/united.pharmacy.eg/" },
  { id: "instagram", label: "Instagram", href: "https://www.instagram.com/united.pharmacy.eg" },
  { id: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@united.pharmacy.eg" },
  { id: "youtube", label: "YouTube", href: "https://www.youtube.com/@united.pharmacyeg" },
] as const;

const sharedBranchHoursAr = getServiceHoursSentence("ar");
const sharedBranchHoursEn = getServiceHoursSentence("en");

// Branch phone numbers — taken from the official branch listing photo
const gardeniaPhone   = "01012255595";
const maadiPhone      = "01061128400";
const dhabbatPhone1   = "01226898995";
const dhabbatPhone2   = "01090530095";
const ismailia14Phone = "01201967825";
const ismailia13Phone = "01090530095";
const whatsappLine    = "01112343212";

const buildBranchDirectionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;

export type SiteLocation = {
  id: string;
  nameAr: string;
  nameEn: string;
  fullNameAr: string;
  fullNameEn: string;
  addressAr: string;
  addressEn: string;
  phones: string[];
  hoursAr: string;
  hoursEn: string;
  mapsDirectionsUrl: string;
  mapQuery: string;
  lat: number;
  lng: number;
  mapZoom: number;
  isPrimary: boolean;
  governorate: "Cairo";
  area: string;
  deliveryEnabled: boolean;
  mapEmbedSrc?: string;
};

export const locations = [
  {
    id: "gardenia",
    nameAr: "جاردينيا سيتي",
    nameEn: "Gardenia City",
    fullNameAr: "صيدليات المتحدة - جاردينيا سيتي",
    fullNameEn: "United Pharmacies - Gardenia City",
    addressAr: "محل B1 مول CITY WALK كومباوند جاردينيا سيتي",
    addressEn: "Shop B1, City Walk Mall, Gardenia City Compound",
    phones: [gardeniaPhone, whatsappLine],
    hoursAr: sharedBranchHoursAr,
    hoursEn: sharedBranchHoursEn,
    mapsDirectionsUrl: buildBranchDirectionsUrl(30.0827, 31.3853),
    mapQuery: "30.0827,31.3853",
    lat: 30.0827,
    lng: 31.3853,
    mapZoom: 18,
    isPrimary: true,
    governorate: "Cairo",
    area: "القاهرة الجديدة",
    deliveryEnabled: true,
    mapEmbedSrc: buildMapEmbedUrl(30.0827, 31.3853, 18),
  },
  {
    id: "maadi",
    nameAr: "المعادي",
    nameEn: "Maadi",
    fullNameAr: "صيدليات المتحدة - المعادي",
    fullNameEn: "United Pharmacies - Maadi",
    addressAr: "ش فلسطين، بندر مول، المعادي، القاهرة",
    addressEn: "Palestine St., Bandar Mall, Maadi, Cairo",
    phones: [maadiPhone, whatsappLine],
    hoursAr: sharedBranchHoursAr,
    hoursEn: sharedBranchHoursEn,
    mapsDirectionsUrl: buildBranchDirectionsUrl(30.0146, 31.2824),
    mapQuery: "30.0146,31.2824",
    lat: 30.0146,
    lng: 31.2824,
    mapZoom: 18,
    isPrimary: false,
    governorate: "Cairo",
    area: "المعادي",
    deliveryEnabled: true,
    mapEmbedSrc: buildMapEmbedUrl(30.0146, 31.2824, 18),
  },
  {
    id: "masakin-dhabbat",
    nameAr: "مساكن الضباط",
    nameEn: "Masakin Al-Dabbat",
    fullNameAr: "صيدليات المتحدة - مساكن الضباط",
    fullNameEn: "United Pharmacies - Masakin Al-Dabbat",
    addressAr: "عمارة 336 شارع فاطمة الزهراء متفرع من الميثاق، مساكن الضباط، مدينة نصر",
    addressEn: "Building 336, Fatima Al-Zahraa St., off Al-Mithaq St., Masakin Al-Dabbat, Nasr City",
    phones: [dhabbatPhone1, whatsappLine],
    hoursAr: sharedBranchHoursAr,
    hoursEn: sharedBranchHoursEn,
    mapsDirectionsUrl: buildBranchDirectionsUrl(30.052, 31.355),
    mapQuery: "30.052,31.355",
    lat: 30.052,
    lng: 31.355,
    mapZoom: 18,
    isPrimary: false,
    governorate: "Cairo",
    area: "مدينة نصر",
    deliveryEnabled: true,
    mapEmbedSrc: buildMapEmbedUrl(30.052, 31.355, 18),
  },
  {
    id: "masakin-dhabbat-2",
    nameAr: "مساكن الضباط ٢",
    nameEn: "Masakin Al-Dabbat 2",
    fullNameAr: "صيدليات المتحدة - مساكن الضباط ٢",
    fullNameEn: "United Pharmacies - Masakin Al-Dabbat 2",
    addressAr: "عمارة 2004 شارع فاطمة الزهراء متفرع من الميثاق، الحي العاشر، مساكن الضباط، مدينة نصر",
    addressEn: "Building 2004, Fatima Al-Zahraa St., off Al-Mithaq St., 10th District, Masakin Al-Dabbat, Nasr City",
    phones: [dhabbatPhone2, whatsappLine],
    hoursAr: sharedBranchHoursAr,
    hoursEn: sharedBranchHoursEn,
    mapsDirectionsUrl: buildBranchDirectionsUrl(30.0525, 31.3558),
    mapQuery: "30.0525,31.3558",
    lat: 30.0525,
    lng: 31.3558,
    mapZoom: 18,
    isPrimary: false,
    governorate: "Cairo",
    area: "مدينة نصر",
    deliveryEnabled: true,
    mapEmbedSrc: buildMapEmbedUrl(30.0525, 31.3558, 18),
  },
  {
    id: "ismailia-14",
    nameAr: "شارع الاسماعيليه - ١٤",
    nameEn: "Ismailia St. – No. 14",
    fullNameAr: "صيدليات المتحدة - شارع الاسماعيليه ١٤",
    fullNameEn: "United Pharmacies - Ismailia St. No. 14",
    addressAr:       "١٤ ش الإسماعيلية متفرع من شارع الميثاق، زهراء مدينة نصر",
    addressEn:       "14 Ismailia St., off Al-Mithaq St., Zahraa Nasr City",
    phones: [ismailia14Phone, whatsappLine],
    hoursAr: sharedBranchHoursAr,
    hoursEn: sharedBranchHoursEn,
    mapsDirectionsUrl: buildBranchDirectionsUrl(30.065, 31.378),
    mapQuery: "30.065,31.378",
    lat: 30.065,
    lng: 31.378,
    mapZoom: 18,
    isPrimary: false,
    governorate: "Cairo",
    area: "مدينة نصر",
    deliveryEnabled: true,
    mapEmbedSrc: buildMapEmbedUrl(30.065, 31.378, 18),
  },
  {
    id: "ismailia-13",
    nameAr: "شارع الاسماعيليه - ١٣",
    nameEn: "Ismailia St. – No. 13",
    fullNameAr: "صيدليات المتحدة - شارع الاسماعيليه ١٣",
    fullNameEn: "United Pharmacies - Ismailia St. No. 13",
    addressAr: "١٣ ش الأسماعيلية متفرع من شارع الميثاق، زهراء مدينة نصر",
    addressEn: "13 Ismailia St., off Al-Mithaq St., Zahraa Nasr City",
    phones: [ismailia13Phone, whatsappLine],
    hoursAr: sharedBranchHoursAr,
    hoursEn: sharedBranchHoursEn,
    mapsDirectionsUrl: buildBranchDirectionsUrl(30.0655, 31.3785),
    mapQuery: "30.0655,31.3785",
    lat: 30.0655,
    lng: 31.3785,
    mapZoom: 18,
    isPrimary: false,
    governorate: "Cairo",
    area: "مدينة نصر",
    deliveryEnabled: true,
    mapEmbedSrc: buildMapEmbedUrl(30.0655, 31.3785, 18),
  },
] satisfies readonly SiteLocation[];

export const deliveryLocations = locations.filter((location) => location.deliveryEnabled);
