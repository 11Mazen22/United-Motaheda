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
    mapZoom: 16,
    isPrimary: true,
    governorate: "Cairo",
    area: "القاهرة الجديدة",
    deliveryEnabled: true,
    mapEmbedSrc:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3452.31!2d31.3853!3d30.0827!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDA0JzU3LjciTiAzMcKwMjMnMDcuMSJF!5e0!3m2!1sen!2seg!4v1",
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
    mapZoom: 17,
    isPrimary: false,
    governorate: "Cairo",
    area: "المعادي",
    deliveryEnabled: true,
    mapEmbedSrc:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3454.8!2d31.2824!3d30.0146!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDAwJzUyLjYiTiAzMcKwMTYnNTYuNiJF!5e0!3m2!1sen!2seg!4v1",
  },
  {
    id: "masakin-dhabbat",
    nameAr: "مساكن الضباط",
    nameEn: "Masakin Al-Dabbat",
    fullNameAr: "صيدليات المتحدة - مساكن الضباط",
    fullNameEn: "United Pharmacies - Masakin Al-Dabbat",
    addressAr: "عمارة 336 شارع فاطمة الزهراء متفرع من الميثاق",
    addressEn: "Building 336, Fatima Al-Zahraa St., off Al-Mithaq St.",
    phones: [dhabbatPhone1, whatsappLine],
    hoursAr: sharedBranchHoursAr,
    hoursEn: sharedBranchHoursEn,
    mapsDirectionsUrl: buildBranchDirectionsUrl(30.0520, 31.3550),
    mapQuery: "30.0520,31.3550",
    lat: 30.0520,
    lng: 31.3550,
    mapZoom: 17,
    isPrimary: false,
    governorate: "Cairo",
    area: "مدينة نصر",
    deliveryEnabled: true,
    mapEmbedSrc:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3453.3!2d31.3550!3d30.0520!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDAzJzA3LjIiTiAzMcKwMjEnMTguMCJF!5e0!3m2!1sen!2seg!4v1",
  },
  {
    id: "masakin-dhabbat-2",
    nameAr: "مساكن الضباط ٢",
    nameEn: "Masakin Al-Dabbat 2",
    fullNameAr: "صيدليات المتحدة - مساكن الضباط ٢",
    fullNameEn: "United Pharmacies - Masakin Al-Dabbat 2",
    addressAr: "عمارة 336 شارع فاطمة الزهراء متفرع من الميثاق",
    addressEn: "Building 336, Fatima Al-Zahraa St., off Al-Mithaq St.",
    phones: [dhabbatPhone2, whatsappLine],
    hoursAr: sharedBranchHoursAr,
    hoursEn: sharedBranchHoursEn,
    mapsDirectionsUrl: buildBranchDirectionsUrl(30.0521, 31.3551),
    mapQuery: "30.0521,31.3551",
    lat: 30.0521,
    lng: 31.3551,
    mapZoom: 17,
    isPrimary: false,
    governorate: "Cairo",
    area: "مدينة نصر",
    deliveryEnabled: true,
    mapEmbedSrc:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3453.3!2d31.3551!3d30.0521!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDAzJzA3LjIiTiAzMcKwMjEnMTguMCJF!5e0!3m2!1sen!2seg!4v1",
  },
  {
    id: "ismailia-14",
    nameAr: "شارع الاسماعيليه - ١٤",
    nameEn: "Ismailia St. – No. 14",
    fullNameAr: "صيدليات المتحدة - شارع الاسماعيليه ١٤",
    fullNameEn: "United Pharmacies - Ismailia St. No. 14",
    addressAr: "١٤ ش الأسماعيلية متفرع من شارع الميثاق، زهراء مدينة نصر",
    addressEn: "14 Ismailia St., off Al-Mithaq St., Zahraa Nasr City",
    phones: [ismailia14Phone, whatsappLine],
    hoursAr: sharedBranchHoursAr,
    hoursEn: sharedBranchHoursEn,
    mapsDirectionsUrl: buildBranchDirectionsUrl(30.0650, 31.3780),
    mapQuery: "30.0650,31.3780",
    lat: 30.0650,
    lng: 31.3780,
    mapZoom: 16,
    isPrimary: false,
    governorate: "Cairo",
    area: "مدينة نصر",
    deliveryEnabled: true,
    mapEmbedSrc:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3452.9!2d31.3780!3d30.0650!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDAzJzU0LjAiTiAzMcKwMjInNDAuOCJF!5e0!3m2!1sen!2seg!4v1",
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
    mapZoom: 16,
    isPrimary: false,
    governorate: "Cairo",
    area: "مدينة نصر",
    deliveryEnabled: true,
    mapEmbedSrc:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3452.9!2d31.3785!3d30.0655!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDAzJzU1LjgiTiAzMcKwMjInNDIuNiJF!5e0!3m2!1sen!2seg!4v1",
  },
] satisfies readonly SiteLocation[];

export const deliveryLocations = locations.filter((location) => location.deliveryEnabled);
