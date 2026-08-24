"use client";

import katex from "katex";
import { useMemo } from "react";
import "katex/dist/katex.min.css";

function renderLatex(latex: string, display = true): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: display,
    });
  } catch {
    return latex;
  }
}

/** Right triangle ABC: A at the right angle, B at the top, C at the elevation angle. */
export default function TangentDefineFigure() {
  const formulaHtml = useMemo(
    () => renderLatex("\\tan C = \\dfrac{\\overline{AB}}{\\overline{AC}}"),
    [],
  );
  const meaningHtml = useMemo(
    () => renderLatex("= \\dfrac{\\text{높이}}{\\text{밑변}}", false),
    [],
  );

  // Isosceles right triangle so AB = AC (the 45° case they just filled as 1).
  const ax = 72;
  const ay = 196;
  const bx = 72;
  const by = 44;
  const cx = 224;
  const cy = 196;
  const sq = 16;

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-wood/15 bg-cream/70">
      <svg
        viewBox="0 0 300 248"
        className="h-auto w-full"
        role="img"
        aria-label="직각삼각형 ABC. 각 A는 직각, 각 C는 올려다본 각, 꼭짓점 B는 높이의 위쪽. 탄젠트 C는 선분 AB 나누기 선분 AC."
      >
        <polygon
          points={`${ax},${ay} ${bx},${by} ${cx},${cy}`}
          fill="#d4c4ff"
          fillOpacity={0.35}
          stroke="#6b4a9e"
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        <path
          d={`M ${ax + sq} ${ay} L ${ax + sq} ${ay - sq} L ${ax} ${ay - sq}`}
          fill="none"
          stroke="#6b4a9e"
          strokeWidth={2}
        />
        <path
          d={`M ${cx - 28} ${cy} A 28 28 0 0 0 ${cx - 19.8} ${cy - 19.8}`}
          fill="none"
          stroke="#e85d4c"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <text
          x={ax - 16}
          y={ay + 20}
          fill="#6b4423"
          fontSize={15}
          fontWeight={800}
        >
          A
        </text>
        <text
          x={bx - 16}
          y={by + 4}
          fill="#6b4423"
          fontSize={15}
          fontWeight={800}
        >
          B
        </text>
        <text
          x={cx + 8}
          y={cy + 20}
          fill="#6b4423"
          fontSize={15}
          fontWeight={800}
        >
          C
        </text>
        <line
          x1={ax - 50}
          y1={(ay + by) / 2 - 20}
          x2={ax - 22}
          y2={(ay + by) / 2 - 20}
          stroke="#5a3d8a"
          strokeWidth={1.6}
        />
        <text
          x={ax - 36}
          y={(ay + by) / 2 - 6}
          textAnchor="middle"
          fill="#5a3d8a"
          fontSize={12}
          fontWeight={800}
        >
          AB
        </text>
        <text
          x={ax - 36}
          y={(ay + by) / 2 + 10}
          textAnchor="middle"
          fill="#5a3d8a"
          fontSize={11}
          fontWeight={700}
        >
          높이
        </text>
        <line
          x1={(ax + cx) / 2 - 22}
          y1={ay + 10}
          x2={(ax + cx) / 2 + 2}
          y2={ay + 10}
          stroke="#8B5E3C"
          strokeWidth={1.6}
        />
        <text
          x={(ax + cx) / 2}
          y={ay + 26}
          textAnchor="middle"
          fill="#8B5E3C"
          fontSize={12}
          fontWeight={800}
        >
          AC 밑변
        </text>
      </svg>
      <div className="border-t border-wood/10 bg-white/70 px-3 py-3 text-center">
        <div
          className="text-wood [&_.katex]:text-[1.2rem] sm:[&_.katex]:text-[1.35rem]"
          dangerouslySetInnerHTML={{ __html: formulaHtml }}
        />
        <p className="mt-1 flex flex-wrap items-center justify-center gap-1 text-sm font-semibold text-foreground/70">
          <span>곧</span>
          <span
            className="text-wood [&_.katex]:text-[1.05rem]"
            dangerouslySetInnerHTML={{ __html: meaningHtml }}
          />
        </p>
      </div>
    </div>
  );
}
