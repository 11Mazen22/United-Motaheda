import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { adminSocket } from '@/lib/socket';
import { getAdminSupabase } from '@/lib/supabase';
import { SkeletonCard } from '@/components/SkeletonTable';

// Fix leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom driver marker
function createDriverIcon(status: string) {
  const color =
    status === 'ACTIVE' ? '#0E7E74'
    : status === 'ASSIGNED' ? '#3B82F6'
    : '#6B7280';

  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:36px;height:36px;border-radius:50%;
        background:${color};border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:16px;
      ">🚗</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

interface Driver {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string;
  currentLat: number;
  currentLng: number;
  lastLocationAt: string;
  status: string;
}

// Recenter map when there are drivers
function MapController({ drivers }: { drivers: Driver[] }) {
  const map = useMap();
  useEffect(() => {
    if (drivers.length > 0) {
      const bounds = L.latLngBounds(
        drivers.map((d) => [d.currentLat, d.currentLng] as [number, number]),
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [drivers.length]);
  return null;
}

const STATUS_FILTER_OPTIONS = ['All', 'ACTIVE', 'ASSIGNED', 'APPROVED'];

export function MapPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'drivers', 'online'],
    queryFn: adminApi.getOnlineDriversLocations,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (data) setDrivers((data as { drivers?: Driver[] }).drivers ?? []);
  }, [data]);

  // Real-time location updates via WebSocket
  useEffect(() => {
    const supabase = getAdminSupabase();
    const locationChannel = supabase
      .channel('admin-driver-locations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'driver_locations' },
        ({ new: location }) => {
          const row = location as {
            driver_id?: string;
            lat?: number;
            lng?: number;
            captured_at?: string;
          };
          if (!row.driver_id || typeof row.lat !== 'number' || typeof row.lng !== 'number') return;

          setDrivers((prev) => prev.map((driver) => (
            driver.userId === row.driver_id || driver.id === row.driver_id
              ? {
                  ...driver,
                  currentLat: row.lat!,
                  currentLng: row.lng!,
                  lastLocationAt: row.captured_at ?? new Date().toISOString(),
                }
              : driver
          )));
        },
      )
      .subscribe();

    const unsub = adminSocket.on<any>('driver-location-update', (update) => {
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === update.driverId
            ? { ...d, currentLat: update.currentLat, currentLng: update.currentLng, lastLocationAt: update.lastLocationAt }
            : d,
        ),
      );
    });

    const unsubStatus = adminSocket.on<any>('driver-status-change', (update) => {
      setDrivers((prev) =>
        update.isOnline
          ? prev.some((d) => d.id === update.driverId)
            ? prev.map((d) => d.id === update.driverId ? { ...d, status: update.status } : d)
            : [...prev, { id: update.driverId, userId: update.userId, fullName: update.fullName, vehicleType: update.vehicleType, vehiclePlate: update.vehiclePlate, currentLat: 0, currentLng: 0, lastLocationAt: new Date().toISOString(), status: update.status, phone: '' }]
          : prev.filter((d) => d.id !== update.driverId),
      );
    });

    return () => {
      void supabase.removeChannel(locationChannel);
      unsub();
      unsubStatus();
    };
  }, []);

  const filteredDrivers = drivers.filter(
    (d) => statusFilter === 'All' || d.status === statusFilter,
  );

  return (
    <div className="flex h-full">
      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={[30.0444, 31.2357]}
          zoom={11}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController drivers={filteredDrivers.filter((d) => d.currentLat && d.currentLng)} />

          {filteredDrivers.map((driver) => {
            if (!driver.currentLat || !driver.currentLng) return null;
            return (
              <Marker
                key={driver.id}
                position={[driver.currentLat, driver.currentLng]}
                icon={createDriverIcon(driver.status)}
                eventHandlers={{ click: () => setSelectedDriver(driver) }}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold">{driver.fullName}</p>
                    <p className="text-gray-500">{driver.vehicleType} · {driver.vehiclePlate}</p>
                    <p className="text-gray-500">{driver.phone}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      driver.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {driver.status}
                    </span>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Status filter overlay */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex gap-2">
          {STATUS_FILTER_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-md transition-colors ${
                statusFilter === s
                  ? 'bg-brand-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Online count */}
        <div className="absolute top-4 right-4 z-[1000] bg-white rounded-xl shadow-md px-3 py-2">
          <p className="text-xs text-gray-500">Online Drivers</p>
          <p className="text-xl font-extrabold text-brand-600">{filteredDrivers.length}</p>
        </div>
      </div>

      {/* Driver sidebar */}
      <div className="w-72 flex-shrink-0 bg-white dark:bg-slate-800 border-l border-gray-100 dark:border-slate-700 overflow-y-auto">
        <div className="p-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="font-bold text-gray-900 dark:text-white">
            Active Drivers ({filteredDrivers.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={2} />)}
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <div className="text-3xl mb-2">🌙</div>
            <p className="text-sm">No drivers online</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-700">
            {filteredDrivers.map((driver) => (
              <div
                key={driver.id}
                className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                  selectedDriver?.id === driver.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''
                }`}
                onClick={() => setSelectedDriver(selectedDriver?.id === driver.id ? null : driver)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {driver.fullName?.[0] ?? 'D'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {driver.fullName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {driver.vehicleType} · {driver.vehiclePlate}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
