import { getSupabaseClient } from "../lib/supabaseClient";
import { logAdminAction } from "./adminUsersApi";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PrescriptionReviewStatus = "pending_review" | "approved" | "rejected";
export type SubmissionSource = "manual" | "scan" | "whatsapp";
export type RefillStatus = "pending" | "preparing" | "ready" | "on_the_way" | "delivered" | "cancelled";
export type ReviewDecision = "approved" | "rejected";

export interface AdminPrescription {
  id: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  name: string;
  dose: string;
  doctor: string;
  rxNumber: string | null;
  isControlled: boolean;
  deaSchedule: number | null;
  reviewStatus: PrescriptionReviewStatus;
  submissionSource: SubmissionSource;
  adminNotes: string | null;
  rejectionReason: string | null;
  addedAt: string;
}

export interface AdminRefillRequest {
  id: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  prescriptionId: string;
  prescriptionName: string;
  delivery: string;
  status: RefillStatus;
  adminNotes: string | null;
  rejectionReason: string | null;
  placedAt: string;
}

export interface FetchPrescriptionsOptions {
  page?: number;
  perPage?: number;
  search?: string;
  statusFilter?: "all" | PrescriptionReviewStatus;
  signal?: AbortSignal;
}

export interface FetchRefillRequestsOptions {
  page?: number;
  perPage?: number;
  search?: string;
  statusFilter?: "all" | RefillStatus;
  signal?: AbortSignal;
}

export interface FetchResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PrescriptionCounts {
  pendingPrescriptions: number;
  pendingRefills: number;
  approvedToday: number;
  rejectedToday: number;
}

export interface ReviewPayload {
  decision: ReviewDecision;
  adminId: string;
  adminEmail?: string;
  adminNotes?: string;
  rejectionReason?: string;
}

// ─── Row shapes ───────────────────────────────────────────────────────────────

type PrescriptionRow = {
  id: string;
  user_id: string;
  name: string;
  dose: string | null;
  doctor: string | null;
  rx_number: string | null;
  is_controlled: boolean;
  dea_schedule: number | null;
  review_status: PrescriptionReviewStatus;
  submission_source: SubmissionSource;
  admin_notes: string | null;
  rejection_reason: string | null;
  added_at: string;
};

type RefillRequestRow = {
  id: string;
  user_id: string;
  prescription_id: string;
  delivery: string;
  status: RefillStatus;
  admin_notes: string | null;
  rejection_reason: string | null;
  placed_at: string;
};

type ProfileLite = { id: string; full_name: string | null; phone: string | null };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchProfilesById(userIds: string[]): Promise<Map<string, ProfileLite>> {
  const map = new Map<string, ProfileLite>();
  if (userIds.length === 0) return map;
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", Array.from(new Set(userIds)));
  for (const row of (data ?? []) as ProfileLite[]) {
    map.set(row.id, row);
  }
  return map;
}

function notifyCustomer(params: {
  userId: string;
  type: "prescription" | "refill";
  decision: ReviewDecision;
  rejectionReason?: string;
  actionUrl: string;
}): void {
  const supabase = getSupabaseClient();
  const isPrescription = params.type === "prescription";
  const titleAr = params.decision === "approved"
    ? (isPrescription ? "تم تأكيد وصفتك الطبية" : "تمت الموافقة على طلب إعادة الصرف")
    : (isPrescription ? "تحتاج وصفتك الطبية إلى انتباه" : "تعذّرت الموافقة على طلب إعادة الصرف");
  const bodyAr = params.decision === "approved"
    ? "يمكنك الآن متابعة تفاصيلها من التطبيق."
    : (params.rejectionReason ?? "يرجى التواصل مع الصيدلية لمزيد من التفاصيل.");

  // Best-effort — a failed notification insert must never block the review
  // action itself (the DB update already succeeded by the time this runs).
  void supabase.from("notifications").insert({
    user_id:    params.userId,
    type:       "health",
    category:   "health_reminders",
    title:      titleAr,
    body:       bodyAr,
    data:       { kind: params.type, decision: params.decision },
    action_url: params.actionUrl,
    is_read:    false,
  }).then(({ error }) => {
    if (error) console.error("[adminPrescriptionsApi] notification insert failed:", error.message);
  });
}

// ─── Prescriptions ────────────────────────────────────────────────────────────

