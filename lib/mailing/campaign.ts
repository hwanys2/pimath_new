import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const CAMPAIGN_TABLE = "pm_mailing_campaigns";
export const RECIPIENT_TABLE = "pm_mailing_recipients";
export const BATCH_SIZE = 80;
export const LOCK_DURATION_MS = 90_000;
export const STALE_SENDING_MS = 5 * 60_000;

export type CampaignStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";

export type CampaignRow = {
  id: string;
  created_by: string;
  subject: string;
  body_html: string;
  status: CampaignStatus;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  error_message: string | null;
  locked_until: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipientRow = {
  id: string;
  campaign_id: string;
  user_id: string;
  email: string;
  status: "pending" | "sending" | "sent" | "failed" | "skipped";
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function isTransientWorkerError(err: unknown): boolean {
  const msg = String(
    (err as { message?: string } | null)?.message || err || "",
  ).toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("socket hang up")
  );
}

export async function getCampaign(
  admin: SupabaseClient,
  campaignId: string,
): Promise<CampaignRow | null> {
  const { data, error } = await admin
    .from(CAMPAIGN_TABLE)
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw error;
  return data as CampaignRow | null;
}

export async function updateCampaign(
  admin: SupabaseClient,
  campaignId: string,
  patch: Record<string, unknown>,
): Promise<CampaignRow> {
  const { data, error } = await admin
    .from(CAMPAIGN_TABLE)
    .update({ ...patch, updated_at: nowIso() })
    .eq("id", campaignId)
    .select("*")
    .single();
  if (error) throw error;
  return data as CampaignRow;
}

export async function listCampaigns(
  admin: SupabaseClient,
  { limit = 40 }: { limit?: number } = {},
): Promise<CampaignRow[]> {
  const { data, error } = await admin
    .from(CAMPAIGN_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as CampaignRow[]) ?? [];
}

export async function countMarketingRecipients(
  admin: SupabaseClient,
): Promise<number> {
  const { count, error } = await admin
    .from("pm_profiles")
    .select("*", { count: "exact", head: true })
    .eq("mail_marketing_consent", true)
    .neq("email", "");
  if (error) throw error;
  return count ?? 0;
}

export async function snapshotRecipients(
  admin: SupabaseClient,
  campaignId: string,
): Promise<number> {
  const { data, error } = await admin
    .from("pm_profiles")
    .select("user_id, email")
    .eq("mail_marketing_consent", true)
    .neq("email", "");
  if (error) throw error;

  const rows = (data ?? [])
    .filter((r) => typeof r.email === "string" && r.email.includes("@"))
    .map((r) => ({
      campaign_id: campaignId,
      user_id: r.user_id as string,
      email: String(r.email).trim().toLowerCase(),
      status: "pending" as const,
    }));

  if (rows.length === 0) return 0;

  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error: insertError } = await admin
      .from(RECIPIENT_TABLE)
      .upsert(slice, { onConflict: "campaign_id,user_id", ignoreDuplicates: true });
    if (insertError) throw insertError;
  }
  return rows.length;
}

export async function tryAcquireLock(
  admin: SupabaseClient,
  campaign: CampaignRow,
): Promise<boolean> {
  const now = new Date();
  if (campaign.locked_until && new Date(campaign.locked_until) > now) {
    return false;
  }
  const lockUntil = new Date(now.getTime() + LOCK_DURATION_MS).toISOString();
  let query = admin
    .from(CAMPAIGN_TABLE)
    .update({ locked_until: lockUntil, updated_at: nowIso() })
    .eq("id", campaign.id)
    .eq("status", "running");

  if (campaign.locked_until) {
    query = query.lte("locked_until", now.toISOString());
  } else {
    query = query.is("locked_until", null);
  }

  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function extendLock(
  admin: SupabaseClient,
  campaignId: string,
): Promise<void> {
  const lockUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
  const { error } = await admin
    .from(CAMPAIGN_TABLE)
    .update({ locked_until: lockUntil, updated_at: nowIso() })
    .eq("id", campaignId)
    .eq("status", "running");
  if (error) throw error;
}

export async function releaseLock(
  admin: SupabaseClient,
  campaignId: string,
): Promise<void> {
  const { error } = await admin
    .from(CAMPAIGN_TABLE)
    .update({ locked_until: null, updated_at: nowIso() })
    .eq("id", campaignId);
  if (error) throw error;
}

export async function releaseExpiredLock(
  admin: SupabaseClient,
  campaignId: string,
): Promise<void> {
  const campaign = await getCampaign(admin, campaignId);
  if (!campaign?.locked_until) return;
  if (new Date(campaign.locked_until) > new Date()) return;
  await updateCampaign(admin, campaignId, { locked_until: null });
}

export async function recoverStaleSendingRecipients(
  admin: SupabaseClient,
  campaignId: string,
): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_SENDING_MS).toISOString();
  const { error } = await admin
    .from(RECIPIENT_TABLE)
    .update({ status: "pending", updated_at: nowIso() })
    .eq("campaign_id", campaignId)
    .eq("status", "sending")
    .lt("updated_at", cutoff);
  if (error) throw error;
}

