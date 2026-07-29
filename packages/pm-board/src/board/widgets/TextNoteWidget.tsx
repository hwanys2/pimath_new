"use client";

import { useMemo, useState } from "react";
import katex from "katex";

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

/** Render plain text with $...$ inline math segments via KaTeX. */
function MathText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const segments: { math: boolean; value: string }[] = [];
    const re = /\$([^$]+)\$/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) segments.push({ math: false, value: text.slice(last, m.index) });
      segments.push({ math: true, value: m[1] });
      last = m.index + m[0].length;
    }
    if (last < text.length) segments.push({ math: false, value: text.slice(last) });
    return segments;
  }, [text]);

  return (
    <span>
      {parts.map((part, i) =>
        part.math ? (
          <span
            key={i}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(part.value, {
                throwOnError: false,
                output: "html",
              }),
            }}
          />
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </span>
  );
}

export default function TextNoteWidget({ state, setState }: Props) {
  const text = (state.text as string) ?? "";
  const fontSize = (state.fontSize as number) ?? 28;
  const [editing, setEditing] = useState(text.length === 0);

  return (
    <div className="flex h-full flex-col gap-2 bg-[#fff9db] p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="font-display rounded-lg bg-wood px-3 py-1 text-sm text-cream transition hover:brightness-110"
        >
          {editing ? "보기" : "수정"}
        </button>
        <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-wood">
          글자 크기
          <input
            type="range"
            min={16}
            max={72}
            value={fontSize}
            onChange={(e) => setState({ fontSize: Number(e.target.value) })}
          />
        </label>
      </div>
      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setState({ text: e.target.value })}
          placeholder={"내용을 입력하세요.\n수식은 $...$ 안에 쓰면 예쁘게 나와요.\n예) $x^2 + 3x - 4 = 0$, $\\frac{1}{2}$"}
          className="min-h-0 flex-1 resize-none rounded-xl border-2 border-black/10 bg-white/70 p-3 text-base leading-relaxed outline-none"
        />
      ) : (
        <div
          className="min-h-0 flex-1 overflow-auto rounded-xl p-2 leading-relaxed whitespace-pre-wrap text-[#3d2c1e]"
          style={{ fontSize }}
        >
          {text ? (
            text.split("\n").map((line, i) => (
              <div key={i}>{line ? <MathText text={line} /> : <br />}</div>
            ))
          ) : (
            <span className="text-base text-wood/60">
              수정 버튼을 눌러 내용을 입력하세요
            </span>
          )}
        </div>
      )}
    </div>
  );
}
