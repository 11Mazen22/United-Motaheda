import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '@/lib/api';
import { getAdminSupabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { SkeletonTable } from '@/components/SkeletonTable';

const ROLE_FILTERS = ['All', 'customer', 'driver', 'pharmacist', 'admin', 'manager'];

const roleBadge = (role: string) => {
  const map: Record<string, string> = {
    admin: 'badge-error',
    manager: 'badge-error',
    driver: 'badge-info',
    pharmacist: 'badge-success',
    customer: 'badge-neutral',
  };
  return map[role] ?? 'badge-neutral';
};

interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: string;
  branch_id: string | null;
}

interface Branch {
  id: string;
  nameEn: string;
  nameAr?: string;
}

function StaffActionPanel({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState(profile.branch_id ?? '');

  const branchesQ = useQuery({
    queryKey: ['admin', 'branches', 'all'],
    queryFn: () => marketingApi.getBranches(1, 200),
    staleTime: 5 * 60_000,
  });
  const branches: Branch[] = branchesQ.data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] });

  const makeDriverMutation = useMutation({
    mutationFn: () => marketingApi.createDriver(profile.id),
    onSuccess: () => {
      showToast(`${profile.full_name || 'User'} is now a driver`, 'success');
      invalidate();
      onClose();
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? 'Failed to create driver', 'error'),
  });

  const setPharmacistMutation = useMutation({
    mutationFn: async () => {
      const sb = getAdminSupabase();
      const { data, error } = await sb.rpc('admin_set_staff_role', {
        p_user_id: profile.id,
        p_role: 'pharmacist',
        p_branch_id: selectedBranch,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      showToast(`${profile.full_name || 'User'} is now a pharmacist`, 'success');
      invalidate();
      onClose();
    },
    onError: (err: any) => showToast(err?.message ?? 'Failed to assign pharmacist role', 'error'),
  });

  const revertToCustomerMutation = useMutation({
    mutationFn: async () => {
      const sb = getAdminSupabase();
      const { data, error } = await sb.rpc('admin_set_staff_role', {
        p_user_id: profile.id,
        p_role: 'customer',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      showToast(`${profile.full_name || 'User'} reverted to customer`, 'info');
      invalidate();
      onClose();
    },
    onError: (err: any) => showToast(err?.message ?? 'Failed to revert role', 'error'),
  });

  const isProtected = profile.role === 'admin' || profile.role === 'manager';
  const anyPending =
    makeDriverMutation.isPending || setPharmacistMutation.isPending || revertToCustomerMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-pharmacy-line dark:border-slate-700">
          <div>
            <h2 className="font-bold text-pharmacy-ink dark:text-white">{profile.full_name || 'Unnamed'}</h2>
            <p className="text-sm text-pharmacy-inkSoft">{profile.phone || profile.email || profile.id}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-pharmacy-inkSoft text-xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-pharmacy-inkSoft">Current role</span>
            <span className={roleBadge(profile.role)}>{profile.role}</span>
          </div>

          {isProtected ? (
            <p className="text-sm text-pharmacy-inkSoft">
              Admin/manager accounts aren't changed from here — that stays a manual operation.
            </p>
          ) : (
            <>
              {profile.role !== 'driver' && (
                <button
                  onClick={() => makeDriverMutation.mutate()}
                  disabled={anyPending}
                  className="btn-primary w-full disabled:opacity-60"
                >
                  {makeDriverMutation.isPending ? 'Creating…' : '🚗 Make Driver'}
                </button>
              )}

              <div className="card p-3 space-y-2">
                <p className="text-xs text-pharmacy-inkSoft">Branch</p>
                <select
                  className="input w-full"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  <option value="">Select a branch…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.nameEn}</option>
                  ))}
                </select>
                <button
                  onClick={() => setPharmacistMutation.mutate()}
                  disabled={anyPending || !selectedBranch}
                  className="btn-primary w-full disabled:opacity-60"
                >
                  {setPharmacistMutation.isPending
                    ? 'Assigning…'
                    : profile.role === 'pharmacist'
                      ? '💊 Reassign Branch'
                      : '💊 Make Pharmacist'}
                </button>
              </div>

              {(profile.role === 'driver' || profile.role === 'pharmacist') && (
                <button
                  onClick={() => revertToCustomerMutation.mutate()}
                  disabled={anyPending}
                  className="btn-danger w-full disabled:opacity-60"
                >
                  {revertToCustomerMutation.isPending ? 'Reverting…' : 'Revert to Customer'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function StaffPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [selected, setSelected] = useState<Profile | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'staff', page, search, roleFilter],
    queryFn: () =>
      marketingApi.getCustomers(page, 20, search || undefined, roleFilter === 'All' ? undefined : roleFilter),
    staleTime: 15_000,
  });

  const profiles: Profile[] = data?.data ?? [];
  const totalPages: number = data?.totalPages ?? 1;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-pharmacy-ink dark:text-white">Staff</h1>
        <p className="text-sm text-pharmacy-inkSoft dark:text-gray-400 mt-1">
          Find an existing account and make it a driver or pharmacist — no commands needed.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          className="input flex-1"
          placeholder="Search by name, phone, or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              onClick={() => { setRoleFilter(r); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                roleFilter === r
                  ? 'bg-pharmacy-primary text-white'
                  : 'bg-pharmacy-canvas dark:bg-slate-700 text-pharmacy-inkSoft dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {r === 'All' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={8} cols={4} />
        ) : isError ? (
          <div className="px-4 py-12 text-center text-sm text-red-500">
            {error instanceof Error ? error.message : 'Unable to load accounts'}
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-pharmacy-canvas dark:bg-slate-700">
                  {['Name', 'Contact', 'Role', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-pharmacy-inkSoft dark:text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">
                      No accounts found
                    </td>
                  </tr>
                ) : (
                  profiles.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-pharmacy-canvas dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      onClick={() => setSelected(p)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-pharmacy-primary flex items-center justify-center text-white text-xs font-bold">
                            {(p.full_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold text-pharmacy-ink dark:text-white">
                            {p.full_name || 'Unnamed'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-pharmacy-inkSoft dark:text-gray-400">
                        {p.phone || p.email || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={roleBadge(p.role)}>{p.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-pharmacy-primary hover:text-pharmacy-primaryDark text-sm font-medium">
                          Manage →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-pharmacy-line dark:border-slate-700">
                <p className="text-sm text-pharmacy-inkSoft">Page {page} of {totalPages}</p>
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

      {selected && <StaffActionPanel profile={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
