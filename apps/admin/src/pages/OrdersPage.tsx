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
    ready: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800',
    driver_assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
    driver_accepted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
    out_for_delivery: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
    delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
    pending: 'bg-gray-100 text-gray-800 dark:bg-slate-700/50 dark:text-gray-300 border border-gray-200 dark:border-slate-600',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800 dark:bg-slate-700/50 dark:text-gray-300 border border-gray-200 dark:border-slate-600';
};

const formatStatus = (s: string) => {
  return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
      showToast(`Order moved to ${formatStatus(status)}`, 'success');
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

  const orderIds = orders.map((o: any) => o.id);
  const { data: returnsData } = useQuery({
    queryKey: ['admin', 'orders', 'returns', orderIds],
    queryFn: async () => {
      if (orderIds.length === 0) return [];
      const { data, error } = await getAdminSupabase()
        .from('return_requests')
        .select('order_id, status')
        .in('order_id', orderIds);
      if (error) throw error;
      return data;
    },
    enabled: orderIds.length > 0,
    staleTime: 15_000,
  });

  const returnsByOrder = new Map(returnsData?.map(r => [r.order_id, r.status]) ?? []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-pharmacy-ink dark:text-white font-sans tracking-tight">Orders</h1>
          <p className="text-sm text-pharmacy-inkSoft dark:text-gray-400 mt-1">
            Track and manage all delivery orders
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              statusFilter === s
                ? 'bg-pharmacy-primary text-white shadow-md shadow-pharmacy-primary/20'
                : 'bg-white dark:bg-slate-800 text-pharmacy-inkSoft dark:text-gray-300 hover:bg-pharmacy-canvas dark:hover:bg-slate-700 border border-pharmacy-line dark:border-slate-600'
            }`}
          >
            {formatStatus(s)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-pharmacy-line dark:border-slate-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-4"><SkeletonTable rows={10} cols={6} /></div>
        ) : isError ? (
          <div className="px-6 py-16 flex flex-col items-center justify-center">
             <span className="text-4xl mb-4">⚠️</span>
             <p className="text-red-500 font-semibold">{error instanceof Error ? error.message : 'Unable to load orders'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-pharmacy-canvas/50 dark:bg-slate-700/50 border-b border-pharmacy-line dark:border-slate-700">
                    {['Order ID', 'Customer', 'Driver', 'Status', 'Total', 'Time', ''].map((h) => (
                      <th key={h} className="px-6 py-4 text-xs font-bold text-pharmacy-inkSoft dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-pharmacy-line dark:divide-slate-700">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <span className="text-4xl mb-4 opacity-50 block">📭</span>
                        <p className="text-pharmacy-inkSoft font-medium">No orders found</p>
                      </td>
                    </tr>
                  ) : (
                    orders.map((order: any) => (
                      <tr
                        key={order.id}
                        className="hover:bg-pharmacy-canvas/80 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <td className="px-6 py-4 text-sm font-mono font-bold text-pharmacy-primary dark:text-pharmacy-primaryLight">
                          #{order.id?.slice(-8)}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-pharmacy-ink dark:text-white">
                            {order.customer_name ?? order.customerName}
                          </p>
                          <p className="text-xs text-pharmacy-inkSoft dark:text-gray-400 max-w-[200px] truncate mt-0.5">
                            {order.customer_address ?? order.customerAddress}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {order.assigned_driver_id ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Assigned
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-gray-50 text-gray-600 border border-gray-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${statusBadge(order.status)}`}>
                              {formatStatus(order.status)}
                            </span>
                            {returnsByOrder.has(order.id) && (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                Return: {formatStatus(returnsByOrder.get(order.id)!)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-pharmacy-ink dark:text-white whitespace-nowrap">
                          {parseFloat(order.total ?? '0').toFixed(2)} EGP
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-pharmacy-inkSoft dark:text-gray-400 whitespace-nowrap">
                          {order.created_at
                            ? formatDistanceToNow(new Date(order.created_at), { addSuffix: true })
                            : '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-pharmacy-primary opacity-0 group-hover:opacity-100 transition-opacity font-semibold text-sm hover:underline">
                            Details →
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-pharmacy-line dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                <p className="text-sm font-medium text-pharmacy-inkSoft">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-white dark:bg-slate-700 border border-pharmacy-line dark:border-slate-600 rounded-lg text-sm font-semibold text-pharmacy-ink dark:text-white disabled:opacity-40 hover:bg-pharmacy-canvas transition-colors"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 bg-white dark:bg-slate-700 border border-pharmacy-line dark:border-slate-600 rounded-lg text-sm font-semibold text-pharmacy-ink dark:text-white disabled:opacity-40 hover:bg-pharmacy-canvas transition-colors"
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
        <div className="fixed inset-0 bg-pharmacy-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-pharmacy-line dark:border-slate-700 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-pharmacy-line dark:border-slate-700 bg-pharmacy-canvas/30">
              <div>
                <h2 className="text-xl font-bold text-pharmacy-ink dark:text-white flex items-center gap-2">
                  Order <span className="text-pharmacy-primary">#{selectedOrder.id?.slice(-8)}</span>
                </h2>
                <p className="text-sm text-pharmacy-inkSoft mt-1">
                  {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString() : ''}
                </p>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)} 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-500 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Customer Name', value: selectedOrder.customer_name },
                  { label: 'Phone Number', value: selectedOrder.customer_phone },
                  { label: 'Payment Method', value: selectedOrder.payment_method },
                  { label: 'Order Total', value: parseFloat(selectedOrder.total ?? '0').toFixed(2) + ' EGP' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-pharmacy-canvas/50 dark:bg-slate-900/50 p-3 rounded-lg border border-pharmacy-line dark:border-slate-700">
                    <span className="block text-xs font-semibold text-pharmacy-inkSoft uppercase tracking-wider mb-1">{label}</span>
                    <span className="block text-sm font-bold text-pharmacy-ink dark:text-white">
                      {value ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="bg-pharmacy-canvas/50 dark:bg-slate-900/50 p-4 rounded-lg border border-pharmacy-line dark:border-slate-700">
                <span className="block text-xs font-semibold text-pharmacy-inkSoft uppercase tracking-wider mb-2">Delivery Address</span>
                <span className="block text-sm font-medium text-pharmacy-ink dark:text-white leading-relaxed">
                  {selectedOrder.customer_address ?? '—'}
                </span>
              </div>
              
              {selectedOrder.note && (
                 <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                   <span className="block text-xs font-bold text-yellow-800 dark:text-yellow-400 uppercase tracking-wider mb-2">Customer Note</span>
                   <span className="block text-sm font-medium text-yellow-900 dark:text-yellow-300">
                     {selectedOrder.note}
                   </span>
                 </div>
              )}

              <div className="space-y-4 pt-4 border-t border-pharmacy-line dark:border-slate-700">
                <h3 className="text-sm font-bold text-pharmacy-ink dark:text-white">Order Management</h3>
                
                <label className="block">
                  <span className="block text-sm font-semibold text-pharmacy-inkSoft mb-1.5">Order Status</span>
                  <select
                    className="w-full border border-pharmacy-line dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm font-medium bg-white dark:bg-slate-900 text-pharmacy-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-pharmacy-primary/50 focus:border-pharmacy-primary transition-all"
                    value={selectedOrder.status}
                    disabled={statusMutation.isPending}
                    onChange={(event) => statusMutation.mutate(event.target.value)}
                  >
                    {[selectedOrder.status, ...STATUS_OPTIONS.filter((status) => status !== 'All' && status !== selectedOrder.status)].map((status) => (
                      <option key={status} value={status}>{formatStatus(status)}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-sm font-semibold text-pharmacy-inkSoft mb-1.5">Assign Driver</span>
                  <select
                    className="w-full border border-pharmacy-line dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm font-medium bg-white dark:bg-slate-900 text-pharmacy-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-pharmacy-primary/50 focus:border-pharmacy-primary transition-all"
                    value={selectedOrder.assigned_driver_id ?? ''}
                    disabled={assignmentMutation.isPending}
                    onChange={(event) => {
                      if (event.target.value) assignmentMutation.mutate(event.target.value);
                    }}
                  >
                    <option value="">— Unassigned —</option>
                    {(driversData?.drivers ?? []).map((driver: any) => (
                      <option key={driver.id} value={driver.id}>{driver.fullName}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            
            <div className="p-4 border-t border-pharmacy-line dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 flex justify-end">
               <button 
                 onClick={() => setSelectedOrder(null)}
                 className="px-6 py-2.5 bg-pharmacy-primary hover:bg-pharmacy-primaryDark text-white font-bold rounded-xl transition-colors shadow-sm"
               >
                 Done
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
