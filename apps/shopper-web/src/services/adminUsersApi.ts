import { getSupabaseClient } from "../lib/supabaseClient";
import type { Role } from "@pharmacy/contracts";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: Role;
  status: 'Active' | 'Inactive' | 'Suspended';
  createdAt: string;
  suspensionInfo?: ActiveSuspensionInfo;
}

export interface ActiveSuspensionInfo {
  id: string;
  reasonCodes: string[];
  adminNotes?: string;
  durationType: 'permanent' | 'temporary';
  expiresAt?: string;
  suspendedAt: string;
}

export interface FetchUsersOptions {
  page?: number;
  perPage?: number;
  search?: string;
  statusFilter?: 'all' | 'Active' | 'Inactive' | 'Suspended';
  roleFilter?: 'all' | Role | Role[];
  sortBy?: 'full_name' | 'email' | 'created_at' | 'status' | 'role';
  sortDir?: 'asc' | 'desc';
}

export interface FetchUsersResult {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

export interface SuspendUserPayload {
  userId: string;
  reasonCodes: string[];
  adminNotes?: string;
  durationType: 'permanent' | 'temporary';
  expiresAt?: string;
  adminId: string;
  adminEmail?: string;
}

export interface DeleteUserPayload {
  userId: string;
  userEmail: string;
  userName: string;
  adminId: string;
  adminEmail?: string;
  reason: string;
  adminNotes?: string;
}

type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  status: string;
  created_at: string;
};

type SuspensionRow = {
  id: string;
  reason_codes: string[];
  admin_notes: string | null;
  duration_type: string;
  expires_at: string | null;
  created_at: string;
};

function rowToAdminUser(row: ProfileRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role as AdminUser['role'],
    status: row.status as AdminUser['status'],
    createdAt: row.created_at,
  };
}

function rowToSuspensionInfo(row: SuspensionRow): ActiveSuspensionInfo {
  return {
    id: row.id,
    reasonCodes: row.reason_codes ?? [],
    adminNotes: row.admin_notes ?? undefined,
    durationType: row.duration_type as ActiveSuspensionInfo['durationType'],
    expiresAt: row.expires_at ?? undefined,
    suspendedAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyProfileFilters(q: any, options: FetchUsersOptions): any {
  const { search, statusFilter, roleFilter } = options;
  if (search && search.trim() !== '') {
    const term = `%${search.trim()}%`;
    q = q.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }
  if (statusFilter && statusFilter !== 'all') {
    q = q.eq('status', statusFilter);
  } else {
    // 'all' still hides soft-deleted (Inactive) accounts — filter explicitly for them.
    q = q.neq('status', 'Inactive');
  }
  if (roleFilter && roleFilter !== 'all') {
    if (Array.isArray(roleFilter)) q = q.in('role', roleFilter);
    else q = q.eq('role', roleFilter);
  }
  return q;
}

export async function fetchUsers(options: FetchUsersOptions = {}): Promise<FetchUsersResult> {
  const supabase = getSupabaseClient();
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 20;
  const sortBy = options.sortBy ?? 'created_at';
  const sortDir = options.sortDir ?? 'desc';

  const { count, error: countError } = await applyProfileFilters(
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    options,
  );

  if (countError) {
    throw new Error(`[adminUsersApi.fetchUsers] count failed: ${(countError as { message: string }).message}`);
  }

  const total = (count as number) ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const offset = (page - 1) * perPage;

  const { data, error: dataError } = await applyProfileFilters(
    supabase.from('profiles').select('id, email, full_name, phone, role, status, created_at'),
    options,
  )
    .order(sortBy, { ascending: sortDir === 'asc' })
    .range(offset, offset + perPage - 1);

  if (dataError) {
    throw new Error(`[adminUsersApi.fetchUsers] data failed: ${(dataError as { message: string }).message}`);
  }

  const rows = (data ?? []) as ProfileRow[];
  const users: AdminUser[] = rows.map(rowToAdminUser);

  const suspendedIds = users
    .filter((u) => u.status === 'Suspended')
    .map((u) => u.id);

  if (suspendedIds.length > 0) {
    const { data: suspensions, error: suspErr } = await supabase
      .from('user_suspensions')
      .select('id, user_id, reason_codes, admin_notes, duration_type, expires_at, created_at')
      .in('user_id', suspendedIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!suspErr && suspensions) {
      const suspByUser = new Map<string, SuspensionRow & { user_id: string }>();
      for (const s of suspensions as Array<SuspensionRow & { user_id: string }>) {
        if (!suspByUser.has(s.user_id)) {
          suspByUser.set(s.user_id, s);
        }
      }
      for (const user of users) {
        const susp = suspByUser.get(user.id);
        if (susp) {
          user.suspensionInfo = rowToSuspensionInfo(susp);
        }
      }
    }
  }

  return { users, total, page, totalPages };
}

export async function suspendUser(payload: SuspendUserPayload): Promise<void> {
  const supabase = getSupabaseClient();

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ status: 'Suspended' })
    .eq('id', payload.userId);

  if (profileErr) {
    throw new Error(`[adminUsersApi.suspendUser] profile update failed: ${profileErr.message}`);
  }

  const { error: suspErr } = await supabase
    .from('user_suspensions')
    .insert({
      user_id: payload.userId,
      suspended_by: payload.adminId,
      reason_codes: payload.reasonCodes,
      admin_notes: payload.adminNotes ?? null,
      duration_type: payload.durationType,
      expires_at: payload.expiresAt ?? null,
      is_active: true,
    });

  if (suspErr) {
    throw new Error(`[adminUsersApi.suspendUser] suspension insert failed: ${suspErr.message}`);
  }

  await logAdminAction(payload.adminId, 'suspend_user', payload.userId, {
    reasonCodes: payload.reasonCodes,
    adminNotes: payload.adminNotes,
    adminEmail: payload.adminEmail,
  });
}

