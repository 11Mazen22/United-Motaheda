import { getSupabaseClient } from "../lib/supabaseClient";
import type {
  DashboardStats,
  DashboardSeriesPoint,
  StaffMember,
  StaffStatus,
} from "./googleSheetsApi";

type OrdersDashboardRow = {
  total_orders: number;
  total_sales:  number;
  orders_by_day: Array<{ day: string; orders: number; sales: number }> | null;
};

export async function getSupabaseDashboardStats(): Promise<DashboardStats> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_orders_dashboard");
  if (error) throw new Error(error.message);

  const row = (data ?? {}) as Partial<OrdersDashboardRow>;

  const ordersByDay: DashboardSeriesPoint[] = (row.orders_by_day ?? []).map((d) => ({
    day:    d.day,
    label:  d.day,
    orders: d.orders,
    sales:  d.sales,
  }));

  return {
    totalOrders:  row.total_orders  ?? 0,
    totalSales:   row.total_sales   ?? 0,
    newCustomers: 0,
    lowStockItems: 0,
    ordersByDay,
  };
}

export async function getSupabaseStaff(): Promise<StaffMember[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, status")
    .in("role", ["admin", "manager", "pharmacist", "driver"]);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id:       row.id,
    fullName: row.full_name  || "",
    username: (row.email as string | null)?.split("@")[0] ?? "",
    role:     row.role       || "pharmacist",
    phone:    row.phone      || "",
    email:    row.email      || "",
    status:   (row.status as StaffStatus) || "Active",
  }));
}
