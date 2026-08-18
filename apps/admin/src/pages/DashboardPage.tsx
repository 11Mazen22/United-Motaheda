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

function KpiCard({ icon, label, value, sub, color = 'pharmacy-primary' }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-pharmacy-line dark:border-slate-700 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm`}
        style={{ backgroundColor: color + '15', color: color }}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-pharmacy-inkSoft dark:text-gray-400 mb-1">{label}</p>
        <p className="text-3xl font-extrabold text-pharmacy-ink dark:text-white tracking-tight">{value}</p>
        {sub && <p className="text-sm text-pharmacy-inkFaint dark:text-gray-500 font-medium mt-2 flex items-center gap-1">
          <span className="text-green-500">↑</span> {sub}
        </p>}
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
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={2} />)}
        </div>
      </div>
    );
  }

  const onlineCount = driversData?.totalOnlineDrivers ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-pharmacy-ink dark:text-white font-sans tracking-tight">Overview</h1>
        <p className="text-sm text-pharmacy-inkSoft dark:text-gray-400 mt-1">
          Real-time driver operations and performance metrics
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-pharmacy-line dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-pharmacy-line dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-bold text-pharmacy-ink dark:text-white">
              Online Drivers
            </h3>
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {onlineCount} Active
            </span>
          </div>
          <div className="p-6 flex-1 overflow-y-auto max-h-[400px]">
            {(driversData?.drivers ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                <span className="text-4xl mb-3 opacity-50">📴</span>
                <p className="text-pharmacy-inkSoft text-sm font-medium">No drivers currently online</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(driversData?.drivers ?? []).slice(0, 8).map((d: any) => (
                  <div key={d.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-pharmacy-canvas dark:hover:bg-slate-700/50 transition-colors border border-transparent hover:border-pharmacy-line">
                    <div className="w-10 h-10 rounded-full bg-pharmacy-primary/10 flex items-center justify-center text-pharmacy-primary text-sm font-bold shadow-sm">
                      {d.fullName?.[0] ?? 'D'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-pharmacy-ink dark:text-white truncate">
                        {d.fullName}
                      </p>
                      <p className="text-xs text-pharmacy-inkSoft mt-0.5">{d.vehicleType} · {d.vehiclePlate}</p>
                    </div>
                    <span className="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                      Online
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-pharmacy-line dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-pharmacy-line dark:border-slate-700">
            <h3 className="text-lg font-bold text-pharmacy-ink dark:text-white">
              Quick Actions
            </h3>
          </div>
          <div className="p-6 grid grid-cols-1 gap-4">
            {[
              { label: 'View Live Map', desc: 'Track all drivers in real-time', href: '/map', icon: '🗺️', color: 'bg-blue-50 text-blue-600' },
              { label: 'Manage Drivers', desc: 'Approve or suspend accounts', href: '/drivers', icon: '👥', color: 'bg-purple-50 text-purple-600' },
              { label: 'View Orders', desc: 'Assign orders and track status', href: '/orders', icon: '📦', color: 'bg-orange-50 text-orange-600' },
              { label: 'Send Notification', desc: 'Broadcast a message to drivers', href: '/notifications', icon: '📢', color: 'bg-teal-50 text-teal-600' },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center gap-4 p-4 rounded-xl border border-pharmacy-line dark:border-slate-600 hover:border-pharmacy-primary hover:shadow-md transition-all group bg-pharmacy-canvas/50"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${item.color} shadow-sm group-hover:scale-110 transition-transform`}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <span className="block text-sm font-bold text-pharmacy-ink dark:text-gray-100 group-hover:text-pharmacy-primary transition-colors">
                    {item.label}
                  </span>
                  <span className="block text-xs text-pharmacy-inkSoft mt-1">
                    {item.desc}
                  </span>
                </div>
                <span className="text-pharmacy-inkFaint group-hover:text-pharmacy-primary group-hover:translate-x-1 transition-all">→</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
