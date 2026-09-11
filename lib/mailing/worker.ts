import "server-only";
import { waitUntil } from "@vercel/functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BATCH_SIZE,
  RECIPIENT_TABLE,
  type CampaignRow,
  type RecipientRow,
  countActionableRecipients,
  extendLock,
  getCampaign,
  isTransientWorkerError,
  nowIso,
  recoverStaleSendingRecipients,
  refreshCampaignCounts,
  releaseExpiredLock,
  releaseLock,
  tryAcquireLock,
  updateCampaign,
  isRecipientStillConsenting,
} from "@/lib/mailing/campaign";
import {
  buildEmailHtml,
  createMailTransporter,
  sendOneEmail,
  sleep,
  SEND_DELAY_MS,
} from "@/lib/mailing/email";
import { unsubscribeUrlForUser } from "@/lib/mailing/unsubscribe";

export const DEFAULT_LOOP_MAX_MS = 280_000;
export const CRON_LOOP_MAX_MS = 42_000;
const MIN_RECIPIENT_TIME_REMAINING_MS = 8_000;

function hasTimeForRecipient(deadlineAt: number): boolean {
  return Date.now() + MIN_RECIPIENT_TIME_REMAINING_MS < deadlineAt;
}

export function scheduleCampaignWorker(
  admin: SupabaseClient,
  campaignId: string,
  { maxDurationMs = DEFAULT_LOOP_MAX_MS }: { maxDurationMs?: number } = {},
): void {
  waitUntil(
    runCampaignWorkerLoop(admin, campaignId, { maxDurationMs }).catch((err) => {
      console.error(
        "[pm/mailing] worker failed:",
        campaignId,
        (err as Error)?.message || err,
      );
    }),
  );
}

export async function runCampaignWorkerLoop(
  admin: SupabaseClient,
  campaignId: string,
  { maxDurationMs = DEFAULT_LOOP_MAX_MS }: { maxDurationMs?: number } = {},
) {
  const deadlineAt = Date.now() + maxDurationMs;
  let campaign = await getCampaign(admin, campaignId);
  if (!campaign) {
    return { ok: false, reason: "not_found", needsContinuation: false };
  }

  if (
    campaign.status === "failed" &&
    isTransientWorkerError({ message: campaign.error_message })
  ) {
    const actionable = await countActionableRecipients(admin, campaignId);
    if (actionable > 0) {
      campaign = await updateCampaign(admin, campaignId, {
        status: "running",
        error_message: null,
        locked_until: null,
      });
    }
  }

  if (campaign.status === "running" && (campaign.total_recipients || 0) === 0) {
    await updateCampaign(admin, campaignId, {
      status: "completed",
      completed_at: nowIso(),
      locked_until: null,
      error_message: "발송 대상이 없습니다.",
    });
    return { ok: true, reason: "no_recipients", needsContinuation: false };
  }

  let needsContinuation = campaign.status === "running";
  let batchesRun = 0;

  while (needsContinuation && hasTimeForRecipient(deadlineAt)) {
    const result = await processCampaignBatch(admin, campaignId, { deadlineAt });
    batchesRun += 1;
    needsContinuation = result.needsContinuation;
    if (result.reason === "locked") {
      await sleep(400);
    }
  }

  return {
    ok: true,
    needsContinuation,
    batchesRun,
    timedOut: needsContinuation && !hasTimeForRecipient(deadlineAt),
  };
}

async function fetchActionableBatch(
  admin: SupabaseClient,
  campaignId: string,
): Promise<RecipientRow[]> {
  const { data: pending, error: e1 } = await admin
    .from(RECIPIENT_TABLE)
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (e1) throw e1;

  const remaining = BATCH_SIZE - (pending?.length || 0);
  let failed: RecipientRow[] = [];
  if (remaining > 0) {
    const { data: failedRows, error: e2 } = await admin
      .from(RECIPIENT_TABLE)
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "failed")
      .order("updated_at", { ascending: true })
      .limit(remaining * 3);
    if (e2) throw e2;
    failed = ((failedRows as RecipientRow[]) || [])
      .filter((r) => r.attempt_count < r.max_attempts)
      .slice(0, remaining);
  }

  return [...((pending as RecipientRow[]) || []), ...failed];
}

