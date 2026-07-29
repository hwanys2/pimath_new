"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  GeometryApplyPayload,
  GeometryRecognizeResult,
  PlaneFigure,
} from "./geometry-types";
import { sceneParamsFromApi } from "../lib/solid-nets/catalog";
import Solid3DWidget from "./widgets/Solid3DWidget";

type Tab = "plane" | "solid";

type Props = {
  imageDataUrl: string;
  imageContext: { width: number; height: number };
  canUseApi: boolean;
  apiBase?: string;
  getApiAuthHeaders?: () => Promise<Record<string, string>>;
  onApply: (payload: GeometryApplyPayload) => void;
  onCancel: () => void;
};

function PreviewSvg({
  figures,
  w,
  h,
}: {
  figures: PlaneFigure[];
  w: number;
  h: number;
}) {
  const paths = useMemo(() => {
    const items: React.ReactNode[] = [];
    for (const fig of figures) {
      if (fig.type === "segment" || fig.type === "line") {
        items.push(
          <line
            key={items.length}
            x1={fig.from[0]}
            y1={fig.from[1]}
            x2={fig.to[0]}
            y2={fig.to[1]}
            stroke="#38bdf8"
            strokeWidth={2}
          />,
        );
      } else if (fig.type === "circle") {
        items.push(
          <circle
            key={items.length}
            cx={fig.center[0]}
            cy={fig.center[1]}
            r={fig.radius}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2}
          />,
        );
      } else if (fig.type === "rectangle") {
        items.push(
          <rect
            key={items.length}
            x={fig.x}
            y={fig.y}
            width={fig.width}
            height={fig.height}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2}
          />,
        );
      } else if (fig.type === "triangle") {
        const d = fig.vertices
          .map((v, i) => `${i === 0 ? "M" : "L"}${v[0]},${v[1]}`)
          .join(" ");
        items.push(
          <path
            key={items.length}
            d={`${d} Z`}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2}
          />,
        );
      } else if (fig.type === "polygon") {
        const d = fig.vertices
          .map((v, i) => `${i === 0 ? "M" : "L"}${v[0]},${v[1]}`)
          .join(" ");
        items.push(
          <path
            key={items.length}
            d={`${d} Z`}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2}
          />,
        );
      }
    }
    return items;
  }, [figures]);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="max-h-48 w-full rounded-lg bg-black/40"
      preserveAspectRatio="xMidYMid meet"
    >
      {paths}
    </svg>
  );
}

export default function GeometryPerfectPanel({
  imageDataUrl,
  imageContext,
  canUseApi,
  apiBase = "",
  getApiAuthHeaders,
  onApply,
  onCancel,
}: Props) {
  const [result, setResult] = useState<GeometryRecognizeResult | null>(null);
  const [loading, setLoading] = useState(canUseApi);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("plane");

  const recognize = useCallback(async () => {
    if (!canUseApi) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const authHeaders = getApiAuthHeaders ? await getApiAuthHeaders() : {};
      const res = await fetch(`${apiBase}/api/board/recognize-geometry`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          image: imageDataUrl,
          context: imageContext,
        }),
      });
      const data = (await res.json()) as GeometryRecognizeResult & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "도형 인식에 실패했어요.");
        return;
      }
      setResult({
        figures: data.figures ?? [],
        solid: data.solid,
        confidence: data.confidence,
      });
      if (data.solid) setTab("solid");
    } catch {
      setError("네트워크 오류가 났어요.");
    } finally {
      setLoading(false);
    }
  }, [canUseApi, imageDataUrl, imageContext, apiBase, getApiAuthHeaders]);

  useEffect(() => {
    const id = setTimeout(() => {
      void recognize();
    }, 0);
    return () => clearTimeout(id);
  }, [recognize]);

  const solidPreviewState = useMemo(() => {
    if (!result?.solid) return null;
    return {
      type: result.solid.type,
      unfoldT: 0.35,
      params: sceneParamsFromApi(result.solid.params),
      orbit: { azimuth: 0.5, polar: 1.1 },
    };
  }, [result?.solid]);

  return (
    <div className="pointer-events-auto absolute inset-0 z-[45] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-auto rounded-2xl bg-cream p-4 shadow-xl">
        <h2 className="text-lg font-bold text-wood-dark">도형 완성</h2>
        {loading ? (
          <p className="text-sm text-wood/80">손그림을 분석하는 중…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : result ? (
          <>
            {result.solid ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1 text-sm ${
                    tab === "plane"
                      ? "bg-wood text-cream"
                      : "bg-black/10 text-wood-dark"
                  }`}
                  onClick={() => setTab("plane")}
                >
                  2D 도형
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1 text-sm ${
                    tab === "solid"
                      ? "bg-wood text-cream"
                      : "bg-black/10 text-wood-dark"
                  }`}
                  onClick={() => setTab("solid")}
                >
                  입체·전개도
                </button>
              </div>
            ) : null}
            {tab === "plane" || !result.solid ? (
              <PreviewSvg
                figures={result.figures}
                w={imageContext.width}
                h={imageContext.height}
              />
            ) : solidPreviewState ? (
              <div className="h-52 overflow-hidden rounded-lg border border-black/10">
                <Solid3DWidget
                  state={solidPreviewState}
                  setState={() => {}}
                />
              </div>
            ) : null}
            {result.confidence != null ? (
              <p className="text-xs text-wood/60">
                신뢰도 {Math.round(result.confidence * 100)}%
              </p>
            ) : null}
          </>
        ) : null}
        <div className="mt-auto flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm text-wood-dark hover:bg-black/10"
            onClick={onCancel}
          >
            취소
          </button>
          <button
            type="button"
            disabled={!result || loading}
            className="rounded-xl bg-sky px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            onClick={() => {
              if (!result) return;
              onApply({ result });
            }}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}

export type { GeometryApplyPayload };
