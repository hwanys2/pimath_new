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
 * A = angle on the ground. C = foot (right angle). B = top.
 * AB = hypotenuse. sin A = BC/AB, cos A = AC/AB.
 */
export default function SincosDefineFigure() {
  const sinFormulaHtml = useMemo(
    () => renderLatex("\\sin A = \\dfrac{\\overline{BC}}{\\overline{AB}}"),
    [],
  );
  const cosFormulaHtml = useMemo(
    () => renderLatex("\\cos A = \\dfrac{\\overline{AC}}{\\overline{AB}}"),
    [],
  );
  const sinMeaningHtml = useMemo(
    () => renderLatex("= \\dfrac{\\text{높이}}{\\text{빗변}}", false),
    [],
  );
  const cosMeaningHtml = useMemo(
    () => renderLatex("= \\dfrac{\\text{밑변}}{\\text{빗변}}", false),
    [],
  );

  const ax = 52;
  const ay = 204;
  const cx = 204;
  const cy = 204;
  const bx = 204;
  const by = 44;
  const sq = 16;
  const arc = groundElevationArc({
    vx: ax,
    vy: ay,
    baseDir: 1,
    radius: 30,
    angleDeg: 45,
  });

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-wood/15 bg-cream/70">
      <svg
        viewBox="0 0 300 248"
        className="h-auto w-full select-none"
        role="img"
        aria-label="직각삼각형 ABC. 각 C는 직각, AB는 빗변. 사인 A는 높이 나누기 빗변, 코사인 A는 밑변 나누기 빗변."
      >
        <polygon
          points={`${ax},${ay} ${bx},${by} ${cx},${cy}`}
          fill="#d4c4ff"
          fillOpacity={0.35}
          stroke="#6b4a9e"
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        <line
          x1={ax}
          y1={ay}
          x2={bx}
          y2={by}
          stroke="#5a3d8a"
          strokeWidth={2.8}
          strokeLinecap="round"
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
        <text x={ax - 18} y={ay + 20} fill="#6b4423" fontSize={15} fontWeight={800}>
          A
        </text>
        <text x={bx + 10} y={by + 6} fill="#6b4423" fontSize={15} fontWeight={800}>
          B
        </text>
        <text x={cx + 8} y={cy + 20} fill="#6b4423" fontSize={15} fontWeight={800}>
          C
        </text>
        <text
          x={(ax + bx) / 2 - 8}
          y={(ay + by) / 2 - 10}
          fill="#5a3d8a"
          fontSize={12}
          fontWeight={800}
        >
          AB 빗변
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
      <div className="space-y-3 border-t border-wood/10 bg-white/70 px-3 py-3 text-center">
        <div>
          <div
            className="text-wood [&_.katex]:text-[1.05rem] sm:[&_.katex]:text-[1.15rem]"
            dangerouslySetInnerHTML={{ __html: sinFormulaHtml }}
          />
          <p className="mt-1 flex flex-wrap items-center justify-center gap-1 text-sm font-semibold text-foreground/70">
            <span>곧</span>
            <span
              className="text-wood [&_.katex]:text-[0.95rem]"
              dangerouslySetInnerHTML={{ __html: sinMeaningHtml }}
            />
            <span className="text-[#6b4a9e]">→ 높이 = 빗변 × sin A</span>
          </p>
        </div>
        <div className="border-t border-wood/8 pt-3">
          <div
            className="text-wood [&_.katex]:text-[1.05rem] sm:[&_.katex]:text-[1.15rem]"
            dangerouslySetInnerHTML={{ __html: cosFormulaHtml }}
          />
          <p className="mt-1 flex flex-wrap items-center justify-center gap-1 text-sm font-semibold text-foreground/70">
            <span>곧</span>
            <span
              className="text-wood [&_.katex]:text-[0.95rem]"
              dangerouslySetInnerHTML={{ __html: cosMeaningHtml }}
            />
            <span className="text-[#6b4a9e]">→ 밑변 = 빗변 × cos A</span>
          </p>
        </div>
      </div>
    </div>
  );
}