export async function unsuspendUser(userId: string, adminId: string, adminEmail?: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ status: 'Active' })
    .eq('id', userId);

  if (profileErr) {
    throw new Error(`[adminUsersApi.unsuspendUser] profile update failed: ${profileErr.message}`);
  }

  const { error: suspErr } = await supabase
    .from('user_suspensions')
    .update({
      is_active: false,
      unsuspended_at: new Date().toISOString(),
      unsuspended_by: adminId,
    })
    .eq('user_id', userId)
    .eq('is_active', true);

  if (suspErr) {
    throw new Error(`[adminUsersApi.unsuspendUser] suspension update failed: ${suspErr.message}`);
  }

  await logAdminAction(adminId, 'unsuspend_user', userId, { adminEmail });
}

export async function softDeleteUser(payload: DeleteUserPayload): Promise<void> {
  const supabase = getSupabaseClient();

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ status: 'Inactive', is_active: false })
    .eq('id', payload.userId);

  if (profileErr) {
    throw new Error(`[adminUsersApi.softDeleteUser] profile update failed: ${profileErr.message}`);
  }

  const { error: logErr } = await supabase
    .from('user_deletion_log')
    .insert({
      deleted_user_id: payload.userId,
      deleted_user_email: payload.userEmail,
      deleted_user_name: payload.userName,
      deleted_by: payload.adminId,
      deletion_type: 'admin',
      reason: payload.reason,
      admin_notes: payload.adminNotes ?? null,
    });

  if (logErr) {
    throw new Error(`[adminUsersApi.softDeleteUser] deletion log insert failed: ${logErr.message}`);
  }

  await logAdminAction(payload.adminId, 'delete_user', payload.userId, {
    userEmail: payload.userEmail,
    userName: payload.userName,
    reason: payload.reason,
    adminEmail: payload.adminEmail,
  });
}

export async function getSuspensionHistory(userId: string): Promise<ActiveSuspensionInfo[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('user_suspensions')
    .select('id, reason_codes, admin_notes, duration_type, expires_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`[adminUsersApi.getSuspensionHistory] ${error.message}`);
  }

  return ((data ?? []) as SuspensionRow[]).map(rowToSuspensionInfo);
}

export async function fetchActiveSuspension(userId: string): Promise<ActiveSuspensionInfo | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('user_suspensions')
    .select('id, reason_codes, admin_notes, duration_type, expires_at, created_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`[adminUsersApi.fetchActiveSuspension] ${error.message}`);
  }

  if (!data) return null;
  return rowToSuspensionInfo(data as SuspensionRow);
}

export async function logAdminAction(
  adminId: string,
  action: string,
  targetUserId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('admin_audit_log').insert({
      admin_id: adminId,
      action,
      target_user_id: targetUserId ?? null,
      details: details ?? null,
    });
  } catch {
    // Audit log failure must not interrupt the main operation.
  }
}

// ─── Role / status changes (consolidated — used by both StaffManager and
// UsersManager, closing the arbitrary split where only one page could
// change role and only the other could suspend/delete the same profiles
// row) ───────────────────────────────────────────────────────────────────

export async function changeUserRole(
  userId: string,
  nextRole: Role,
  adminId: string,
  adminEmail?: string,
): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: before } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  const fromRole = before?.role as string | undefined;

  // .select() + verify is required here, not optional — see
  // StaffManager.tsx's original handleRoleChange for the incident this
  // idiom was born from: a silently-blocked update (RLS, or the
  // profiles_guard_role_status trigger deciding the caller isn't a
  // manager) returns no error and zero rows changed, which PostgREST
  // treats as a successful request.
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: nextRole })
    .eq('id', userId)
    .select('id, role')
    .maybeSingle();

  if (error) throw new Error(`[adminUsersApi.changeUserRole] ${error.message}`);
  if (!data || data.role !== nextRole) {
    throw new Error('Role update did not persist.');
  }

  await logAdminAction(adminId, 'change_role', userId, { fromRole, toRole: nextRole, adminEmail });
}

