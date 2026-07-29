"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { BoardGraphSeriesInput, GraphSettings } from "./graph-types";
import { DEFAULT_GRAPH_SETTINGS } from "./graph-types";

const BoardGraphInner = dynamic(() => import("./BoardGraphInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[80px] items-center justify-center text-xs text-wood/50">
      그래프 불러오는 중…
    </div>
  ),
});

type Props = {
  series: BoardGraphSeriesInput[];
  settings?: GraphSettings;
  paramValues?: Record<string, number>;
  className?: string;
};

export default function BoardGraph({
  series,
  settings = DEFAULT_GRAPH_SETTINGS,
  paramValues,
  className = "",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      if (rect.width > 0 && rect.height > 0) {
        setDims({ w: rect.width, h: rect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative min-h-[80px] w-full ${className}`}>
      {dims.w > 0 && dims.h > 0 ? (
        <BoardGraphInner
          width={dims.w}
          height={dims.h}
          series={series}
          settings={settings}
          paramValues={paramValues}
        />
      ) : null}
    </div>
  );
}
