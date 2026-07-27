import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { SkeletonCard } from '@/components/SkeletonTable';

interface KpiCardProps {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

function KpiCard({ icon, label, value, sub, color = 'brand' }: KpiCardProps) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}
        style={{ backgroundColor: color + '20' }}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        {sub && <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.getDashboardStats,
    refetchInterval: 30_000,
  });

  const { data: driversData } = useQuery({
    queryKey: ['admin', 'drivers', 'online'],
    queryFn: adminApi.getOnlineDriversLocations,
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={2} />)}
      </div>
    );
  }

  const onlineCount = driversData?.totalOnlineDrivers ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Real-time operations overview
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon="🟢"
          label="Online Drivers"
          value={onlineCount}
          sub="Currently available"
          color="#22C55E"
        />
        <KpiCard
          icon="🚚"
          label="Active Deliveries"
          value={data?.activeDeliveries ?? '—'}
          sub="In progress"
          color="#3B82F6"
        />
        <KpiCard
          icon="📦"
          label="Today's Deliveries"
          value={data?.todayDeliveries ?? '—'}
          sub="Completed today"
          color="#0E7E74"
        />
        <KpiCard
          icon="💰"
          label="Today's Revenue"
          value={data?.todayRevenue ? `${parseFloat(data.todayRevenue).toFixed(0)} EGP` : '—'}
          sub="Total earnings"
          color="#F59E0B"
        />
      </div>

      {/* Recent activity placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
            Online Drivers
          </h3>
          {(driversData?.drivers ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No drivers online</p>
          ) : (
            <div className="space-y-3">
              {(driversData?.drivers ?? []).slice(0, 8).map((d: any) => (
                <div key={d.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold">
                    {d.fullName?.[0] ?? 'D'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {d.fullName}
                    </p>
                    <p className="text-xs text-gray-500">{d.vehicleType} · {d.vehiclePlate}</p>
                  </div>
                  <span className="badge badge-success">Online</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h3>
          <div className="space-y-2">
            {[
              { label: 'View Live Map', href: '/map', icon: '🗺️' },
              { label: 'Manage Drivers', href: '/drivers', icon: '👥' },
              { label: 'View Orders', href: '/orders', icon: '📦' },
              { label: 'Send Notification', href: '/notifications', icon: '📢' },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {item.label}
                </span>
                <span className="ml-auto text-gray-400">→</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
