"use client";

import { useCallback, useEffect, useState } from "react";
import MailRichTextEditor from "@/components/admin/MailRichTextEditor";
import {
  AUDIENCE_LABELS,
  type MailAudience,
} from "@/lib/mailing/types";

type Campaign = {
  id: string;
  subject: string;
  audience?: MailAudience;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  pendingCount: number;
  progressPercent: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type AudienceCounts = {
  test: number;
  marketing: number;
  system: number;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  running: "발송 중",
  paused: "일시정지",
  completed: "완료",
  cancelled: "취소",
  failed: "실패",
};

const AUDIENCE_HELP: Record<MailAudience, string> = {
  test: "hwanys2@naver.com 에게만 보냅니다. SES·본문 확인용이에요.",
  marketing: "설정에서 소식 메일 수신에 동의한 교사에게 보냅니다.",
  system: "이메일이 있는 모든 교사에게 보냅니다. (필수 안내용)",
};

export default function AdminMailingClient() {
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState(
    "<p>안녕하세요.</p><p>수학하는 즐거움 소식입니다.</p>",
  );
  const [audience, setAudience] = useState<MailAudience>("test");
  const [audienceCounts, setAudienceCounts] = useState<AudienceCounts | null>(
    null,
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/mailing/campaigns", {
      cache: "no-store",
    });
    if (!res.ok) {
      setError("목록을 불러오지 못했어요.");
      return;
    }
    const data = (await res.json()) as {
      audienceCounts: AudienceCounts;
      campaigns: Campaign[];
    };
    setAudienceCounts(data.audienceCounts);
    setCampaigns(data.campaigns);
    setError(null);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, 8_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function createAndStart(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const createRes = await fetch("/api/admin/mailing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyHtml, audience }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || "생성 실패");
      }
      const id = createData.campaign.id as string;
      const startRes = await fetch(
        `/api/admin/mailing/campaigns/${id}?action=start`,
        { method: "POST" },
      );
      const startData = await startRes.json();
      if (!startRes.ok) {
        throw new Error(startData.error || "시작 실패");
      }
      const label = AUDIENCE_LABELS[audience];
      setMessage(
        audience === "test"
          ? "테스트 메일을 관리자에게 발송했어요."
          : `"${label}" 대상으로 발송을 시작했어요.`,
      );
      if (audience === "test") {
        // keep form for iteration
      } else {
        setSubject("");
      }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runAction(id: string, action: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/mailing/campaigns/${id}?action=${action}`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "실패");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = audienceCounts?.[audience] ?? null;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-wood/15 bg-cream/80 p-5 shadow-sm">
        <h2 className="font-display text-lg text-wood-dark">새 메일</h2>
        <form onSubmit={createAndStart} className="mt-4 space-y-4">
          <fieldset>
            <legend className="text-sm font-semibold text-wood-dark">
              발송 대상
            </legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  "test",
                  "marketing",
                  "system",
                ] as const satisfies readonly MailAudience[]
              ).map((key) => {
                const count = audienceCounts?.[key];
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                      audience === key
                        ? "border-wood/40 bg-wood/10"
                        : "border-wood/15 bg-white/70 hover:bg-wood/5"
                    }`}
                  >
                    <input
                      type="radio"
                      name="audience"
                      className="mt-1"
                      checked={audience === key}
                      onChange={() => setAudience(key)}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-wood-dark">
                        {AUDIENCE_LABELS[key]}
                        <span className="ml-2 text-xs font-medium text-wood/55">
                          {count === undefined ? "…" : `${count}명`}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-wood/60">
                        {AUDIENCE_HELP[key]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="block text-sm font-semibold text-wood-dark">
            제목
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              maxLength={200}
              className="mt-1 w-full rounded-xl border border-wood/20 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-wood/50"
            />
          </label>

          <div>
            <p className="text-sm font-semibold text-wood-dark">본문</p>
            <p className="mt-0.5 text-xs text-wood/55">
              툴바의 <strong>HTML</strong> / <strong>미리보기</strong>로 코드와
              보이는 화면을 전환할 수 있어요.
            </p>
            <div className="mt-2">
              <MailRichTextEditor value={bodyHtml} onChange={setBodyHtml} />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy || !bodyHtml.trim()}
            className="font-display rounded-xl bg-wood px-4 py-2.5 text-sm text-cream transition hover:brightness-110 disabled:opacity-60"
          >
            {busy
              ? "처리 중…"
              : audience === "test"
                ? "테스트 발송 (관리자만)"
                : `만들고 발송${selectedCount !== null ? ` (${selectedCount}명)` : ""}`}
          </button>
        </form>
        {message ? (
          <p className="mt-3 text-sm text-wood/70" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-wood/15 bg-cream/80 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg text-wood-dark">발송 기록</h2>
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-xs font-semibold text-wood/60 hover:text-wood-dark"
          >
            새로고침
          </button>
        </div>
        {campaigns.length === 0 ? (
          <p className="mt-4 text-sm text-wood/60">아직 캠페인이 없어요.</p>
        ) : (
          <ul className="mt-4 divide-y divide-wood/10">
            {campaigns.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-wood-dark">
                      {c.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-wood/55">
                      {STATUS_LABELS[c.status] ?? c.status}
                      {c.audience
                        ? ` · ${AUDIENCE_LABELS[c.audience] ?? c.audience}`
                        : ""}{" "}
                      · {c.sentCount}/{c.totalRecipients} 발송 · 실패{" "}
                      {c.failedCount} · 건너뜀 {c.skippedCount} ·{" "}
                      {c.progressPercent}%
                    </p>
                    {c.errorMessage ? (
                      <p className="mt-1 text-xs text-red-700">{c.errorMessage}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.status === "running" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runAction(c.id, "pause")}
                        className="rounded-lg bg-wood/10 px-2.5 py-1 text-xs font-semibold text-wood-dark"
                      >
                        일시정지
                      </button>
                    ) : null}
                    {c.status === "paused" || c.status === "failed" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runAction(c.id, "start")}
                        className="rounded-lg bg-wood/10 px-2.5 py-1 text-xs font-semibold text-wood-dark"
                      >
                        재개
                      </button>
                    ) : null}
                    {["draft", "running", "paused", "failed"].includes(
                      c.status,
                    ) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runAction(c.id, "cancel")}
                        className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800"
                      >
                        취소
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
