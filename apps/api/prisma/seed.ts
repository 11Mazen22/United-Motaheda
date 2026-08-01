/**
 * Seed: United Pharmacies branches + delivery zones
 *
 * Fee model — distance-based tiered pricing:
 *   ≤ 2 km  → 15 EGP  (walkable — essentially nearby)
 *   ≤ 5 km  → 20 EGP  (standard inner zone)
 *   ≤ 8 km  → 25 EGP  (mid zone)
 *   ≤ 12 km → 35 EGP  (outer zone)
 *
 * The Railway delivery service uses polygon zone matching.
 * Each branch has multiple concentric zones — the smallest matching
 * zone wins, so the customer always pays the lowest applicable fee.
 *
 * Free delivery threshold: 500 EGP subtotal on all zones.
 * Surge: midnight–6am ×1.25 multiplier (late-night premium).
 */

import { PrismaClient } from "@prisma/client";

type Coordinates = { lat: number; lng: number };
type Polygon = { points: Coordinates[] };

/** Build a circular approximation polygon around a center point.
 *  radiusKm: delivery radius in kilometres.
 *  steps: number of polygon vertices (more = smoother circle). */
function circlePolygon(center: Coordinates, radiusKm: number, steps = 16): Polygon {
  const points: Coordinates[] = [];
  // 1 degree latitude ≈ 111 km; 1 degree longitude ≈ 111 km × cos(lat)
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180));

  for (let i = 0; i < steps; i++) {
    const angle = (2 * Math.PI * i) / steps;
    points.push({
      lat: center.lat + latDelta * Math.sin(angle),
      lng: center.lng + lngDelta * Math.cos(angle),
    });
  }
  return { points };
}

/** Google Maps embed URL — uses the place search endpoint with coordinates.
 *  Works without an API key for basic embed display. */
function mapsEmbed(lat: number, lng: number, name: string): string {
  const q = encodeURIComponent(`${name}`);
  return `https://maps.google.com/maps?q=${lat},${lng}&t=&z=17&ie=UTF8&iwloc=&output=embed`;
}

async function main() {
  const prisma = new PrismaClient();

  const branches = [
    {
      id:          "gardenia",
      nameAr:      "صيدليات المتحدة - جاردينيا سيتي",
      nameEn:      "United Pharmacies - Gardenia City",
      governorate: "Cairo",
      area:        "القاهرة الجديدة",
      address:     "محل B1 مول CITY WALK كومباوند جاردينيا سيتي، القاهرة الجديدة",
      lat:         30.0827,
      lng:         31.3853,
      mapEmbedSrc: mapsEmbed(30.0827, 31.3853, "United Pharmacies Gardenia City"),
      isActive:    true,
    },
    {
      id:          "maadi",
      nameAr:      "صيدليات المتحدة - المعادي",
      nameEn:      "United Pharmacies - Maadi",
      governorate: "Cairo",
      area:        "المعادي",
      address:     "ش فلسطين، بندر مول، المعادي، القاهرة",
      lat:         30.0146,
      lng:         31.2824,
      mapEmbedSrc: mapsEmbed(30.0146, 31.2824, "United Pharmacies Maadi"),
      isActive:    true,
    },
    {
      id:          "masakin-dhabbat",
      nameAr:      "صيدليات المتحدة - مساكن الضباط ١",
      nameEn:      "United Pharmacies - Masakin Al-Dabbat 1",
      governorate: "Cairo",
      area:        "مدينة نصر",
      address:     "عمارة 336 شارع فاطمة الزهراء متفرع من الميثاق، مدينة نصر",
      lat:         30.0520,
      lng:         31.3550,
      mapEmbedSrc: mapsEmbed(30.0520, 31.3550, "United Pharmacies Masakin Al-Dabbat"),
      isActive:    true,
    },
    {
      id:          "masakin-dhabbat-2",
      nameAr:      "صيدليات المتحدة - مساكن الضباط ٢",
      nameEn:      "United Pharmacies - Masakin Al-Dabbat 2",
      governorate: "Cairo",
      area:        "مدينة نصر",
      address:     "عمارة 340 شارع فاطمة الزهراء متفرع من الميثاق، مدينة نصر",
      lat:         30.0525,
      lng:         31.3558,
      mapEmbedSrc: mapsEmbed(30.0525, 31.3558, "United Pharmacies Masakin Al-Dabbat 2"),
      isActive:    true,
    },
    {
      id:          "ismailia-14",
      nameAr:      "صيدليات المتحدة - شارع الاسماعيليه ١٤",
      nameEn:      "United Pharmacies - Ismailia St. No. 14",
      governorate: "Cairo",
      area:        "مدينة نصر",
      address:     "١٤ ش الأسماعيلية متفرع من شارع الميثاق، زهراء مدينة نصر",
      lat:         30.0650,
      lng:         31.3780,
      mapEmbedSrc: mapsEmbed(30.0650, 31.3780, "United Pharmacies Ismailia 14"),
      isActive:    true,
    },
    {
      id:          "ismailia-13",
      nameAr:      "صيدليات المتحدة - شارع الاسماعيليه ١٣",
      nameEn:      "United Pharmacies - Ismailia St. No. 13",
      governorate: "Cairo",
      area:        "مدينة نصر",
      address:     "١٣ ش الأسماعيلية متفرع من شارع الميثاق، زهراء مدينة نصر",
      lat:         30.0655,
      lng:         31.3785,
      mapEmbedSrc: mapsEmbed(30.0655, 31.3785, "United Pharmacies Ismailia 13"),
      isActive:    true,
    },
  ] as const;

  // Distance-based fee tiers (radius km → base fee EGP)
  const feeTiers = [
    { radiusKm: 2,  baseFee: 15, name: "Zone A — Nearby (≤2 km)"    },
    { radiusKm: 5,  baseFee: 20, name: "Zone B — Standard (≤5 km)"  },
    { radiusKm: 8,  baseFee: 25, name: "Zone C — Mid-range (≤8 km)" },
    { radiusKm: 12, baseFee: 35, name: "Zone D — Outer (≤12 km)"    },
  ];

  const allowedBranchIds = branches.map((b) => b.id);

  for (const branch of branches) {
    // Upsert branch
    await prisma.branch.upsert({
      where:  { id: branch.id },
      create: branch,
      update: branch,
    });

    // Delete existing zones to recreate cleanly
    await prisma.deliveryZone.deleteMany({ where: { branchId: branch.id } });

    // Create concentric distance-based zones
    for (const tier of feeTiers) {
      await prisma.deliveryZone.create({
        data: {
          id:               `${branch.id}-zone-${tier.radiusKm}km`,
          branchId:         branch.id,
          name:             tier.name,
          polygon:          circlePolygon({ lat: branch.lat, lng: branch.lng }, tier.radiusKm),
          baseFee:          tier.baseFee,
          freeAboveSubtotal:500,   // Free delivery on orders ≥ 500 EGP
          surgeStartHour:   0,     // Midnight
          surgeEndHour:     6,     // 6 AM
          surgeMultiplier:  1.25,  // +25% late-night surcharge
        },
      });
    }
  }

  // Remove deprecated branches
  await prisma.branch.deleteMany({ where: { id: { notIn: allowedBranchIds } } });

  console.log("✅ Seeded", branches.length, "branches with distance-based delivery zones");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
