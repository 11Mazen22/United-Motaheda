import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../../hooks/useAuth";
import {
  commitDriverBatchScan,
  listDriverManifest,
  pushDriverLocation,
  formatAddress,
  type DriverManifestOrder,
} from "../../services/logisticsApi";

const queueStorageKey = "united-pharmacies-driver-queue";

function createSessionId() {
  return crypto.randomUUID();
}

function readQueue() {
  try {
    const raw = localStorage.getItem(queueStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatPrice(value: number): string {
  return `${value.toFixed(2)} EGP`;
}

export default function DriverApp() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<DriverManifestOrder[]>([]);
  const [queuedScans, setQueuedScans] = useState<Array<{ code: string; scanned_at: string }>>([]);
  const [scanInput, setScanInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [sessionId, setSessionId] = useState(createSessionId);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [sharingLocation, setSharingLocation] = useState(false);

  useEffect(() => {
    setQueuedScans(readQueue());
  }, []);

  useEffect(() => {
    localStorage.setItem(queueStorageKey, JSON.stringify(queuedScans));
  }, [queuedScans]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    async function load() {
      try {
        const manifest = await listDriverManifest(user!.id);
        if (active) {
          setOrders(manifest);
          setSelectedOrderId((current) => current || manifest[0]?.id || "");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load your manifest.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [user?.id]);

  const summary = useMemo(() => ({
    ready: orders.filter((o) => o.status === "ready").length,
    out: orders.filter((o) => o.status === "picked_up").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    queued: queuedScans.length,
  }), [orders, queuedScans.length]);

  function queueScan(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setQueuedScans((current) => {
      if (current.some((entry) => entry.code === trimmed)) return current;
      return [...current, { code: trimmed, scanned_at: new Date().toISOString() }];
    });
    setScanInput("");
  }

  async function commitQueue() {
    if (!queuedScans.length) return;
    setCommitting(true);
    try {
      const result = await commitDriverBatchScan({
        session_id: sessionId,
        device_id: navigator.userAgent.slice(0, 120),
        scans: queuedScans,
      });
      setQueuedScans([]);
      setSessionId(createSessionId());
      toast.success(`Committed ${result.updated.length} scan(s).`);
      if (user?.id) setOrders(await listDriverManifest(user.id));
      if (result.rejected.length) toast.message(`${result.rejected.length} scan(s) were rejected.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to commit scans.");
    } finally {
      setCommitting(false);
    }
  }

  async function shareLocation() {
    if (!user?.id || !selectedOrderId) {
      toast.error("Select an active order first.");
      return;
    }
    if (!navigator.geolocation) {
      toast.error("Geolocation is not available on this device.");
      return;
    }
    setSharingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 15_000,
          timeout: 10_000,
        }),
      );
      await pushDriverLocation({
        driver_id: user.id,
        order_id: selectedOrderId,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy_meters: position.coords.accuracy,
        heading: position.coords.heading ?? undefined,
        speed_kmh: typeof position.coords.speed === "number" ? Math.max(position.coords.speed, 0) * 3.6 : undefined,
        captured_at: new Date(position.timestamp).toISOString(),
      });
      toast.success("Location shared successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to share location.");
    } finally {
      setSharingLocation(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-teal-600 to-teal-700 p-6 shadow-sm text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-100">Driver Workspace</p>
            <h1 className="mt-2 text-3xl font-black text-white">Scan-first delivery</h1>
            <p className="mt-2 text-sm font-semibold text-teal-50 max-w-xl">
              Queue scans, track your manifest, and share live location — all in one place.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-lg">
              {user?.fullName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "D"}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Ready" value={summary.ready} icon="cube-outline" accent="bg-blue-50 text-blue-700 border-blue-200" />
        <MetricCard label="Out now" value={summary.out} icon="navigate-outline" accent="bg-amber-50 text-amber-700 border-amber-200" />
        <MetricCard label="Delivered" value={summary.delivered} icon="checkmark-done-outline" accent="bg-emerald-50 text-emerald-700 border-emerald-200" />
        <MetricCard label="Queued scans" value={summary.queued} icon="scan-outline" accent="bg-purple-50 text-purple-700 border-purple-200" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        {/* Manifest */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">Today&apos;s manifest</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {loading ? "Loading…" : `${orders.length} assigned order${orders.length === 1 ? "" : "s"}`}
              </p>
            </div>
            {orders.length > 0 && (
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700 border border-teal-200">
                {summary.ready} ready
              </span>
            )}
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-semibold text-slate-500">
                Loading manifest…
              </div>
            ) : !orders.length ? (
              <EmptyState
                icon="checkmark-done-circle-outline"
                title="No active assignments"
                subtitle="New offers will appear here when staff assigns you to an order."
              />
            ) : (
              orders.map((order) => {
                const selected = selectedOrderId === order.id;
                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`block rounded-[1.4rem] border p-4 transition cursor-pointer ${
                      selected ? "border-teal-300 bg-teal-50/60" : "border-slate-200 bg-slate-50/70 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${
                            order.status === "delivered" ? "bg-emerald-100 text-emerald-700" :
                            order.status === "picked_up" ? "bg-amber-100 text-amber-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {order.status.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm font-black text-slate-950">{order.customer_name}</span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-600" dir="ltr">
                          {order.customer_phone}
                        </p>
                        {order.customer_address && (
                          <p className="mt-1 text-sm font-semibold text-slate-500 line-clamp-1">
                            {formatAddress(order.customer_address)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-950">{formatPrice(order.total)}</p>
                        {order.qr_token && (
                          <p className="text-[11px] font-mono text-slate-400 mt-1">#{order.qr_token.slice(-8)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Scan queue */}
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Flash scan queue</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Paste or scan order QR tokens. They&apos;ll be committed in one batch.
            </p>

            <div className="mt-4 flex gap-2">
              <input
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    queueScan(scanInput);
                  }
                }}
                placeholder="Paste or scan order QR token"
                className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              <button
                type="button"
                onClick={() => queueScan(scanInput)}
                disabled={!scanInput.trim()}
                className="rounded-xl bg-teal-600 px-4 text-sm font-black text-white disabled:opacity-40 hover:bg-teal-700 transition"
              >
                Add
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {queuedScans.length ? (
                <>
                  {queuedScans.map((entry) => (
                    <div key={entry.code} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-900 truncate">{entry.code}</p>
                        <p className="text-xs font-semibold text-slate-500">
                          {new Date(entry.scanned_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQueuedScans((current) => current.filter((item) => item.code !== entry.code))}
                        className="text-xs font-black text-rose-600 hover:text-rose-700 ml-3"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => void commitQueue()}
                    disabled={committing}
                    className="w-full mt-3 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50 hover:bg-slate-800 transition"
                  >
                    {committing ? "Committing…" : `Commit ${queuedScans.length} scan${queuedScans.length === 1 ? "" : "s"}`}
                  </button>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-semibold text-slate-500">
                  No queued scans yet. Paste or scan an order QR token above.
                </div>
              )}
            </div>
          </div>

          {/* Location sharing */}
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Location sharing</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Send a live location update for the selected order.
            </p>
            {selectedOrderId ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-slate-50 px-4 py-3 border border-slate-200">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">Selected order</p>
                  <p className="text-sm font-black text-slate-900 mt-1">#{selectedOrderId.slice(-8).toUpperCase()}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void shareLocation()}
                  disabled={sharingLocation}
                  className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50 hover:bg-teal-700 transition"
                >
                  {sharingLocation ? "Sharing…" : "Share current location"}
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                Select an order from the manifest to share location.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; icon: string; accent: string }) {
  return (
    <div className={`rounded-[1.4rem] border px-4 py-4 ${accent}`}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-black uppercase tracking-[0.22em] opacity-70">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}

function EmptyState({ title, subtitle, icon }: { title: string; subtitle: string; icon: string }) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-semibold text-slate-500">
      <div className="mb-2 text-2xl">{icon}</div>
      <p className="text-slate-900 font-bold">{title}</p>
      <p>{subtitle}</p>
    </div>
  );
}
