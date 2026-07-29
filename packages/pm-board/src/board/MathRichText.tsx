"use client";

import { useMemo } from "react";
import katex from "katex";

/** Renders plain text with $...$ inline math via KaTeX. */
export default function MathRichText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const parts = useMemo(() => {
    const segments: { math: boolean; value: string }[] = [];
    const re = /\$([^$]+)\$/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        segments.push({ math: false, value: text.slice(last, m.index) });
      }
      segments.push({ math: true, value: m[1] });
      last = m.index + m[0].length;
    }
    if (last < text.length) {
      segments.push({ math: false, value: text.slice(last) });
    }
    if (segments.length === 0) segments.push({ math: false, value: text });
    return segments;
  }, [text]);

  const trimmed = text.trim();
  const onlyMath =
    parts.length === 1 &&
    parts[0].math &&
    trimmed.startsWith("$") &&
    trimmed.endsWith("$");

  if (onlyMath) {
    const inner = trimmed.replace(/^\$+|\$+$/g, "");
    return (
      <span
        className={className}
        dangerouslySetInnerHTML={{
          __html: katex.renderToString(inner, {
            throwOnError: false,
            displayMode: true,
          }),
        }}
      />
    );
  }

  return (
    <span className={className}>
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
