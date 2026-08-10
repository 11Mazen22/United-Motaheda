import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { showToast } from '@/components/Toast';
import { SkeletonTable } from '@/components/SkeletonTable';

const STATUS_OPTIONS = ['All', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'REJECTED'];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ACTIVE: 'badge-success',
    APPROVED: 'badge-info',
    PENDING_APPROVAL: 'badge-warning',
    SUSPENDED: 'badge-error',
    REJECTED: 'badge-error',
    INACTIVE: 'badge-neutral',
  };
  return map[status] ?? 'badge-neutral';
};

interface Driver {
  id: string;
  fullName: string;
  phone: string;
  driverProfile: {
    id: string;
    status: string;
    vehicleType: string;
    vehiclePlate: string;
    rating: string;
    totalDeliveries: number;
    totalEarnings: string;
    licensePhotoUrl: string | null;
    idPhotoUrl: string | null;
    vehiclePhotoUrl: string | null;
    insurancePhotoUrl: string | null;
    rejectionReason: string | null;
  };
}

function DriverModal({
  driver,
  onClose,
}: {
  driver: Driver;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showSuspendInput, setShowSuspendInput] = useState(false);
  const dp = driver.driverProfile;

  const approveMutation = useMutation({
    mutationFn: () => adminApi.approveDriver(dp.id),
    onSuccess: () => {
      showToast('Driver approved!', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
      onClose();
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? 'Failed to approve', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => adminApi.rejectDriver(dp.id, rejectReason),
    onSuccess: () => {
      showToast('Driver rejected', 'info');
      queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
      onClose();
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? 'Failed to reject', 'error'),
  });

  const suspendMutation = useMutation({
    mutationFn: () => adminApi.suspendDriver(dp.id, suspendReason),
    onSuccess: () => {
      showToast('Driver suspended', 'info');
      queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
      onClose();
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? 'Failed to suspend', 'error'),
  });

  const docs = [
    { label: 'Driver License', url: dp.licensePhotoUrl },
    { label: 'National ID', url: dp.idPhotoUrl },
    { label: 'Vehicle Photo', url: dp.vehiclePhotoUrl },
    { label: 'Insurance', url: dp.insurancePhotoUrl },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-lg">
              {driver.fullName?.[0] ?? 'D'}
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">{driver.fullName}</h2>
              <p className="text-sm text-gray-500">{driver.phone}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Rating', value: parseFloat(dp.rating).toFixed(1) + ' ⭐' },
              { label: 'Deliveries', value: dp.totalDeliveries },
              { label: 'Earnings', value: parseFloat(dp.totalEarnings).toFixed(0) + ' EGP' },
            ].map(({ label, value }) => (
              <div key={label} className="card p-3 text-center">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Status + vehicle */}
          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <span className={statusBadge(dp.status)}>{dp.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Vehicle</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {dp.vehicleType} · {dp.vehiclePlate}
              </span>
            </div>
          </div>

          {/* Documents */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Documents</h3>
            <div className="grid grid-cols-2 gap-3">
              {docs.map(({ label, url }) => (
                <div key={label} className="card p-3">
                  <p className="text-xs text-gray-500 mb-2">{label}</p>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={label} className="w-full h-24 object-cover rounded-lg" />
                    </a>
                  ) : (
                    <div className="w-full h-24 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                      Not uploaded
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          {dp.status === 'PENDING_APPROVAL' && (
            <div className="space-y-3">
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="btn-primary w-full disabled:opacity-60"
              >
                {approveMutation.isPending ? 'Approving…' : '✓ Approve Driver'}
              </button>

              {!showRejectInput ? (
                <button
                  onClick={() => setShowRejectInput(true)}
                  className="btn-danger w-full"
                >
                  ✗ Reject Application
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    className="input"
                    placeholder="Rejection reason (required)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => rejectMutation.mutate()}
                      disabled={!rejectReason || rejectMutation.isPending}
                      className="btn-danger flex-1 disabled:opacity-60"
                    >
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(dp.status === 'APPROVED' || dp.status === 'ACTIVE') && (
            <div className="space-y-3">
              {!showSuspendInput ? (
                <button
                  onClick={() => setShowSuspendInput(true)}
                  className="btn-danger w-full"
                >
                  Suspend Driver
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    className="input"
                    placeholder="Suspension reason (required)"
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => suspendMutation.mutate()}
                      disabled={!suspendReason.trim() || suspendMutation.isPending}
                      className="btn-danger flex-1 disabled:opacity-60"
                    >
                      {suspendMutation.isPending ? 'Suspending…' : 'Confirm Suspend'}
                    </button>
                    <button onClick={() => setShowSuspendInput(false)} className="btn-secondary flex-1">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DriversPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'drivers', page, statusFilter],
    queryFn: () => adminApi.getAllDrivers(page, 20, statusFilter === 'All' ? undefined : statusFilter),
    staleTime: 30_000,
  });

  const drivers: Driver[] = data?.drivers ?? [];
  const totalPages: number = data?.totalPages ?? 1;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Drivers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage driver accounts and approvals
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              statusFilter === s
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={8} cols={6} />
        ) : isError ? (
          <div className="px-4 py-12 text-center text-sm text-red-500">
            {error instanceof Error ? error.message : 'Unable to load drivers'}
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700">
                  {['Name', 'Phone', 'Vehicle', 'Status', 'Rating', 'Deliveries', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                {drivers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                      No drivers found
                    </td>
                  </tr>
                ) : (
                  drivers.map((driver) => (
                    <tr
                      key={driver.id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      onClick={() => setSelectedDriver(driver)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold">
                            {driver.fullName?.[0]}
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {driver.fullName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{driver.phone}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {driver.driverProfile?.vehicleType} · {driver.driverProfile?.vehiclePlate}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadge(driver.driverProfile?.status)}>
                          {driver.driverProfile?.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        ⭐ {parseFloat(driver.driverProfile?.rating ?? '0').toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {driver.driverProfile?.totalDeliveries}
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-brand-500 hover:text-brand-600 text-sm font-medium">
                          View →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-700">
                <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary px-3 py-1 text-sm disabled:opacity-40"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-secondary px-3 py-1 text-sm disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Driver detail modal */}
      {selectedDriver && (
        <DriverModal driver={selectedDriver} onClose={() => setSelectedDriver(null)} />
      )}
    </div>
  );
}
