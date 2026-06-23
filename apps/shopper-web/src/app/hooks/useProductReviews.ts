/**
 * useProductReviews.ts — React Query hooks for the product reviews ecosystem.
 *
 * Built on top of lib/reviewsApi.ts. Provides:
 *   useProductReviews   — paginated review list with sort/filter
 *   useReviewStats      — aggregate stats (avg / distribution / counts)
 *   useMyReview         — the current user's review for a product (if any)
 *   useMyHelpfulVotes   — set of review ids the current user marked helpful
 *   useSubmitReview     — upsert mutation
 *   useDeleteReview     — delete mutation
 *   useToggleHelpful    — helpful-vote toggle mutation
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  deleteReview,
  getMyReview,
  getReviewStats,
  listMyHelpfulVotes,
  listReviews,
  toggleHelpful,
  upsertReview,
  type ListReviewsArgs,
  type ReviewRow,
  type ReviewStats,
  type SubmitReviewInput,
} from "../../lib/reviewsApi";

// ─── Query keys ─────────────────────────────────────────────────────────────

const keys = {
  list:    (args: ListReviewsArgs) => ["reviews", "list", args] as const,
  stats:   (productId: string) => ["reviews", "stats", productId] as const,
  mine:    (productId: string, userId: string | undefined) =>
    ["reviews", "mine", productId, userId ?? "anon"] as const,
  helpful: (productId: string, userId: string | undefined) =>
    ["reviews", "helpful", productId, userId ?? "anon"] as const,
};

// ─── Reads ──────────────────────────────────────────────────────────────────

export function useProductReviews(
  args: ListReviewsArgs,
  options?: Omit<UseQueryOptions<ReviewRow[]>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: keys.list(args),
    queryFn:  () => listReviews(args),
    staleTime: 30_000,
    ...options,
  });
}

export function useReviewStats(productId: string | undefined) {
  return useQuery({
    queryKey: keys.stats(productId ?? ""),
    queryFn:  () => getReviewStats(productId!),
    enabled:  !!productId,
    staleTime: 30_000,
    initialData: { totalReviews: 0, averageRating: 0, distribution: [0,0,0,0,0], verifiedCount: 0, photoCount: 0 } as ReviewStats,
  });
}

export function useMyReview(productId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: keys.mine(productId ?? "", userId),
    queryFn:  () => getMyReview(productId!, userId!),
    enabled:  !!productId && !!userId,
    staleTime: 60_000,
  });
}

export function useMyHelpfulVotes(productId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: keys.helpful(productId ?? "", userId),
    queryFn:  () => listMyHelpfulVotes(productId!, userId!),
    enabled:  !!productId && !!userId,
    staleTime: 60_000,
    initialData: new Set<string>(),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useSubmitReview(productId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<SubmitReviewInput, "productId" | "userId">) =>
      upsertReview({ ...input, productId: productId!, userId: userId! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
}

export function useDeleteReview(productId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => deleteReview(reviewId, userId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: keys.mine(productId ?? "", userId) });
    },
  });
}

export function useToggleHelpful(_productId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => toggleHelpful(reviewId, userId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
}