export async function changeUserStatus(
  userId: string,
  nextStatus: 'Active' | 'Inactive' | 'Suspended',
  adminId: string,
  adminEmail?: string,
): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: before } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', userId)
    .maybeSingle();
  const fromStatus = before?.status as string | undefined;

  const { data, error } = await supabase
    .from('profiles')
    .update({ status: nextStatus })
    .eq('id', userId)
    .select('id, status')
    .maybeSingle();

  if (error) throw new Error(`[adminUsersApi.changeUserStatus] ${error.message}`);
  if (!data || data.status !== nextStatus) {
    throw new Error('Status update did not persist.');
  }

  await logAdminAction(adminId, 'change_status', userId, { fromStatus, toStatus: nextStatus, adminEmail });
}

// ─── Lock / unlock / reset sessions — thin wrappers over the
// admin-privileged-actions Edge Function (the client never holds the
// service-role key these need) ───────────────────────────────────────────

async function invokePrivilegedAction(action: string, params: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('admin-privileged-actions', {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message ?? `Failed to perform ${action}.`);
  if (!data?.success) throw new Error(data?.error ?? `Failed to perform ${action}.`);
}

export async function lockAccount(userId: string, adminId: string, adminEmail?: string): Promise<void> {
  await invokePrivilegedAction('set_account_lock', { userId, locked: true });
  await logAdminAction(adminId, 'lock_account', userId, { adminEmail });
}

export async function unlockAccount(userId: string, adminId: string, adminEmail?: string): Promise<void> {
  await invokePrivilegedAction('set_account_lock', { userId, locked: false });
  await logAdminAction(adminId, 'unlock_account', userId, { adminEmail });
}

export async function resetUserSessions(userId: string, adminId: string, adminEmail?: string): Promise<void> {
  await invokePrivilegedAction('reset_sessions', { userId });
  await logAdminAction(adminId, 'reset_sessions', userId, { adminEmail });
}

// ─── Audit log ────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetUserId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface FetchAuditLogResult {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  totalPages: number;
}

/** Reads public.admin_audit_log — real table, was write-only (nothing read
 * it) before this redesign. Pass targetUserId for one account's history
 * (used by AdminDetailDrawer), omit it for the platform-wide log. Resolves
 * admin_id -> display name via one batched profiles lookup per page, not
 * per row. */
export async function fetchAuditLog(
  targetUserId?: string,
  options: { page?: number; perPage?: number } = {},
): Promise<FetchAuditLogResult> {
  const supabase = getSupabaseClient();
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 20;
  const offset = (page - 1) * perPage;

  let query = supabase
    .from('admin_audit_log')
    .select('id, admin_id, action, target_user_id, details, created_at', { count: 'exact' });
  if (targetUserId) query = query.eq('target_user_id', targetUserId);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) throw new Error(`[adminUsersApi.fetchAuditLog] ${error.message}`);

  const rows = (data ?? []) as Array<{
    id: string;
    admin_id: string;
    action: string;
    target_user_id: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
  }>;

  const adminIds = Array.from(new Set(rows.map((r) => r.admin_id).filter(Boolean)));
  const adminNames = new Map<string, string>();
  if (adminIds.length > 0) {
    const { data: admins } = await supabase.from('profiles').select('id, full_name').in('id', adminIds);
    for (const a of (admins ?? []) as Array<{ id: string; full_name: string }>) {
      adminNames.set(a.id, a.full_name || '—');
    }
  }

  const entries: AuditLogEntry[] = rows.map((r) => ({
    id: r.id,
    adminId: r.admin_id,
    adminName: adminNames.get(r.admin_id) ?? '—',
    action: r.action,
    targetUserId: r.target_user_id,
    details: r.details,
    createdAt: r.created_at,
  }));

  const total = count ?? 0;
  return { entries, total, page, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

// ─── Status counts + last-sign-in (backed by database/20260710_admin_role_rpcs.sql) ──

export interface ProfileStatusCounts {
  total: number;
  active: number;
  suspended: number;
  inactive: number;
}

/** Replaces the old client-side loadCounts() pattern (an unfiltered
 * select('status') over the whole table, re-run after every mutation) with
 * one aggregate RPC call. */
export async function fetchStatusCounts(): Promise<ProfileStatusCounts> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('admin_profile_status_counts');
  if (error) throw new Error(`[adminUsersApi.fetchStatusCounts] ${error.message}`);
  return (data as ProfileStatusCounts) ?? { total: 0, active: 0, suspended: 0, inactive: 0 };
}

export interface LastSignInInfo {
  id: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
}

/** last_sign_in_at / email_confirmed_at live in auth.users, not
 * public.profiles, and auth.users isn't exposed to the client directly —
 * this batches the lookup by id array so a page of N accounts costs one
 * call, not N. */
export async function fetchLastSignInBatch(userIds: string[]): Promise<Map<string, LastSignInInfo>> {
  const result = new Map<string, LastSignInInfo>();
  if (userIds.length === 0) return result;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('admin_get_last_sign_in', { user_ids: userIds });
  if (error) throw new Error(`[adminUsersApi.fetchLastSignInBatch] ${error.message}`);

  for (const row of (data ?? []) as Array<{
    id: string;
    last_sign_in_at: string | null;
    email_confirmed_at: string | null;
  }>) {
    result.set(row.id, {
      id: row.id,
      lastSignInAt: row.last_sign_in_at,
      emailConfirmedAt: row.email_confirmed_at,
    });
  }
  return result;
}
