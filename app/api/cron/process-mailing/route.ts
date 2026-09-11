import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/mailing/auth";
import { findResumableRunningCampaigns } from "@/lib/mailing/campaign";
import { createServiceClient } from "@/lib/supabase/service";
import {
  CRON_LOOP_MAX_MS,
  runCampaignWorkerLoop,
} from "@/lib/mailing/worker";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createServiceClient();
    const resumable = await findResumableRunningCampaigns(admin);
    const results = [];
    const startedAt = Date.now();
    const deadlineAt = startedAt + 52_000;

    for (const row of resumable) {
      const remaining = deadlineAt - Date.now();
      if (remaining < 12_000) break;
      const result = await runCampaignWorkerLoop(admin, row.id, {
        maxDurationMs: Math.min(CRON_LOOP_MAX_MS, remaining),
      });
      results.push({ campaignId: row.id, ...result });
    }

    return NextResponse.json({
      success: true,
      resumed: resumable.length,
      results,
    });
  } catch (err) {
    console.error("[pm/cron/mailing]", (err as Error).message);
    return NextResponse.json({ error: "cron failed" }, { status: 500 });
  }
}
