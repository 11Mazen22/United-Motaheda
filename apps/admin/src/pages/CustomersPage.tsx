import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SkeletonTable } from '@/components/SkeletonTable';

export function CustomersPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'customers'],
    queryFn: () => api.get('/admin/customers').then(r => r.data),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-pharmacy-ink dark:text-white">Customers</h1>
        <p className="text-sm text-pharmacy-inkSoft dark:text-gray-400 mt-1">Manage platform customers</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-pharmacy-line dark:border-slate-700 shadow-sm overflow-hidden p-6">
        {isLoading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : isError ? (
          <div className="text-red-500">{error instanceof Error ? error.message : 'Error'}</div>
        ) : (
          <pre className="text-xs overflow-auto">{JSON.stringify(data?.data?.slice(0, 5), null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
