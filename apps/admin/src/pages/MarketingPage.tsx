/**
 * MarketingPage — Admin SMS marketing tool.
 *
 * Target: customers who registered but never placed a completed order.
 * Batch size must be exactly 100 or 200. No other amount is permitted.
 *
 * Sections:
 *   1. User targeting table (filterable, searchable, sortable, paginated)
 *   2. Batch selection panel (select 100 or 200)
 *   3. Campaign creation form (name + message template)
 *   4. Campaign list with progress tracking and audit log
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useMarketingUsers, type MarketingPageSize } from '@/hooks/useMarketingUsers';
import { useSMSCampaign, type BatchSize } from '@/hooks/useSMSCampaign';
import type { MarketingUser, SMSCampaign } from '@/lib/api';

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: SMSCampaign['status'] }) {
  const map: Record<SMSCampaign['status'], string> = {
    draft:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    queued:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    running:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    failed:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return <Badge label={status} color={map[status] ?? map.draft} />;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">{children}</h2>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-gray-100
      dark:border-slate-700 shadow-sm p-5 ${className}`}>
      {children}
    </div>
  );
}

// ─── User table row ───────────────────────────────────────────────────────────

interface UserRowProps {
  user:      MarketingUser;
  selected:  boolean;
  onToggle:  (u: MarketingUser) => void;
  disabled:  boolean;
}

function UserRow({ user, selected, onToggle, disabled }: UserRowProps) {
  return (
    <tr
      className={`border-b border-gray-50 dark:border-slate-700 transition-colors
        ${selected ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'}`}
    >
      <td className="px-4 py-3 w-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(user)}
          disabled={disabled && !selected}
          className="w-4 h-4 accent-brand-500 cursor-pointer disabled:cursor-not-allowed"
          aria-label={`Select ${user.full_name}`}
        />
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[160px]">
          {user.full_name || '—'}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{user.email ?? ''}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">
        {user.phone ?? '—'}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
        {user.registered_at ? new Date(user.registered_at).toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3">
        {user.marketing_consent
          ? <Badge label="Yes" color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
          : <Badge label="No"  color="bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400" />}
      </td>
      <td className="px-4 py-3">
        <Badge
          label={user.account_status}
          color={user.account_status === 'Active'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}
        />
      </td>
      <td className="px-4 py-3 text-sm text-center text-gray-500 dark:text-gray-400">
        {user.completed_order_count}
      </td>
    </tr>
  );
}

// ─── Campaign create form ─────────────────────────────────────────────────────

interface CreateFormProps {
  selectedUsers: MarketingUser[];
  batchSize:     BatchSize;
  onBatchSize:   (s: BatchSize) => void;
  onSubmit:      (name: string, message: string) => void;
  creating:      boolean;
  createError:   string | null;
  validationError: string | null;
}

function CampaignCreateForm({
  selectedUsers, batchSize, onBatchSize, onSubmit, creating, createError, validationError,
}: CreateFormProps) {
  const [name,    setName]    = useState('');
  const [message, setMessage] = useState('');

  const charCount   = message.length;
  const smsCount    = Math.ceil(charCount / 160) || 0;
  const canSubmit   = name.trim().length >= 2 && message.trim().length >= 5 && !creating && !validationError;

  return (
    <Card>
      <SectionHeading>Create SMS Campaign</SectionHeading>

      {/* Batch size selector — 100 or 200 ONLY */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
          Batch Size <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-3">
          {([100, 200] as BatchSize[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onBatchSize(s)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors
                ${batchSize === s
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:border-brand-300'}`}
            >
              {s} users
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Only exactly 100 or 200 recipients are permitted per campaign.
        </p>
      </div>

      {/* Selection status */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-sm font-medium
        ${selectedUsers.length === batchSize
          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
          : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'}`}>
        <span>{selectedUsers.length === batchSize ? '✓' : '○'}</span>
        <span>
          {selectedUsers.length} / {batchSize} users selected
          {selectedUsers.length !== batchSize && ` — select exactly ${batchSize}`}
        </span>
      </div>

      {/* Campaign name */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
          Campaign Name <span className="text-red-500">*</span>
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. First Order Push — July 2026"
          maxLength={200}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600
            bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        />
      </div>

      {/* Message template */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="احصل على خصم 100 ج.م على طلبك الأول باستخدام كود FIRST100 عند الشراء من United Pharmacy. الكود صالح لفترة محدودة."
          rows={4}
          maxLength={480}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600
            bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-white resize-none
            focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
          dir="auto"
        />
        <div className="flex justify-between mt-1">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {charCount} chars — {smsCount} SMS message{smsCount !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Max 480 chars</p>
        </div>
      </div>

      {(validationError || createError) && (
        <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{validationError ?? createError}</p>
        </div>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit(name.trim(), message.trim())}
        className="w-full py-3 rounded-xl bg-brand-500 text-white font-bold text-sm
          hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {creating ? 'Creating…' : 'Create Campaign'}
      </button>
    </Card>
  );
}

// ─── Campaign row ─────────────────────────────────────────────────────────────

interface CampaignRowProps {
  campaign:       SMSCampaign;
  onLaunch:       (c: SMSCampaign) => void;
  onCancel:       (id: string) => void;
  onViewAudit:    (id: string) => void;
  launching:      boolean;
  cancelling:     boolean;
  progress:       import('@/hooks/useSMSCampaign').CampaignProgress | null;
}

function CampaignRow({ campaign, onLaunch, onCancel, onViewAudit, launching, cancelling, progress }: CampaignRowProps) {
  const isActive = campaign.status === 'running' || campaign.status === 'queued';
  const pct = campaign.total_recipients > 0
    ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_recipients) * 100)
    : 0;

  return (
    <div className="border border-gray-100 dark:border-slate-700 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{campaign.name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {new Date(campaign.created_at).toLocaleString()} · {campaign.total_recipients} recipients · batch {campaign.batch_size}
          </p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {/* Progress bar */}
      {(isActive || campaign.status === 'completed') && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Sent: {campaign.sent_count} · Failed: {campaign.failed_count}</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {progress && !progress.done && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Processing batch {progress.batchIndex + 1} / {progress.totalBatches}…
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {campaign.status === 'draft' && (
          <button
            onClick={() => onLaunch(campaign)}
            disabled={launching}
            className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-bold
              hover:bg-brand-600 disabled:opacity-40 transition-colors"
          >
            {launching ? 'Launching…' : '▶ Launch'}
          </button>
        )}
        {isActive && (
          <button
            onClick={() => onCancel(campaign.id)}
            disabled={cancelling}
            className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600
              dark:text-red-400 text-xs font-bold hover:bg-red-100 disabled:opacity-40 transition-colors"
          >
            {cancelling ? 'Cancelling…' : '✕ Cancel'}
          </button>
        )}
        <button
          onClick={() => onViewAudit(campaign.id)}
          className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-600
            dark:text-gray-300 text-xs font-medium hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
        >
          Audit Log
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MarketingPage() {
  const mkt = useMarketingUsers();
  const sms = useSMSCampaign();

  const [selected,       setSelected]       = useState<MarketingUser[]>([]);
  const [batchSize,      setBatchSize]       = useState<BatchSize>(100);
  const [validationError,setValidationError] = useState<string | null>(null);
  const [activeTab,      setActiveTab]       = useState<'targets' | 'campaigns'>('targets');

  // ── Selection logic ────────────────────────────────────────────────────────
  const selectedIds = useMemo(() => new Set(selected.map((u) => u.id)), [selected]);

  const toggleUser = useCallback((user: MarketingUser) => {
    setSelected((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      if (exists) return prev.filter((u) => u.id !== user.id);
      if (prev.length >= batchSize) return prev; // hard cap
      return [...prev, user];
    });
    setValidationError(null);
  }, [batchSize]);

  const clearSelection = useCallback(() => setSelected([]), []);

  const selectAll = useCallback(() => {
    const toAdd = mkt.users.filter((u) => !selectedIds.has(u.id) && u.phone);
    const combined = [...selected, ...toAdd].slice(0, batchSize);
    setSelected(combined);
  }, [mkt.users, selectedIds, selected, batchSize]);

  // ── Campaign creation ──────────────────────────────────────────────────────
  const handleCreate = useCallback(async (name: string, message: string) => {
    const err = sms.validateSelection(selected, batchSize);
    if (err) { setValidationError(err); return; }
    setValidationError(null);

    const campaign = await sms.createCampaign({
      name,
      messageTemplate: message,
      batchSize,
      recipientIds:    selected.map((u) => u.id),
    });

    setSelected([]);
    setActiveTab('campaigns');
    // Auto-launch immediately after creation.
    await sms.launchCampaign(campaign);
  }, [selected, batchSize, sms]);

  const handleLaunch = useCallback(async (campaign: SMSCampaign) => {
    await sms.launchCampaign(campaign);
  }, [sms]);

  const handleCancel = useCallback(async (campaignId: string) => {
    sms.cancelActiveBatch();
    await sms.cancelCampaign(campaignId);
  }, [sms]);

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">SMS Marketing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Target zero-order customers with SMS campaigns. Select exactly 100 or 200 recipients.
          </p>
        </div>
        <div className="flex gap-2">
          {(['targets', 'campaigns'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors
                ${activeTab === tab
                  ? 'bg-brand-500 text-white'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
            >
              {tab === 'targets' ? 'User Targeting' : `Campaigns (${sms.campaigns.length})`}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'targets' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* ── Left: targets table ─────────────────────────────────── */}
          <div className="xl:col-span-2 space-y-4">
            <Card>
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-4">
                <input
                  value={mkt.search}
                  onChange={(e) => mkt.setSearch(e.target.value)}
                  placeholder="Search name or phone…"
                  className="flex-1 min-w-[180px] px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-600
                    bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <select
                  value={mkt.sort}
                  onChange={(e) => mkt.setSort(e.target.value as import('@/lib/api').MarketingSortKey)}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600
                    bg-white dark:bg-slate-700 text-sm text-gray-700 dark:text-gray-200
                    focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="registered_desc">Newest first</option>
                  <option value="registered_asc">Oldest first</option>
                  <option value="name_asc">Name A–Z</option>
                  <option value="name_desc">Name Z–A</option>
                </select>
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200
                  dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mkt.consentOnly}
                    onChange={(e) => mkt.setConsentOnly(e.target.checked)}
                    className="w-4 h-4 accent-brand-500"
                  />
                  Consent only
                </label>
                <button
                  onClick={() => mkt.refetch()}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600
                    text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  title="Refresh"
                >
                  ↻
                </button>
              </div>

              {/* Selection toolbar */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {mkt.totalCount.toLocaleString()} eligible users · {selected.length} selected
                  {mkt.isFetching && <span className="ml-2 text-brand-500 animate-pulse">Loading…</span>}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    disabled={selected.length >= batchSize}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-50 dark:bg-brand-900/20
                      text-brand-600 dark:text-brand-400 hover:bg-brand-100 disabled:opacity-40 transition-colors"
                  >
                    Select page
                  </button>
                  <button
                    onClick={clearSelection}
                    disabled={selected.length === 0}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 dark:bg-slate-700
                      text-gray-600 dark:text-gray-300 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-700">
                <table className="min-w-full text-left">
                  <thead className="bg-gray-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 w-10" />
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phone</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Registered</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Consent</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">Orders</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-50 dark:divide-slate-700">
                    {mkt.isLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}><td colSpan={7} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded animate-pulse w-full" />
                        </td></tr>
                      ))
                    ) : mkt.isError ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-red-500">
                        Failed to load users.
                        <button onClick={() => mkt.refetch()} className="ml-2 underline">Retry</button>
                      </td></tr>
                    ) : mkt.users.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                        No eligible users found.
                      </td></tr>
                    ) : (
                      mkt.users.map((u) => (
                        <UserRow
                          key={u.id}
                          user={u}
                          selected={selectedIds.has(u.id)}
                          onToggle={toggleUser}
                          disabled={selected.length >= batchSize}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Per page:</span>
                  {([50, 100, 200] as MarketingPageSize[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => mkt.setPageSize(s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors
                        ${mkt.pageSize === s
                          ? 'bg-brand-500 text-white'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => mkt.setPage(mkt.page - 1)}
                    disabled={mkt.page <= 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-slate-700
                      text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-200 transition-colors"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Page {mkt.page} / {mkt.totalPages}
                  </span>
                  <button
                    onClick={() => mkt.setPage(mkt.page + 1)}
                    disabled={mkt.page >= mkt.totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-slate-700
                      text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-200 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </Card>
          </div>

          {/* ── Right: create form ──────────────────────────────────── */}
          <div className="xl:col-span-1">
            <CampaignCreateForm
              selectedUsers={selected}
              batchSize={batchSize}
              onBatchSize={setBatchSize}
              onSubmit={handleCreate}
              creating={sms.creating}
              createError={sms.createError}
              validationError={validationError}
            />
          </div>
        </div>
      )}

      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Campaign list */}
          <div className="xl:col-span-2 space-y-3">
            <SectionHeading>All Campaigns</SectionHeading>
            {sms.campaignsLoading ? (
              <div className="text-sm text-gray-400 dark:text-gray-500 animate-pulse">Loading campaigns…</div>
            ) : sms.campaigns.length === 0 ? (
              <Card>
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                  No campaigns yet. Go to User Targeting to create one.
                </p>
              </Card>
            ) : (
              sms.campaigns.map((c) => (
                <CampaignRow
                  key={c.id}
                  campaign={c}
                  onLaunch={handleLaunch}
                  onCancel={handleCancel}
                  onViewAudit={sms.setAuditCampaignId}
                  launching={sms.creating}
                  cancelling={sms.cancelling}
                  progress={sms.progress}
                />
              ))
            )}
          </div>

          {/* Audit log panel */}
          <div className="xl:col-span-1">
            {sms.auditCampaignId ? (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <SectionHeading>Audit Log</SectionHeading>
                  <button
                    onClick={() => sms.setAuditCampaignId(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    ✕ Close
                  </button>
                </div>
                {sms.auditLoading ? (
                  <p className="text-xs text-gray-400 animate-pulse">Loading…</p>
                ) : sms.auditLog.length === 0 ? (
                  <p className="text-xs text-gray-400">No audit entries yet.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {sms.auditLog.map((entry) => (
                      <div key={entry.id} className="flex gap-2 text-xs">
                        <span className="text-gray-400 dark:text-gray-500 whitespace-nowrap">
                          {new Date(entry.created_at).toLocaleTimeString()}
                        </span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{entry.event}</span>
                        {entry.batch_index != null && (
                          <span className="text-gray-400">batch {entry.batch_index}</span>
                        )}
                        {entry.detail && (
                          <span className="text-gray-400 truncate">
                            {JSON.stringify(entry.detail).slice(0, 60)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ) : (
              <Card>
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                  Click "Audit Log" on a campaign to view its history.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
