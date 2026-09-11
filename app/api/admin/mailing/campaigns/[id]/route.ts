import { NextResponse } from "next/server";
import { requireMailingAdmin } from "@/lib/mailing/auth";
import {
  getCampaign,
  mapCampaignApi,
  nowIso,
  snapshotRecipients,
  updateCampaign,
} from "@/lib/mailing/campaign";
import type { MailAudience } from "@/lib/mailing/types";
import { scheduleCampaignWorker } from "@/lib/mailing/worker";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

const EMPTY_MSG: Record<MailAudience, string> = {
  test: "관리자 프로필을 찾지 못했어요.",
  marketing: "소식 메일 수신 동의자가 없습니다.",
  system: "발송 대상 교사가 없습니다.",
};

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requireMailingAdmin();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const campaign = await getCampaign(gate.admin, id);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ campaign: mapCampaignApi(campaign) });
}

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requireMailingAdmin();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "start";

  const campaign = await getCampaign(gate.admin, id);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const audience = (campaign.audience ?? "marketing") as MailAudience;

  try {
    if (action === "start") {
      if (
        campaign.status !== "draft" &&
        campaign.status !== "paused" &&
        campaign.status !== "failed"
      ) {
        return NextResponse.json(
          { error: "시작할 수 없는 상태예요." },
          { status: 400 },
        );
      }
      if (campaign.status === "draft") {
        let total: number;
        try {
          total = await snapshotRecipients(gate.admin, id, audience);
        } catch (snapErr) {
          return NextResponse.json(
            { error: (snapErr as Error).message },
            { status: 400 },
          );
        }
        if (total === 0) {
          await updateCampaign(gate.admin, id, {
            status: "completed",
            total_recipients: 0,
            completed_at: nowIso(),
            error_message: EMPTY_MSG[audience],
          });
          const done = await getCampaign(gate.admin, id);
          return NextResponse.json({ campaign: mapCampaignApi(done!) });
        }
        await updateCampaign(gate.admin, id, {
          status: "running",
          total_recipients: total,
          started_at: nowIso(),
          error_message: null,
          locked_until: null,
        });
      } else {
        await updateCampaign(gate.admin, id, {
          status: "running",
          error_message: null,
          locked_until: null,
        });
      }
      scheduleCampaignWorker(gate.admin, id);
      const started = await getCampaign(gate.admin, id);
      return NextResponse.json({ campaign: mapCampaignApi(started!) });
    }

    if (action === "pause") {
      if (campaign.status !== "running") {
        return NextResponse.json({ error: "일시정지할 수 없어요." }, { status: 400 });
      }
      const updated = await updateCampaign(gate.admin, id, {
        status: "paused",
        locked_until: null,
      });
      return NextResponse.json({ campaign: mapCampaignApi(updated) });
    }

    if (action === "cancel") {
      if (!["draft", "running", "paused", "failed"].includes(campaign.status)) {
        return NextResponse.json({ error: "취소할 수 없어요." }, { status: 400 });
      }
      const updated = await updateCampaign(gate.admin, id, {
        status: "cancelled",
        completed_at: nowIso(),
        locked_until: null,
      });
      return NextResponse.json({ campaign: mapCampaignApi(updated) });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[pm/mailing] action failed:", action, (err as Error).message);
    return NextResponse.json({ error: "처리에 실패했어요." }, { status: 500 });
  }
}
