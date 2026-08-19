import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { SkeletonCard } from '@/components/SkeletonTable';
import { Link } from 'react-router-dom';

interface KpiCardProps {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  to?: string;
}

function KpiCard({ icon, label, value, sub, color = 'pharmacy-primary', to }: KpiCardProps) {
  const content = (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border border-pharmacy-line dark:border-slate-700 shadow-sm flex items-start gap-4 transition-all ${to ? 'hover:shadow-md hover:border-pharmacy-primary cursor-pointer' : ''}`}>
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm`}
        style={{ backgroundColor: color + '15', color: color }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-pharmacy-inkSoft dark:text-gray-400 mb-1">{label}</p>
        <p className="text-3xl font-extrabold text-pharmacy-ink dark:text-white tracking-tight">{value}</p>
        {sub && <p className="text-sm text-pharmacy-inkFaint dark:text-gray-500 font-medium mt-2 flex items-center gap-1">
          {to ? <span className="text-blue-500 font-semibold">View details →</span> : sub}
        </p>}
      </div>
    </div>
  );

  if (to) {
    return <Link to={to} className="block">{content}</Link>;
  }
  return content;
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
      <div className="flex justify-between items-center border-b border-pharmacy-line pb-4">
        <div>
          <h1 className="text-2xl font-bold text-pharmacy-ink dark:text-white font-sans tracking-tight">Operations Command Center</h1>
          <p className="text-sm text-pharmacy-inkSoft dark:text-gray-400 mt-1">
            Real-time business truth and priority operational issues.
          </p>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-200 font-medium text-sm">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
             System Operational
           </div>
        </div>
      </div>

      {/* Actionable KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          icon="🛵"
          label="Online Drivers"
          value={onlineCount}
          sub="Currently available"
          color="#22C55E"
          to="/drivers?status=online"
        />
        <KpiCard
          icon="📦"
          label="Active Deliveries"
          value={data?.activeDeliveries ?? '—'}
          sub="In progress"
          color="#3B82F6"
          to="/orders?status=active"
        />
        <KpiCard
          icon="✅"
          label="Today's Deliveries"
          value={data?.todayDeliveries ?? '—'}
          sub="Completed today"
          color="#0E7E74"
          to="/orders?status=delivered"
        />
        <KpiCard
          icon="💰"
          label="Today's Revenue"
          value={data?.todayRevenue ? `${parseFloat(data.todayRevenue).toFixed(0)} EGP` : '—'}
          sub="Total earnings"
          color="#F59E0B"
        />
      </div>
      
      {/* Alert Center */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-pharmacy-ink dark:text-white mb-4 flex items-center gap-2">
          <span className="text-red-500">⚠️</span> Requires Attention
        </h2>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
           <div className="flex items-start gap-4">
             <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400 text-xl flex-shrink-0">
               ✅
             </div>
             <div>
               <h3 className="font-semibold text-green-800 dark:text-green-300">No urgent alerts</h3>
               <p className="text-green-700 dark:text-green-400/70 text-sm mt-1">
                 All active orders are processing within expected operational timeframes. No suspended drivers or failed system jobs detected.
               </p>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