export async function fetchPrescriptions(
  options: FetchPrescriptionsOptions = {},
): Promise<FetchResult<AdminPrescription>> {
  const supabase = getSupabaseClient();
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 20;
  const offset = (page - 1) * perPage;

  let query = supabase
    .from("prescriptions")
    .select(
      "id, user_id, name, dose, doctor, rx_number, is_controlled, dea_schedule, review_status, submission_source, admin_notes, rejection_reason, added_at",
      { count: "exact" },
    );

  if (options.statusFilter && options.statusFilter !== "all") {
    query = query.eq("review_status", options.statusFilter);
  }
  if (options.search && options.search.trim() !== "") {
    const term = `%${options.search.trim()}%`;
    query = query.or(`name.ilike.${term},rx_number.ilike.${term}`);
  }
  if (options.signal) {
    query = query.abortSignal(options.signal) as typeof query;
  }

  const { data, count, error } = await query
    .order("added_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) throw new Error(`[adminPrescriptionsApi.fetchPrescriptions] ${error.message}`);

  const rows = (data ?? []) as PrescriptionRow[];
  const profiles = await fetchProfilesById(rows.map((r) => r.user_id));

  const items: AdminPrescription[] = rows.map((row) => {
    const profile = profiles.get(row.user_id);
    return {
      id: row.id,
      userId: row.user_id,
      customerName: profile?.full_name ?? "—",
      customerPhone: profile?.phone ?? "—",
      name: row.name,
      dose: row.dose ?? "",
      doctor: row.doctor ?? "",
      rxNumber: row.rx_number,
      isControlled: row.is_controlled,
      deaSchedule: row.dea_schedule,
      reviewStatus: row.review_status,
      submissionSource: row.submission_source,
      adminNotes: row.admin_notes,
      rejectionReason: row.rejection_reason,
      addedAt: row.added_at,
    };
  });

  const total = count ?? 0;
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function reviewPrescription(id: string, userId: string, payload: ReviewPayload): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("prescriptions")
    .update({
      review_status: payload.decision,
      reviewed_by: payload.adminId,
      reviewed_at: new Date().toISOString(),
      admin_notes: payload.adminNotes ?? null,
      rejection_reason: payload.decision === "rejected" ? (payload.rejectionReason ?? null) : null,
    })
    .eq("id", id);

  if (error) throw new Error(`[adminPrescriptionsApi.reviewPrescription] ${error.message}`);

  notifyCustomer({
    userId,
    type: "prescription",
    decision: payload.decision,
    rejectionReason: payload.rejectionReason,
    actionUrl: `/prescriptions/${id}`,
  });

  await logAdminAction(payload.adminId, "prescription_reviewed", userId, {
    prescriptionId: id,
    decision: payload.decision,
    adminNotes: payload.adminNotes,
    rejectionReason: payload.rejectionReason,
    adminEmail: payload.adminEmail,
  });
}

// ─── Refill requests ──────────────────────────────────────────────────────────

export async function fetchRefillRequests(
  options: FetchRefillRequestsOptions = {},
): Promise<FetchResult<AdminRefillRequest>> {
  const supabase = getSupabaseClient();
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 20;
  const offset = (page - 1) * perPage;

  let query = supabase
    .from("refill_requests")
    .select(
      "id, user_id, prescription_id, delivery, status, admin_notes, rejection_reason, placed_at",
      { count: "exact" },
    );

  if (options.statusFilter && options.statusFilter !== "all") {
    query = query.eq("status", options.statusFilter);
  }
  if (options.signal) {
    query = query.abortSignal(options.signal) as typeof query;
  }

  const { data, count, error } = await query
    .order("placed_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) throw new Error(`[adminPrescriptionsApi.fetchRefillRequests] ${error.message}`);

  const rows = (data ?? []) as RefillRequestRow[];
  const [profiles, prescriptionNames] = await Promise.all([
    fetchProfilesById(rows.map((r) => r.user_id)),
    fetchPrescriptionNamesById(rows.map((r) => r.prescription_id)),
  ]);

  let items: AdminRefillRequest[] = rows.map((row) => {
    const profile = profiles.get(row.user_id);
    return {
      id: row.id,
      userId: row.user_id,
      customerName: profile?.full_name ?? "—",
      customerPhone: profile?.phone ?? "—",
      prescriptionId: row.prescription_id,
      prescriptionName: prescriptionNames.get(row.prescription_id) ?? "—",
      delivery: row.delivery,
      status: row.status,
      adminNotes: row.admin_notes,
      rejectionReason: row.rejection_reason,
      placedAt: row.placed_at,
    };
  });

  // Search filters on joined customer/medication name — applied client-side
  // post-join since it spans two tables the DB query above can't `.or()` across.
  if (options.search && options.search.trim() !== "") {
    const term = options.search.trim().toLowerCase();
    items = items.filter(
      (r) => r.customerName.toLowerCase().includes(term) || r.prescriptionName.toLowerCase().includes(term),
    );
  }

  const total = count ?? 0;
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

async function fetchPrescriptionNamesById(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("prescriptions")
    .select("id, name")
    .in("id", Array.from(new Set(ids)));
  for (const row of (data ?? []) as { id: string; name: string }[]) {
    map.set(row.id, row.name);
  }
  return map;
}

export async function reviewRefillRequest(id: string, userId: string, payload: ReviewPayload): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("refill_requests")
    .update({
      status: payload.decision === "approved" ? "preparing" : "cancelled",
      reviewed_by: payload.adminId,
      reviewed_at: new Date().toISOString(),
      admin_notes: payload.adminNotes ?? null,
      rejection_reason: payload.decision === "rejected" ? (payload.rejectionReason ?? null) : null,
    })
    .eq("id", id);

  if (error) throw new Error(`[adminPrescriptionsApi.reviewRefillRequest] ${error.message}`);

  notifyCustomer({
    userId,
    type: "refill",
    decision: payload.decision,
    rejectionReason: payload.rejectionReason,
    actionUrl: `/prescriptions/${id}`,
  });

  await logAdminAction(payload.adminId, "refill_reviewed", userId, {
    refillRequestId: id,
    decision: payload.decision,
    adminNotes: payload.adminNotes,
    rejectionReason: payload.rejectionReason,
    adminEmail: payload.adminEmail,
  });
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export async function fetchPrescriptionCounts(): Promise<PrescriptionCounts> {
  const supabase = getSupabaseClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const [pendingRx, pendingRefills, approvedToday, rejectedToday] = await Promise.all([
    supabase.from("prescriptions").select("id", { count: "exact", head: true }).eq("review_status", "pending_review"),
    supabase.from("refill_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("prescriptions").select("id", { count: "exact", head: true }).eq("review_status", "approved").gte("reviewed_at", todayIso),
    supabase.from("prescriptions").select("id", { count: "exact", head: true }).eq("review_status", "rejected").gte("reviewed_at", todayIso),
  ]);

  return {
    pendingPrescriptions: pendingRx.count ?? 0,
    pendingRefills: pendingRefills.count ?? 0,
    approvedToday: approvedToday.count ?? 0,
    rejectedToday: rejectedToday.count ?? 0,
  };
}