export async function processCampaignBatch(
  admin: SupabaseClient,
  campaignId: string,
  { deadlineAt = Number.POSITIVE_INFINITY }: { deadlineAt?: number } = {},
) {
  let campaign = await getCampaign(admin, campaignId);
  if (!campaign) {
    return { ok: false, reason: "not_found", needsContinuation: false };
  }
  if (campaign.status !== "running") {
    return {
      ok: true,
      reason: "not_running",
      status: campaign.status,
      needsContinuation: false,
    };
  }

  await releaseExpiredLock(admin, campaignId);
  campaign = (await getCampaign(admin, campaignId)) as CampaignRow;

  let locked = await tryAcquireLock(admin, campaign);
  if (!locked) {
    await releaseExpiredLock(admin, campaignId);
    campaign = (await getCampaign(admin, campaignId)) as CampaignRow;
    locked = await tryAcquireLock(admin, campaign);
  }
  if (!locked) {
    return { ok: true, reason: "locked", needsContinuation: true };
  }

  try {
    await recoverStaleSendingRecipients(admin, campaignId);
    campaign = (await getCampaign(admin, campaignId)) as CampaignRow;
    if (campaign.status !== "running") {
      await releaseLock(admin, campaignId);
      return {
        ok: true,
        reason: "not_running",
        status: campaign.status,
        needsContinuation: false,
      };
    }

    const recipients = await fetchActionableBatch(admin, campaignId);
    if (recipients.length === 0) {
      const actionable = await countActionableRecipients(admin, campaignId);
      if (actionable === 0) {
        await updateCampaign(admin, campaignId, {
          status: "completed",
          completed_at: nowIso(),
          locked_until: null,
          error_message: null,
        });
        await refreshCampaignCounts(admin, campaignId);
        return { ok: true, reason: "completed", needsContinuation: false };
      }
      await releaseLock(admin, campaignId);
      return { ok: true, reason: "waiting", needsContinuation: true };
    }

    const transporter = createMailTransporter();
    let batchSent = 0;
    let batchFailed = 0;

    for (const recipient of recipients) {
      if (!hasTimeForRecipient(deadlineAt)) break;

      campaign = (await getCampaign(admin, campaignId)) as CampaignRow;
      if (campaign.status !== "running") break;

      await admin
        .from(RECIPIENT_TABLE)
        .update({ status: "sending", updated_at: nowIso() })
        .eq("id", recipient.id)
        .in("status", ["pending", "failed"]);

      const eligible = await isRecipientStillConsenting(
        admin,
        recipient.user_id,
      );
      if (!eligible) {
        await admin
          .from(RECIPIENT_TABLE)
          .update({
            status: "skipped",
            last_error: "unsubscribed_or_no_email",
            updated_at: nowIso(),
          })
          .eq("id", recipient.id);
        continue;
      }

      const html = buildEmailHtml(campaign.body_html, {
        unsubscribeLink: unsubscribeUrlForUser(recipient.user_id),
        subject: campaign.subject,
      });

      try {
        await sendOneEmail(transporter, {
          to: recipient.email,
          subject: campaign.subject,
          html,
        });
        await admin
          .from(RECIPIENT_TABLE)
          .update({
            status: "sent",
            sent_at: nowIso(),
            last_error: null,
            updated_at: nowIso(),
          })
          .eq("id", recipient.id);
        batchSent += 1;
      } catch (mailErr) {
        const attemptCount = (recipient.attempt_count || 0) + 1;
        const exhausted = attemptCount >= recipient.max_attempts;
        await admin
          .from(RECIPIENT_TABLE)
          .update({
            status: exhausted ? "failed" : "pending",
            attempt_count: attemptCount,
            last_error: (mailErr as Error)?.message || "발송 실패",
            updated_at: nowIso(),
          })
          .eq("id", recipient.id);
        batchFailed += 1;
      }

      await extendLock(admin, campaignId);
      await sleep(SEND_DELAY_MS);
    }

    await refreshCampaignCounts(admin, campaignId);
    const actionable = await countActionableRecipients(admin, campaignId);
    if (actionable === 0) {
      await updateCampaign(admin, campaignId, {
        status: "completed",
        completed_at: nowIso(),
        locked_until: null,
        error_message: null,
      });
      return {
        ok: true,
        reason: "completed",
        sent: batchSent,
        failed: batchFailed,
        needsContinuation: false,
      };
    }

    await releaseLock(admin, campaignId);
    return {
      ok: true,
      reason: "continue",
      sent: batchSent,
      failed: batchFailed,
      needsContinuation: true,
    };
  } catch (err) {
    const message = (err as Error)?.message || "worker error";
    console.error("[pm/mailing] batch error:", campaignId, message);
    await updateCampaign(admin, campaignId, {
      status: isTransientWorkerError(err) ? "failed" : "failed",
      error_message: message,
      locked_until: null,
    }).catch(() => undefined);
    return {
      ok: false,
      reason: "error",
      error: message,
      needsContinuation: isTransientWorkerError(err),
    };
  }
}