async function statusCount(
  admin: SupabaseClient,
  campaignId: string,
  status: string,
): Promise<number> {
  const { count, error } = await admin
    .from(RECIPIENT_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", status);
  if (error) throw error;
  return count ?? 0;
}

export async function refreshCampaignCounts(
  admin: SupabaseClient,
  campaignId: string,
): Promise<CampaignRow> {
  const [sent, failed, skipped, pending, sending] = await Promise.all([
    statusCount(admin, campaignId, "sent"),
    statusCount(admin, campaignId, "failed"),
    statusCount(admin, campaignId, "skipped"),
    statusCount(admin, campaignId, "pending"),
    statusCount(admin, campaignId, "sending"),
  ]);
  return updateCampaign(admin, campaignId, {
    sent_count: sent,
    failed_count: failed,
    skipped_count: skipped,
    total_recipients: sent + failed + skipped + pending + sending,
  });
}

export async function countActionableRecipients(
  admin: SupabaseClient,
  campaignId: string,
): Promise<number> {
  const pending = await statusCount(admin, campaignId, "pending");
  const sending = await statusCount(admin, campaignId, "sending");
  const { data: failedRows, error } = await admin
    .from(RECIPIENT_TABLE)
    .select("attempt_count, max_attempts")
    .eq("campaign_id", campaignId)
    .eq("status", "failed");
  if (error) throw error;
  const retryable = (failedRows ?? []).filter(
    (r) => (r.attempt_count as number) < (r.max_attempts as number),
  ).length;
  return pending + sending + retryable;
}

export async function findResumableRunningCampaigns(
  admin: SupabaseClient,
): Promise<{ id: string }[]> {
  const nowMs = Date.now();
  const { data, error } = await admin
    .from(CAMPAIGN_TABLE)
    .select("id, status, locked_until, error_message")
    .in("status", ["running", "failed"]);
  if (error) throw error;

  const out: { id: string }[] = [];
  for (const row of data ?? []) {
    const runningOk =
      row.status === "running" &&
      (!row.locked_until || new Date(row.locked_until).getTime() <= nowMs);
    const failedTransient =
      row.status === "failed" &&
      isTransientWorkerError({ message: row.error_message });
    if (!runningOk && !failedTransient) continue;
    const actionable = await countActionableRecipients(admin, row.id);
    if (actionable > 0) out.push({ id: row.id });
  }
  return out;
}

export async function isRecipientStillConsenting(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("pm_profiles")
    .select("mail_marketing_consent, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return !!(
    data?.mail_marketing_consent &&
    typeof data.email === "string" &&
    data.email.includes("@")
  );
}

export function mapCampaignApi(campaign: CampaignRow) {
  const total = campaign.total_recipients || 0;
  const processed =
    (campaign.sent_count || 0) +
    (campaign.failed_count || 0) +
    (campaign.skipped_count || 0);
  return {
    id: campaign.id,
    subject: campaign.subject,
    bodyHtml: campaign.body_html,
    status: campaign.status,
    totalRecipients: total,
    sentCount: campaign.sent_count,
    failedCount: campaign.failed_count,
    skippedCount: campaign.skipped_count,
    pendingCount: Math.max(total - processed, 0),
    progressPercent: total > 0 ? Math.round((processed / total) * 100) : 0,
    errorMessage: campaign.error_message,
    startedAt: campaign.started_at,
    completedAt: campaign.completed_at,
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
  };
}
