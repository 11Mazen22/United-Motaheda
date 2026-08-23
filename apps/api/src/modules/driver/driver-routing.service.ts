import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface DriverRoutePoint {
  latitude: number;
  longitude: number;
}

export interface DriverRouteResult {
  polyline: DriverRoutePoint[];
  durationMin: number;
  distanceKm: number;
}

@Injectable()
export class DriverRoutingService {
  async route(
    origin: DriverRoutePoint,
    destination: DriverRoutePoint,
  ): Promise<DriverRouteResult> {
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('Routing service is not configured');
    }

    const waypoints = `${origin.latitude},${origin.longitude}|${destination.latitude},${destination.longitude}`;
    const url = new URL('https://api.geoapify.com/v1/routing');
    url.searchParams.set('waypoints', waypoints);
    url.searchParams.set('mode', 'drive');
    url.searchParams.set('apiKey', apiKey);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException('Routing provider is unavailable');
    }

    const payload = (await response.json()) as {
      features?: Array<{
        geometry?: { coordinates?: Array<[number, number]> };
        properties?: { time?: number; distance?: number };
      }>;
    };

    const feature = payload.features?.[0];
    const coordinates = feature?.geometry?.coordinates ?? [];
    if (!coordinates.length) {
      throw new ServiceUnavailableException('No route was returned');
    }

    return {
      polyline: coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
      durationMin: Math.max(1, Math.ceil((feature?.properties?.time ?? 0) / 60)),
      distanceKm: Number(((feature?.properties?.distance ?? 0) / 1000).toFixed(1)),
    };
  }
}
