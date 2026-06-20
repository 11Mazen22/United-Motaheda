import { PrismaClient } from "@prisma/client";

type Coordinates = { lat: number; lng: number };

function bboxPolygon(box: { minLat: number; maxLat: number; minLng: number; maxLng: number }) {
  return {
    points: [
      { lat: box.minLat, lng: box.minLng },
      { lat: box.minLat, lng: box.maxLng },
      { lat: box.maxLat, lng: box.maxLng },
      { lat: box.maxLat, lng: box.minLng },
    ],
  };
}

function expandBox(
  box: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  delta: { lat: number; lng: number },
) {
  return {
    minLat: box.minLat - delta.lat,
    maxLat: box.maxLat + delta.lat,
    minLng: box.minLng - delta.lng,
    maxLng: box.maxLng + delta.lng,
  };
}

async function main() {
  const prisma = new PrismaClient();

  /**
   * Delivery zone polygons
   * Notes:
   * - These are *real* GPS coordinates outlining practical delivery boundaries
   *   for each branch area in Greater Cairo.
   * - Stored as { points: [{lat,lng}, ...] } (implicitly closed).
   */
  const zoneByBranchId: Record<string, { points: Coordinates[] }> = {
    // Branch: Gardenia City (New Cairo / Heliopolis corridor)
    gardenia: {
      points: [
        { lat: 30.125, lng: 31.415 },
        { lat: 30.125, lng: 31.365 },
        { lat: 30.105, lng: 31.35 },
        { lat: 30.07,  lng: 31.36  },
        { lat: 30.065, lng: 31.41  },
        { lat: 30.085, lng: 31.43  },
        { lat: 30.11,  lng: 31.425 },
      ],
    },

    // Branch: Maadi (Palestine Rd / Bandar Mall)
    maadi: {
      points: [
        { lat: 30.04,  lng: 31.305 },
        { lat: 30.04,  lng: 31.255 },
        { lat: 30.02,  lng: 31.24  },
        { lat: 29.985, lng: 31.25  },
        { lat: 29.98,  lng: 31.295 },
        { lat: 30.0,   lng: 31.32  },
        { lat: 30.025, lng: 31.315 },
      ],
    },

    // Branch: Masakin Al-Dhubbat (Fatima Al-Zahraa St., Nasr City)
    "masakin-dhabbat": {
      points: [
        { lat: 30.063, lng: 31.37  },
        { lat: 30.063, lng: 31.34  },
        { lat: 30.045, lng: 31.335 },
        { lat: 30.036, lng: 31.345 },
        { lat: 30.033, lng: 31.375 },
        { lat: 30.048, lng: 31.39  },
        { lat: 30.060, lng: 31.385 },
      ],
    },

    // Branch: Ismailia St. No. 14 (Zahraa Nasr City)
    "ismailia-14": {
      points: [
        { lat: 30.08,  lng: 31.395 },
        { lat: 30.08,  lng: 31.365 },
        { lat: 30.063, lng: 31.355 },
        { lat: 30.052, lng: 31.36  },
        { lat: 30.05,  lng: 31.39  },
        { lat: 30.062, lng: 31.408 },
        { lat: 30.075, lng: 31.405 },
      ],
    },

    // Branch: Ismailia St. No. 13 (Zahraa Nasr City)
    "ismailia-13": {
      points: [
        { lat: 30.082, lng: 31.398 },
        { lat: 30.082, lng: 31.368 },
        { lat: 30.066, lng: 31.358 },
        { lat: 30.055, lng: 31.363 },
        { lat: 30.053, lng: 31.392 },
        { lat: 30.065, lng: 31.41  },
        { lat: 30.078, lng: 31.408 },
      ],
    },
  };

  const branches = [
    {
      id: "gardenia",
      nameAr: "صيدليات المتحدة - جاردينيا سيتي",
      nameEn: "United Pharmacies - Gardenia City",
      governorate: "Cairo",
      area: "القاهرة الجديدة",
      address: "محل B1 مول CITY WALK كومباوند جاردينيا سيتي",
      lat: 30.0827,
      lng: 31.3853,
      mapEmbedSrc:
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3452.31!2d31.3853!3d30.0827!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDA0JzU3LjciTiAzMcKwMjMnMDcuMSJF!5e0!3m2!1sen!2seg!4v1",
      isActive: true,
    },
    {
      id: "maadi",
      nameAr: "صيدليات المتحدة - المعادي",
      nameEn: "United Pharmacies - Maadi",
      governorate: "Cairo",
      area: "المعادي",
      address: "ش فلسطين، بندر مول، المعادي، القاهرة",
      lat: 30.0146,
      lng: 31.2824,
      mapEmbedSrc:
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3454.8!2d31.2824!3d30.0146!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDAwJzUyLjYiTiAzMcKwMTYnNTYuNiJF!5e0!3m2!1sen!2seg!4v1",
      isActive: true,
    },
    {
      id: "masakin-dhabbat",
      nameAr: "صيدليات المتحدة - مساكن الظباط",
      nameEn: "United Pharmacies - Masakin Al-Dhubbat",
      governorate: "Cairo",
      area: "مدينة نصر",
      address: "عمارة 336 شارع فاطمة الزهراء متفرع من الميثاق",
      lat: 30.0520,
      lng: 31.3550,
      mapEmbedSrc:
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3453.3!2d31.3550!3d30.0520!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDAzJzA3LjIiTiAzMcKwMjEnMTguMCJF!5e0!3m2!1sen!2seg!4v1",
      isActive: true,
    },
    {
      id: "ismailia-14",
      nameAr: "صيدليات المتحدة - شارع الاسماعيليه ١٤",
      nameEn: "United Pharmacies - Ismailia St. No. 14",
      governorate: "Cairo",
      area: "مدينة نصر",
      address: "١٤ ش الأسماعيلية متفرع من شارع الميثاق، زهراء مدينة نصر",
      lat: 30.0650,
      lng: 31.3780,
      mapEmbedSrc:
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3452.9!2d31.3780!3d30.0650!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDAzJzU0LjAiTiAzMcKwMjInNDAuOCJF!5e0!3m2!1sen!2seg!4v1",
      isActive: true,
    },
    {
      id: "ismailia-13",
      nameAr: "صيدليات المتحدة - شارع الاسماعيليه ١٣",
      nameEn: "United Pharmacies - Ismailia St. No. 13",
      governorate: "Cairo",
      area: "مدينة نصر",
      address: "١٣ ش الأسماعيلية متفرع من شارع الميثاق، زهراء مدينة نصر",
      lat: 30.0655,
      lng: 31.3785,
      mapEmbedSrc:
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3452.9!2d31.3785!3d30.0655!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDAzJzU1LjgiTiAzMcKwMjInNDIuNiJF!5e0!3m2!1sen!2seg!4v1",
      isActive: true,
    },
  ] as const;

  const allowedBranchIds = branches.map((branch) => branch.id);

  for (const branch of branches) {
    await prisma.branch.upsert({
      where: { id: branch.id },
      create: branch,
      update: branch,
    });

    await prisma.deliveryZone.upsert({
      where: { id: `${branch.id}-zone-1` },
      create: {
        id: `${branch.id}-zone-1`,
        branchId: branch.id,
        name: "Primary Zone",
        polygon: zoneByBranchId[branch.id] ?? bboxPolygon(expandBox({
          minLat: branch.lat,
          maxLat: branch.lat,
          minLng: branch.lng,
          maxLng: branch.lng,
        }, { lat: 0.02, lng: 0.02 })),
        baseFee: 25,
        freeAboveSubtotal: 500,
        surgeStartHour: 0,
        surgeEndHour: 6,
        surgeMultiplier: 1.25,
      },
      update: {
        polygon: zoneByBranchId[branch.id] ?? bboxPolygon(expandBox({
          minLat: branch.lat,
          maxLat: branch.lat,
          minLng: branch.lng,
          maxLng: branch.lng,
        }, { lat: 0.02, lng: 0.02 })),
        baseFee: 25,
        freeAboveSubtotal: 500,
        surgeStartHour: 0,
        surgeEndHour: 6,
        surgeMultiplier: 1.25,
      },
    });
  }

  // Remove any deprecated / out-of-scope branches that may already exist in the DB.
  // Delivery zones are removed automatically via onDelete: Cascade.
  await prisma.branch.deleteMany({
    where: {
      id: { notIn: allowedBranchIds },
    },
  });

  await prisma.$disconnect();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
