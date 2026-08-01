import { Injectable } from "@nestjs/common";
import type { DeliveryQuoteRequest, DeliveryStatus, Polygon } from "@pharmacy/contracts";
import { pointInPolygon } from "@pharmacy/contracts";
import { PrismaService } from "../../prisma/prisma.service";

function haversineDistanceKm(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(end.lat - start.lat);
  const deltaLng = toRad(end.lng - start.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRad(start.lat)) * Math.cos(toRad(end.lat)) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function buildEtaBand(distanceKm: number, loadFactor = 1) {
  // Cairo traffic model:
  //   Base prep time:  10 min (always)
  //   Drive speed:     ~25 km/h in city = 2.4 min/km
  //   Buffer:          +5 min for handover
  const driveMinutes = Math.round(distanceKm * 2.4);
  const baseMinutes  = 10 + driveMinutes + 5;
  const weighted     = Math.round(baseMinutes * Math.max(loadFactor, 1));
  return {
    minMinutes: weighted,
    maxMinutes: weighted + 15,
  };
}

function createToken(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function isCairoCoordinate(coordinates: { lat: number; lng: number }) {
  // Practical Greater Cairo bounding box used as a hard backend governorate lock.
  return (
    coordinates.lat >= 29.8
    && coordinates.lat <= 30.2
    && coordinates.lng >= 31.05
    && coordinates.lng <= 31.55
  );
}

function isWithinSurgeWindow(now: Date, startHour: number | null, endHour: number | null) {
  if (startHour == null || endHour == null) return false;
  const hour = now.getHours();
  if (startHour === endHour) return true;
  // window can wrap over midnight (e.g., 23 → 6)
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async findQuote(input: DeliveryQuoteRequest): Promise<{
    status: DeliveryStatus;
    matched:
      | {
          branch: Awaited<ReturnType<PrismaService["branch"]["findMany"]>>[number];
          zone: any;
      }
      | null;
  }> {
    const now = new Date();
    const updatedAt = now.toISOString();

    if (!isCairoCoordinate(input.coordinates)) {
      return {
        matched: null,
        status: {
          isDeliverable: false,
          cost: null,
          currency: "EGP",
          eta: null,
          branch: null,
          distanceKm: null,
          assignmentToken: null,
          quoteToken: null,
          zoneId: null,
          reasonCode: "OUT_OF_CAIRO",
          updatedAt,
        },
      };
    }

    const activeBranches = await this.prisma.branch.findMany({
      where: { isActive: true },
      include: { zones: true },
    });

    if (!activeBranches.length) {
      return {
        matched: null,
        status: {
          isDeliverable: false,
          cost: null,
          currency: "EGP",
          eta: null,
          branch: null,
          distanceKm: null,
          assignmentToken: null,
          quoteToken: null,
          zoneId: null,
          reasonCode: "NO_BRANCH",
          updatedAt,
        },
      };
    }

    const requested = input.requestedBranchId
      ? activeBranches.find((b) => b.id === input.requestedBranchId) ?? null
      : null;

    const candidates = requested ? [requested] : activeBranches;

    // Sort candidates by distance from user — nearest branch first.
    // This ensures the user is always served by the closest branch,
    // which also gives them the cheapest fee.
    const sortedCandidates = [...candidates].sort((a, b) =>
      haversineDistanceKm(input.coordinates, { lat: a.lat, lng: a.lng }) -
      haversineDistanceKm(input.coordinates, { lat: b.lat, lng: b.lng }),
    );

    let matched: { branch: typeof activeBranches[number]; zone: typeof activeBranches[number]["zones"][number] } | null =
      null;

    for (const branch of sortedCandidates) {
      // Sort zones by baseFee ascending — smallest zone (nearest) wins first.
      // This ensures a user 1.5 km away pays 15 EGP, not 35 EGP.
      const sortedZones = [...branch.zones].sort(
        (a, b) => Number(a.baseFee) - Number(b.baseFee),
      );
      for (const zone of sortedZones) {
        const polygon = zone.polygon as unknown as Polygon;
        if (polygon && Array.isArray((polygon as any).points) && pointInPolygon(input.coordinates, polygon)) {
          matched = { branch, zone };
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      return {
        matched: null,
        status: {
          isDeliverable: false,
          cost: null,
          currency: "EGP",
          eta: null,
          distanceKm: null,
          assignmentToken: null,
          quoteToken: null,
          zoneId: null,
          branch: requested
            ? {
                id: requested.id,
                nameAr: requested.nameAr,
                nameEn: requested.nameEn,
                governorate: "Cairo",
                area: requested.area,
                lat: requested.lat,
                lng: requested.lng,
                mapEmbedSrc: requested.mapEmbedSrc ?? undefined,
                isActive: requested.isActive,
              }
            : null,
          reasonCode: "OUT_OF_ZONE",
          updatedAt,
        },
      };
    }

    const distanceKm = haversineDistanceKm(input.coordinates, {
      lat: matched.branch.lat,
      lng: matched.branch.lng,
    });

    const eta = buildEtaBand(distanceKm, matched.branch.loadFactor ?? 1);

    const freeDeliveryApplied =
      matched.zone.freeAboveSubtotal != null && input.cart.subtotal >= matched.zone.freeAboveSubtotal;

    const surgeApplies = isWithinSurgeWindow(
      now,
      matched.zone.surgeStartHour,
      matched.zone.surgeEndHour,
    );

    const surgeMultiplier = surgeApplies ? matched.zone.surgeMultiplier ?? 1.25 : 1;

    const baseFee = matched.zone.baseFee;
    const computedFee = freeDeliveryApplied ? 0 : Math.round(baseFee * surgeMultiplier);

    return {
      matched,
      status: {
        isDeliverable: true,
        cost: computedFee,
        currency: "EGP",
        eta,
        distanceKm: Number(distanceKm.toFixed(2)),
        assignmentToken: createToken("assign"),
        quoteToken: createToken("quote"),
        branch: {
          id: matched.branch.id,
          nameAr: matched.branch.nameAr,
          nameEn: matched.branch.nameEn,
          governorate: "Cairo",
          area: matched.branch.area,
          lat: matched.branch.lat,
          lng: matched.branch.lng,
          mapEmbedSrc: matched.branch.mapEmbedSrc ?? undefined,
          isActive: matched.branch.isActive,
        },
        zoneId: matched.zone.id,
        reasonCode: "OK",
        breakdown: {
          baseFee,
          surgeMultiplier,
          freeDeliveryApplied,
        },
        updatedAt,
      },
    };
  }

  async quote(input: DeliveryQuoteRequest): Promise<DeliveryStatus> {
    const result = await this.findQuote(input);
    return result.status;
  }
}
