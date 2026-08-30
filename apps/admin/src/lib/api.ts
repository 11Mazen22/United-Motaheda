import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAdminStore } from '@/stores/admin.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAdminStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAdminStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// ─── Admin API ────────────────────────────────────────────────────────────────

export const adminApi = {
  login: (identifier: string, password: string) =>
    api.post('/admin/login', { identifier, password }).then((r) => r.data.data ?? r.data),

  // Drivers
  getOnlineDriversLocations: () =>
    api.get('/admin/drivers/online').then((r) => r.data.data ?? r.data),

  getAllDrivers: (page = 1, limit = 20, status?: string) =>
    api.get('/admin/drivers', { params: { page, limit, status } }).then((r) => r.data.data ?? r.data),

  getDriver: (id: string) =>
    api.get(`/admin/drivers/${id}`).then((r) => r.data.data ?? r.data),

  approveDriver: (id: string) =>
    api.patch(`/admin/drivers/${id}/approve`).then((r) => r.data),

  rejectDriver: (id: string, reason: string) =>
    api.patch(`/admin/drivers/${id}/reject`, { reason }).then((r) => r.data),

  suspendDriver: (id: string, reason: string) =>
    api.patch(`/admin/drivers/${id}/suspend`, { reason }).then((r) => r.data),

  // Orders
  getAllOrders: (page = 1, limit = 20, status?: string) =>
    api.get('/admin/orders', { params: { page, limit, status } }).then((r) => r.data.data ?? r.data),

  assignOrder: (orderId: string, driverId: string) =>
    api.post(`/admin/orders/${orderId}/assign`, { driverId }).then((r) => r.data),

  updateOrderStatus: async (orderId: string, status: string) => {
    if (status === "cancelled") {
      const { data, error } = await getAdminSupabase().functions.invoke("cancel-order", {
        body: { orderId, reason: "Admin forced cancellation" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    }
    return api.patch(`/admin/orders/${orderId}/status`, { status }).then((r) => r.data);
  },

  // Stats
  getDashboardStats: () =>
    api.get('/admin/stats').then((r) => r.data.data ?? r.data),

  // Notifications
  broadcastNotification: (data: { title: string; body: string; target: 'all' | 'online' | string }) =>
    api.post('/notifications/broadcast', {
      ...data,
      target: data.target === 'all' ? 'all_drivers' : data.target === 'online' ? 'online_drivers' : data.target,
    }).then((r) => {
      const result = r.data.data ?? r.data;
      return {
        ...result,
        successCount: result.sent ?? result.successCount ?? 0,
        failureCount: result.failed ?? result.failureCount ?? 0,
      };
    }),

  getNotificationHistory: (page = 1) =>
    api.get('/notifications/admin/history', { params: { page } }).then((r) => {
      const notifications = r.data.data ?? r.data;
      return { notifications: Array.isArray(notifications) ? notifications : notifications.notifications ?? [] };
    }),
};

// ─── Marketing API (direct Supabase — bypasses Railway) ────────────────────────
// These calls go directly to Supabase RPCs and Edge Functions rather than the
// Railway backend, as the marketing data lives entirely in Supabase.

import { getAdminSupabase } from './supabase';

export type MarketingSortKey =
  | 'name_asc'
  | 'name_desc'
  | 'registered_asc'
  | 'registered_desc';

export interface MarketingUser {
  id:                    string;
  full_name:             string;
  phone:                 string | null;
  email:                 string | null;
  registered_at:         string;
  marketing_consent:     boolean;
  account_status:        string;
  completed_order_count: number;
}

export interface MarketingTargetsResult {
  users:       MarketingUser[];
  total_count: number;
}

export interface SMSCampaign {
  id:               string;
  name:             string;
  message_template: string;
  batch_size:       100 | 200;
  total_recipients: number;
  sent_count:       number;
  failed_count:     number;
  status:           'draft' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  rate_limit_secs:  number;
  created_by:       string | null;
  queued_at:        string | null;
  started_at:       string | null;
  completed_at:     string | null;
  created_at:       string;
  updated_at:       string;
}

export interface SMSAuditEntry {
  id:          string;
  campaign_id: string;
  event:       string;
  actor_id:    string | null;
  batch_index: number | null;
  detail:      Record<string, unknown> | null;
  created_at:  string;
}

export const marketingApi = {
  /** Fetch paginated zero-order customers eligible for SMS campaigns. */
  getTargets: async (params: {
    page:         number;
    pageSize:     number;
    search?:      string;
    sort?:        MarketingSortKey;
    consentOnly?: boolean;
    statusFilter?:string;
  }): Promise<MarketingTargetsResult> => {
    const sb = getAdminSupabase();
    const { data, error } = await sb.rpc('get_marketing_targets', {
      p_page:          params.page,
      p_page_size:     params.pageSize,
      p_search:        params.search        ?? null,
      p_sort:          params.sort          ?? 'registered_desc',
      p_consent_only:  params.consentOnly   ?? false,
      p_status_filter: params.statusFilter  ?? 'all',
    });
    if (error) throw new Error(error.message);
    return data as MarketingTargetsResult;
  },

  /** Create a campaign and its recipient rows in a single transaction. */
  createCampaign: async (params: {
    name:             string;
    messageTemplate:  string;
    batchSize:        100 | 200;
    recipientIds:     string[];
    rateLimitSecs?:   number;
  }): Promise<SMSCampaign> => {
    const sb = getAdminSupabase();

    // Validate batch size constraint before hitting the DB.
    if (params.batchSize !== 100 && params.batchSize !== 200) {
      throw new Error('batch_size must be exactly 100 or 200');
    }
    if (params.recipientIds.length !== params.batchSize) {
      throw new Error(`recipient count (${params.recipientIds.length}) must equal batch_size (${params.batchSize})`);
    }

    // 1. Create the campaign row.
    const { data: campaign, error: campErr } = await sb
      .from('sms_campaigns')
      .insert({
        name:             params.name.trim(),
        message_template: params.messageTemplate.trim(),
        batch_size:       params.batchSize,
        total_recipients: params.recipientIds.length,
        rate_limit_secs:  params.rateLimitSecs ?? 60,
        status:           'draft',
      })
      .select()
      .single();

    if (campErr || !campaign) {
      throw new Error(campErr?.message ?? 'Failed to create campaign');
    }

    // 2. Fetch phone + name for selected user IDs.
    const { data: profiles, error: profErr } = await sb
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', params.recipientIds);

    if (profErr) throw new Error(profErr.message);

    const profileMap = new Map(
      (profiles ?? []).map((p: { id: string; full_name: string | null; phone: string | null }) =>
        [p.id, p],
      ),
    );

    // 3. Build recipient rows assigned to batch 0 (single batch for 100/200 selection).
    const rows = params.recipientIds
      .map((uid) => {
        const p = profileMap.get(uid);
        if (!p?.phone) return null; // skip users with no phone
        return {
          campaign_id: (campaign as SMSCampaign).id,
          user_id:     uid,
          phone:       p.phone as string,
          full_name:   (p.full_name as string) ?? '',
          batch_index: 0,
          status:      'pending',
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) {
      throw new Error('None of the selected users have a phone number on record');
    }

    const { error: rowsErr } = await sb
      .from('sms_campaign_recipients')
      .insert(rows);

    if (rowsErr) throw new Error(rowsErr.message);

    // Audit log entries are written by the service-role worker only (see
    // the sms_marketing migration) -- RLS has no authenticated insert
    // policy, so an insert from here would always fail.

    return campaign as SMSCampaign;
  },

  /** Transition campaign from draft → queued. */
  queueCampaign: async (campaignId: string): Promise<void> => {
    const sb = getAdminSupabase();
    const { error } = await sb
      .from('sms_campaigns')
      .update({ status: 'queued', queued_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .eq('status', 'draft');
    if (error) throw new Error(error.message);
  },

  /** Cancel a running or queued campaign. */
  cancelCampaign: async (campaignId: string): Promise<void> => {
    const sb = getAdminSupabase();
    await sb
      .from('sms_campaign_recipients')
      .update({ status: 'cancelled' })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    const { error } = await sb
      .from('sms_campaigns')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .in('status', ['queued', 'running', 'draft']);

    if (error) throw new Error(error.message);
  },

  /** Invoke the sms-campaign-worker edge function for one batch. */
  processBatch: async (campaignId: string, batchIndex: number): Promise<{
    sent: number; failed: number; campaign_done: boolean;
  }> => {
    const sb = getAdminSupabase();
    const { data, error } = await sb.functions.invoke('sms-campaign-worker', {
      body: { campaign_id: campaignId, batch_index: batchIndex },
    });
    if (error) throw new Error(error.message);
    return data as { sent: number; failed: number; campaign_done: boolean };
  },

  /** List all campaigns, newest first. */
  getCampaigns: async (): Promise<SMSCampaign[]> => {
    const sb = getAdminSupabase();
    const { data, error } = await sb
      .from('sms_campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as SMSCampaign[];
  },

  /** Fetch audit log for a campaign. */
  getAuditLog: async (campaignId: string): Promise<SMSAuditEntry[]> => {
    const sb = getAdminSupabase();
    const { data, error } = await sb
      .from('sms_audit_log')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as SMSAuditEntry[];
  },

  // Branches
  getBranches: (page = 1, limit = 20) => api.get('/admin/branches', { params: { page, limit } }).then(r => r.data),
  createBranch: (data: any) => api.post('/admin/branches', data).then(r => r.data),
  updateBranch: (id: string, data: any) => api.patch(`/admin/branches/${id}`, data).then(r => r.data),

  // Inventory
  getInventory: (page = 1, limit = 20) => api.get('/admin/inventory', { params: { page, limit } }).then(r => r.data),
  updateInventory: (id: string, data: any) => api.patch(`/admin/inventory/${id}`, data).then(r => r.data),

  // Products
  getProducts: (page = 1, limit = 20) => api.get('/admin/products', { params: { page, limit } }).then(r => r.data),
  updateProduct: (id: string, data: any) => api.patch(`/admin/products/${id}`, data).then(r => r.data),

  // Customers
  getCustomers: (page = 1, limit = 20) => api.get('/admin/customers', { params: { page, limit } }).then(r => r.data),

};
