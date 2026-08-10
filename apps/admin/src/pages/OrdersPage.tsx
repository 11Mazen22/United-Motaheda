import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { getAdminSupabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { SkeletonTable } from '@/components/SkeletonTable';
import { formatDistanceToNow } from 'date-fns';

const STATUS_OPTIONS = ['All', 'pending', 'verification', 'payment_pending', 'payment_approved', 'preparing', 'ready', 'driver_assigned', 'driver_accepted', 'out_for_delivery', 'delivered', 'cancelled'];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ready: 'badge-warning',
    driver_assigned: 'badge-info',
    driver_accepted: 'badge-info',
    out_for_delivery: 'badge-info',
    delivered: 'badge-success',
    cancelled: 'badge-error',
    pending: 'badge-neutral',
  };
  return map[status] ?? 'badge-neutral';
};

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = getAdminSupabase();
    const channel = supabase
      .channel('admin-orders-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_assignments' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: driversData } = useQuery({
    queryKey: ['admin', 'drivers', 'assignable'],
    queryFn: () => adminApi.getAllDrivers(1, 100, 'APPROVED'),
    staleTime: 30_000,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => adminApi.updateOrderStatus(selectedOrder.id, status),
    onSuccess: (_data, status) => {
      showToast(`Order moved to ${status}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      setSelectedOrder((order: any) => order ? { ...order, status } : order);
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? 'Failed to update order', 'error'),
  });

  const assignmentMutation = useMutation({
    mutationFn: (driverId: string) => adminApi.assignOrder(selectedOrder.id, driverId),
    onSuccess: (_data, driverId) => {
      showToast('Driver assigned', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      setSelectedOrder((order: any) => order ? { ...order, assigned_driver_id: driverId, status: 'driver_assigned' } : order);
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? 'Failed to assign driver', 'error'),
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'orders', page, statusFilter],
    queryFn: () => adminApi.getAllOrders(page, 20, statusFilter === 'All' ? undefined : statusFilter),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const orders = data?.orders ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Track and manage all delivery orders
        </p>
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
          <SkeletonTable rows={10} cols={6} />
        ) : isError ? (
          <div className="px-4 py-12 text-center text-sm text-red-500">
            {error instanceof Error ? error.message : 'Unable to load orders'}
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700">
                  {['Order', 'Customer', 'Address', 'Driver', 'Status', 'Total', 'Time'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  orders.map((order: any) => (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
                        #{order.id?.slice(-8)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                        {order.customer_name ?? order.customerName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {order.customer_address ?? order.customerAddress}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {order.assigned_driver_id ? (
                          <span className="badge badge-info">Assigned</span>
                        ) : (
                          <span className="badge badge-neutral">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadge(order.status)}>{order.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                        {parseFloat(order.total ?? '0').toFixed(2)} EGP
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {order.created_at
                          ? formatDistanceToNow(new Date(order.created_at), { addSuffix: true })
                          : '—'}
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

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-700">
              <h2 className="font-bold text-gray-900 dark:text-white">
                Order #{selectedOrder.id?.slice(-8)}
              </h2>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Customer', value: selectedOrder.customer_name },
                { label: 'Phone', value: selectedOrder.customer_phone },
                { label: 'Address', value: selectedOrder.customer_address },
                { label: 'Status', value: selectedOrder.status },
                { label: 'Total', value: parseFloat(selectedOrder.total ?? '0').toFixed(2) + ' EGP' },
                { label: 'Payment', value: selectedOrder.payment_method },
                { label: 'Items', value: selectedOrder.order_items?.length ?? '—' },
                ...(selectedOrder.note ? [{ label: 'Note', value: selectedOrder.note }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-xs">
                    {value ?? '—'}
                  </span>
                </div>
              ))}

              <label className="block pt-3 border-t border-gray-100 dark:border-slate-700">
                <span className="text-sm text-gray-500">Change status</span>
                <select
                  className="input mt-1 w-full"
                  value={selectedOrder.status}
                  disabled={statusMutation.isPending}
                  onChange={(event) => statusMutation.mutate(event.target.value)}
                >
                  {[selectedOrder.status, ...STATUS_OPTIONS.filter((status) => status !== 'All' && status !== selectedOrder.status)].map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm text-gray-500">Assign driver</span>
                <select
                  className="input mt-1 w-full"
                  value={selectedOrder.assigned_driver_id ?? ''}
                  disabled={assignmentMutation.isPending}
                  onChange={(event) => {
                    if (event.target.value) assignmentMutation.mutate(event.target.value);
                  }}
                >
                  <option value="">Unassigned</option>
                  {(driversData?.drivers ?? []).map((driver: any) => (
                    <option key={driver.id} value={driver.id}>{driver.fullName}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
