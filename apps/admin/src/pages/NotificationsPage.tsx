import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { adminApi } from '@/lib/api';
import { showToast } from '@/components/Toast';
import { SkeletonCard } from '@/components/SkeletonTable';
import { formatDistanceToNow } from 'date-fns';

type Target = 'all' | 'online';

interface BroadcastForm {
  title: string;
  body: string;
  target: Target;
}

export function NotificationsPage() {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<BroadcastForm>({
    defaultValues: { title: '', body: '', target: 'all' },
  });

  const broadcastMutation = useMutation({
    mutationFn: (data: BroadcastForm) =>
      adminApi.broadcastNotification({ title: data.title, body: data.body, target: data.target }),
    onSuccess: (res) => {
      showToast(
        `Notification sent to ${res.successCount ?? '?'} driver(s)`,
        'success',
      );
      reset();
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
    },
    onError: (err: any) =>
      showToast(err?.response?.data?.message ?? 'Failed to send notification', 'error'),
  });

  const { data: historyData, isLoading: historyLoading, isError: historyError } = useQuery({
    queryKey: ['admin', 'notifications'],
    queryFn: () => adminApi.getNotificationHistory(),
    staleTime: 30_000,
  });

  const history = historyData?.notifications ?? [];

  const titleValue = watch('title');
  const bodyValue = watch('body');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Broadcast push notifications to drivers
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose form */}
        <div className="card p-6">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-5">
            📢 Send Notification
          </h2>

          <form onSubmit={handleSubmit((data) => broadcastMutation.mutate(data))} className="space-y-4">
            {/* Target */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Audience
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'all', label: '👥 All Drivers', desc: 'Every registered driver' },
                  { value: 'online', label: '🟢 Online Only', desc: 'Currently online drivers' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`card p-3 cursor-pointer border-2 transition-colors ${
                      watch('target') === opt.value
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                        : 'border-transparent'
                    }`}
                  >
                    <input
                      type="radio"
                      value={opt.value}
                      {...register('target')}
                      className="sr-only"
                    />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title *
              </label>
              <input
                className="input"
                placeholder="e.g. New orders available"
                {...register('title', { required: 'Title is required', maxLength: { value: 65, message: 'Max 65 characters' } })}
              />
              <div className="flex justify-between mt-1">
                {errors.title && <span className="text-xs text-red-500">{errors.title.message}</span>}
                <span className="text-xs text-gray-400 ml-auto">{titleValue.length}/65</span>
              </div>
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Message *
              </label>
              <textarea
                className="input resize-none h-24"
                placeholder="Your notification message here…"
                {...register('body', { required: 'Message is required', maxLength: { value: 200, message: 'Max 200 characters' } })}
              />
              <div className="flex justify-between mt-1">
                {errors.body && <span className="text-xs text-red-500">{errors.body.message}</span>}
                <span className="text-xs text-gray-400 ml-auto">{bodyValue.length}/200</span>
              </div>
            </div>

            {/* Preview */}
            {(titleValue || bodyValue) && (
              <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4 border-l-4 border-brand-500">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">PREVIEW</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{titleValue || 'Notification Title'}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{bodyValue || 'Notification body…'}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={broadcastMutation.isPending}
              className="btn-primary w-full py-3 disabled:opacity-60"
            >
              {broadcastMutation.isPending ? '⏳ Sending…' : '🚀 Send Notification'}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="card p-6">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-5">
            📋 Recent Broadcasts
          </h2>

          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={2} />)}
            </div>
          ) : historyError ? (
            <div className="text-center py-12 text-red-500">
              <p className="text-sm">Unable to load notification history</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-3xl mb-2">🔔</div>
              <p className="text-sm">No notifications sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((n: any, i: number) => (
                <div key={n.id ?? i} className="p-4 rounded-xl bg-gray-50 dark:bg-slate-700 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {n.title}
                    </p>
                    <span className="badge badge-neutral text-xs flex-shrink-0">
                      {n.target}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{n.body}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {n.sentAt
                        ? formatDistanceToNow(new Date(n.sentAt), { addSuffix: true })
                        : '—'}
                    </span>
                    {n.successCount != null && (
                      <span className="text-xs font-medium text-green-600">
                        ✓ {n.successCount} sent
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
