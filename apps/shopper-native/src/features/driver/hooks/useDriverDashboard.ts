import { useQueries, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  listMyManifest,
  getMyDriverProfile,
  getMyAcceptanceRate,
  listMyEarnings,
  type DriverEarningRecord,
} from "../api";
import {
  computeTodayEarnings,
  computeCompletedToday,
  computeWeeklyEarnings,
  computeStreakDays,
} from "../lib/driverMetrics";
import { sortByUrgency } from "../lib/stageMachine";
import { getDeliveryStage, getStageAction, type DeliveryStage, type StageAction } from "../lib/deliveryStage";
import { useDriverMutations } from "./useDriverMutations";
import {
  driverQueryKeys,
} from "./useDriverManifest";
import { driverProfileQueryKeys } from "./useDriverProfile";
import type {
  ManifestOrder,
  DriverProfileRecord,
} from "../types/driver";

export interface UseDriverDashboardResult {
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  driverProfile: DriverProfileRecord | null | undefined;
  isOnline: boolean;
  manifestOrders: ManifestOrder[];
  sortedOrders: ManifestOrder[];
  spotlightOrder: ManifestOrder | null;
  spotlightStage: DeliveryStage | null;
  spotlightAction: StageAction | null;
  todayEarnings: number;
  completedToday: number;
  acceptanceRate: number | null;
  weeklyEarnings: Array<{ date: Date; total: number }>;
  streakDays: number;
  activeOrdersCount: number;
  refetch: () => void;
  mutations: ReturnType<typeof useDriverMutations>;
}

export function useDriverDashboard(
  driverId: string | null | undefined,
): UseDriverDashboardResult {
  const results = useQueries({
    queries: [
      {
        queryKey: driverQueryKeys.manifest(driverId ?? ""),
        queryFn: () => listMyManifest(driverId!),
        enabled: Boolean(driverId),
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        retry: 2,
        refetchOnWindowFocus: false,
      },
      {
        queryKey: driverProfileQueryKeys.mine(driverId ?? ""),
        queryFn: () => getMyDriverProfile(driverId!),
        enabled: Boolean(driverId),
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        retry: 2,
        refetchOnWindowFocus: false,
      },
      {
        queryKey: driverQueryKeys.acceptanceRate(driverId ?? ""),
        queryFn: () => getMyAcceptanceRate(driverId!),
        enabled: Boolean(driverId),
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
        refetchOnWindowFocus: false,
      },
    ] as UseQueryOptions<any, any, any, any>[],
  });

  const [
    manifestResult,
    profileResult,
    acceptanceRateResult,
  ] = results;

  const manifestOrders = (manifestResult.data ?? []) as ManifestOrder[];
  const driverProfile = profileResult.data ?? null;
  const acceptanceRate = acceptanceRateResult.data ?? null;

  const driverProfileId = driverProfile?.id;

  // Separate from the useQueries batch above: its key needs
  // driverProfile.id, which only resolves after the profile query does, so
  // it can't share that batch's driverId-keyed shape. Was previously
  // computed as a config object and then read back via results[3] -- but
  // that array only ever had 3 entries, so this was silently always the
  // empty-array fallback and no earnings ever actually loaded.
  const earningsResult = useQuery({
    queryKey: driverProfileQueryKeys.earnings(driverProfileId ?? ""),
    queryFn: () => listMyEarnings(driverProfileId!),
    enabled: Boolean(driverProfileId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const isLoading = results.some((r) => r.isLoading) || (Boolean(driverProfileId) && earningsResult.isLoading);
  const isRefetching = results.some((r) => r.isFetching) || earningsResult.isFetching;
  const error = results.find((r) => r.isError)?.error ?? (earningsResult.isError ? earningsResult.error : null);

  const earnings = (earningsResult.data ?? []) as DriverEarningRecord[];

  const sortedOrders = sortByUrgency(manifestOrders);

  const spotlightOrder = sortedOrders.find(
    (o: ManifestOrder) =>
      getDeliveryStage(o.status, {
        assignmentKind: o.assignmentKind,
        arrivedAtPharmacy: o.arrivedAtPharmacy,
        pickedUpAt: o.pickedUpAt,
        arrivedAtCustomer: o.arrivedAtCustomer,
      }) !== "delivered",
  ) ?? null;

  const spotlightStage = spotlightOrder
    ? getDeliveryStage(spotlightOrder.status, {
        assignmentKind: spotlightOrder.assignmentKind,
        arrivedAtPharmacy: spotlightOrder.arrivedAtPharmacy,
        pickedUpAt: spotlightOrder.pickedUpAt,
        arrivedAtCustomer: spotlightOrder.arrivedAtCustomer,
      })
    : null;

  const spotlightAction = spotlightStage
    ? getStageAction(spotlightStage, spotlightOrder?.assignmentKind)
    : null;

  const todayEarnings = computeTodayEarnings(earnings);
  const completedToday = computeCompletedToday(manifestOrders);
  const weeklyEarningsRaw = computeWeeklyEarnings(earnings);
  const weeklyEarnings = weeklyEarningsRaw.map((d) => ({
    date: new Date(d.date),
    total: d.total,
  }));
  const streakDays = computeStreakDays(earnings);
  const activeOrdersCount = manifestOrders.filter(
    (o: ManifestOrder) => o.status !== "delivered" && o.status !== "archived",
  ).length;

  const mutations = useDriverMutations(driverId ?? undefined);

  const refetch = () => {
    results.forEach((r) => {
      if (r.refetch) void r.refetch();
    });
    void earningsResult.refetch();
  };

  return {
    isLoading,
    isRefetching,
    error,
    driverProfile,
    isOnline: driverProfile?.isOnline ?? false,
    manifestOrders,
    sortedOrders,
    spotlightOrder,
    spotlightStage,
    spotlightAction,
    todayEarnings,
    completedToday,
    acceptanceRate,
    weeklyEarnings,
    streakDays,
    activeOrdersCount,
    refetch,
    mutations,
  };
}
