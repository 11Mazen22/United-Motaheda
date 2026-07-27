/**
 * useSMSCampaign — manages the full SMS campaign lifecycle from the UI:
 *
 *   1. Create campaign + recipient rows
 *   2. Queue it
 *   3. Process batches sequentially with rate-limit delay between them
 *   4. Poll campaign status during processing
 *   5. Cancel
 *
 * The hook owns the "send in progress" loop so the component stays thin.
 * Progress is tracked locally (batchProgress) and via React Query
 * invalidation (campaigns list re-fetches automatically after each batch).
 */

import { useState, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketingApi, type SMSCampaign, type MarketingUser } from '@/lib/api';

export const VALID_BATCH_SIZES = [100, 200] as const;
export type  BatchSize = typeof VALID_BATCH_SIZES[number];

export interface CampaignProgress {
  batchIndex:    number;
  totalBatches:  number;
  sent:          number;
  failed:        number;
  done:          boolean;
}

export function useSMSCampaign() {
  const qc = useQueryClient();

  // ── Campaign list ──────────────────────────────────────────────────────────
  const campaignsQuery = useQuery({
    queryKey: ['marketing', 'campaigns'],
    queryFn:  marketingApi.getCampaigns,
    staleTime: 15_000,
    gcTime:    5 * 60_000,
  });

  // ── Create campaign ────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: marketingApi.createCampaign,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] }),
  });

  // ── Queue mutation ─────────────────────────────────────────────────────────
  const queueMutation = useMutation({
    mutationFn: marketingApi.queueCampaign,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] }),
  });

  // ── Cancel mutation ────────────────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: marketingApi.cancelCampaign,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] }),
  });

  // ── Batch processing loop ──────────────────────────────────────────────────
  const [progress, setProgress]   = useState<CampaignProgress | null>(null);
  const cancelledRef              = useRef(false);

  /**
   * Launch the campaign: queue it, then process all batches sequentially.
   * Respects campaign.rate_limit_secs between batches.
   * Sets progress state so the UI can show a progress bar.
   *
   * Since there is only one batch (batch_index = 0) for 100/200-selection
   * campaigns, this loop typically runs exactly once.
   */
  const launchCampaign = useCallback(async (campaign: SMSCampaign) => {
    cancelledRef.current = false;

    // Queue the campaign first.
    await marketingApi.queueCampaign(campaign.id);
    await qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] });

    const totalBatches = Math.ceil(campaign.total_recipients / campaign.batch_size);
    let totalSent   = 0;
    let totalFailed = 0;

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      if (cancelledRef.current) break;

      setProgress({
        batchIndex:   batchIdx,
        totalBatches,
        sent:         totalSent,
        failed:       totalFailed,
        done:         false,
      });

      const result = await marketingApi.processBatch(campaign.id, batchIdx);
      totalSent   += result.sent;
      totalFailed += result.failed;

      await qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] });

      if (result.campaign_done || cancelledRef.current) break;

      // Rate-limit: wait between batches (not needed for single-batch, but
      // correct for future multi-batch campaigns).
      if (batchIdx < totalBatches - 1) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, (campaign.rate_limit_secs ?? 60) * 1000),
        );
      }
    }

    setProgress({
      batchIndex:   totalBatches - 1,
      totalBatches,
      sent:         totalSent,
      failed:       totalFailed,
      done:         true,
    });

    await qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] });
  }, [qc]);

  const cancelActiveBatch = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  // ── Audit log query (on-demand, keyed by campaign ID) ─────────────────────
  const [auditCampaignId, setAuditCampaignId] = useState<string | null>(null);

  const auditQuery = useQuery({
    queryKey: ['marketing', 'audit', auditCampaignId],
    queryFn:  () => marketingApi.getAuditLog(auditCampaignId!),
    enabled:  auditCampaignId !== null,
    staleTime: 10_000,
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Validate that the selected users array is exactly batchSize (100 or 200).
   * Returns null on success or an error message string.
   */
  const validateSelection = useCallback(
    (selected: MarketingUser[], batchSize: BatchSize): string | null => {
      if (!VALID_BATCH_SIZES.includes(batchSize)) {
        return `Batch size must be exactly 100 or 200. Got: ${batchSize}`;
      }
      if (selected.length !== batchSize) {
        return `You must select exactly ${batchSize} users. Currently selected: ${selected.length}`;
      }
      const noPhone = selected.filter((u) => !u.phone);
      if (noPhone.length > 0) {
        return `${noPhone.length} selected user(s) have no phone number and cannot receive SMS`;
      }
      return null;
    },
    [],
  );

  return {
    // Campaign list
    campaigns:       (campaignsQuery.data ?? []) as SMSCampaign[],
    campaignsLoading: campaignsQuery.isLoading,
    campaignsError:  campaignsQuery.isError,

    // Create
    createCampaign:   createMutation.mutateAsync,
    creating:         createMutation.isPending,
    createError:      createMutation.error?.message ?? null,

    // Queue
    queueCampaign:    queueMutation.mutateAsync,
    queuing:          queueMutation.isPending,

    // Cancel
    cancelCampaign:   cancelMutation.mutateAsync,
    cancelling:       cancelMutation.isPending,

    // Batch processing
    launchCampaign,
    cancelActiveBatch,
    progress,

    // Audit log
    auditCampaignId,
    setAuditCampaignId,
    auditLog:        auditQuery.data ?? [],
    auditLoading:    auditQuery.isLoading,

    // Validation
    validateSelection,
    VALID_BATCH_SIZES,
  };
}
