"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

export default function QrWidget({ state, setState }: Props) {
  const text = (state.text as string) ?? "";
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    let cancelled = false;
    QRCode.toDataURL(trimmed, { width: 640, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  const shown = text.trim() ? dataUrl : null;

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <input
        type="text"
        value={text}
        onChange={(e) => setState({ text: e.target.value })}
        placeholder="주소(URL)나 문구를 입력하세요"
        className="rounded-lg border-2 border-black/10 bg-white px-3 py-2 text-sm"
      />
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl bg-[#f6f1e7] p-2">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL generated client-side
          <img
            src={shown}
            alt="QR 코드"
            className="max-h-full max-w-full rounded-lg"
          />
        ) : (
          <p className="text-sm text-wood/70">
            입력하면 QR 코드가 크게 표시돼요
          </p>
        )}
      </div>
    </div>
  );
}
