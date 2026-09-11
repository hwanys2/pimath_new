import { NextResponse } from "next/server";
import { requireMailingAdmin } from "@/lib/mailing/auth";
import {
  CAMPAIGN_TABLE,
  getAudienceCounts,
  getCampaignFailureSamples,
  listCampaigns,
  mapCampaignApi,
  nowIso,
} from "@/lib/mailing/campaign";
import { isMailAudience, type MailAudience } from "@/lib/mailing/types";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireMailingAdmin();
  if (!gate.ok) return gate.response;

  try {
    const [campaigns, audienceCounts] = await Promise.all([
      listCampaigns(gate.admin),
      getAudienceCounts(gate.admin),
    ]);
    const failureSamples = await getCampaignFailureSamples(
      gate.admin,
      campaigns.map((c) => c.id),
    );
    return NextResponse.json({
      audienceCounts,
      recipientCount: audienceCounts.marketing,
      campaigns: campaigns.map((c) => ({
        ...mapCampaignApi(c),
        lastFailure: failureSamples[c.id] ?? null,
      })),
    });
  } catch (err) {
    console.error("[pm/mailing] list failed:", (err as Error).message);
    return NextResponse.json({ error: "목록을 불러오지 못했어요." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await requireMailingAdmin();
  if (!gate.ok) return gate.response;

  let body: { subject?: string; bodyHtml?: string; audience?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subject = String(body.subject ?? "").trim();
  const bodyHtml = String(body.bodyHtml ?? "").trim();
  const audience: MailAudience = isMailAudience(body.audience)
    ? body.audience
    : "marketing";

  if (!subject || !bodyHtml) {
    return NextResponse.json(
      { error: "제목과 본문을 입력해 주세요." },
      { status: 400 },
    );
  }
  if (subject.length > 200 || bodyHtml.length > 100_000) {
    return NextResponse.json({ error: "내용이 너무 길어요." }, { status: 400 });
  }

  try {
    const { data, error } = await gate.admin
      .from(CAMPAIGN_TABLE)
      .insert({
        created_by: gate.userId,
        subject,
        body_html: bodyHtml,
        audience,
        status: "draft",
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ campaign: mapCampaignApi(data) });
  } catch (err) {
    console.error("[pm/mailing] create failed:", (err as Error).message);
    return NextResponse.json({ error: "캠페인을 만들지 못했어요." }, { status: 500 });
  }
}
