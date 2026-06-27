import { getSupabaseClient } from "../lib/supabaseClient";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'admin' | 'manager' | 'pharmacist' | 'driver' | 'customer';
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
  roleFilter?: 'all' | 'customer' | 'admin' | 'manager' | 'pharmacist' | 'driver';
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
    q = q.eq('role', roleFilter);
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
