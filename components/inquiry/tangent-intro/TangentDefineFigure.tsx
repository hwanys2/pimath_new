"use client";

import katex from "katex";
import { useMemo } from "react";
import "katex/dist/katex.min.css";
import { groundElevationArc } from "@/lib/inquiry-tangent-figure";

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

/**
 * Right triangle ABC with the right angle at C.
 * A = observer on the ground (the angle we take tan of).
 * C = foot of the object (right angle).
 * B = top of the object.
 * tan A = BC / AC = height / base.
 */
export default function TangentDefineFigure() {
  const formulaHtml = useMemo(
    () => renderLatex("\\tan A = \\dfrac{\\overline{BC}}{\\overline{AC}}"),
    [],
  );
  const meaningHtml = useMemo(
    () => renderLatex("= \\dfrac{\\text{높이}}{\\text{밑변}}", false),
    [],
  );

  // 45° isosceles so it matches the table cell they just filled as 1.
  const ax = 64;
  const ay = 200;
  const cx = 216;
  const cy = 200;
  const bx = 216;
  const by = 48;
  const sq = 16;
  const arc = groundElevationArc({
    vx: ax,
    vy: ay,
    baseDir: 1,
    radius: 32,
    angleDeg: 45,
  });

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-wood/15 bg-cream/70">
      <svg
        viewBox="0 0 300 248"
        className="h-auto w-full"
        role="img"
        aria-label="직각삼각형 ABC. 각 C는 직각, 각 A는 올려다본 각, 꼭짓점 B는 높이의 위쪽. 탄젠트 A는 선분 BC 나누기 선분 AC."
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
          d={`M ${cx - sq} ${cy} L ${cx - sq} ${cy - sq} L ${cx} ${cy - sq}`}
          fill="none"
          stroke="#6b4a9e"
          strokeWidth={2}
        />
        <path
          d={arc.d}
          fill="none"
          stroke="#e85d4c"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <text
          x={ax - 18}
          y={ay + 20}
          fill="#6b4423"
          fontSize={15}
          fontWeight={800}
        >
          A
        </text>
        <text
          x={bx + 10}
          y={by + 6}
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
          x1={cx + 14}
          y1={(by + cy) / 2 - 18}
          x2={cx + 36}
          y2={(by + cy) / 2 - 18}
          stroke="#5a3d8a"
          strokeWidth={1.6}
        />
        <text
          x={cx + 40}
          y={(by + cy) / 2 - 4}
          fill="#5a3d8a"
          fontSize={12}
          fontWeight={800}
        >
          BC
        </text>
        <text
          x={cx + 40}
          y={(by + cy) / 2 + 12}
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
