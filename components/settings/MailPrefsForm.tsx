"use client";

import { useActionState, useEffect, useState } from "react";
import {
  setMailMarketingConsent,
  type MailPrefsState,
} from "@/app/settings/actions";

const empty: MailPrefsState = {};

export default function MailPrefsForm({
  initialConsent,
}: {
  initialConsent: boolean;
}) {
  const [consent, setConsent] = useState(initialConsent);
  const [state, formAction, pending] = useActionState(
    setMailMarketingConsent,
    empty,
  );

  useEffect(() => {
    if (typeof state.mailMarketingConsent === "boolean") {
      setConsent(state.mailMarketingConsent);
    }
  }, [state.mailMarketingConsent]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="consent" value={consent ? "1" : "0"} />

      <label className="flex cursor-not-allowed items-start gap-3 rounded-xl border border-wood/15 bg-wood/5 px-3 py-3 opacity-90">
        <input
          type="checkbox"
          checked
          disabled
          className="mt-1"
          aria-describedby="system-mail-help"
        />
        <span>
          <span className="block text-sm font-semibold text-wood-dark">
            시스템 필수 안내
          </span>
          <span id="system-mail-help" className="mt-0.5 block text-xs text-wood/65">
            계정·보안·서비스 운영에 꼭 필요한 안내입니다. 끌 수 없어요.
          </span>
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-wood/15 bg-white/60 px-3 py-3 transition hover:bg-wood/5">
        <input
          type="checkbox"
          checked={consent}
          disabled={pending}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1"
          aria-describedby="marketing-mail-help"
        />
        <span>
          <span className="block text-sm font-semibold text-wood-dark">
            소식·이벤트 메일 수신
          </span>
          <span
            id="marketing-mail-help"
            className="mt-0.5 block text-xs text-wood/65"
          >
            수학하는 즐거움 업데이트, 자료, 이벤트 안내를 받아요. 언제든 끌 수
            있어요.
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="font-display rounded-xl bg-wood px-4 py-2.5 text-sm text-cream transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "저장 중…" : "메일 설정 저장"}
      </button>

      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-wood/70" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
