import type {
  GeometryRecognizeResult,
  PlaneFigure,
  SolidSpec,
  SolidType,
} from "../board/geometry-types";

const OPENAI_MODEL = "gpt-4o-mini";

const SOLID_TYPES: SolidType[] = [
  "cube",
  "cuboid",
  "triangular_prism",
  "square_pyramid",
  "cylinder",
  "cone",
];

const SYSTEM = `You analyze rough hand-drawn school geometry in an image crop.
Return JSON only with this shape:
{
  "figures": [ plane figures in IMAGE pixel coordinates, origin top-left ],
  "solid": optional single solid or null,
  "confidence": 0-1
}
Plane figure types: segment, line, circle, rectangle, triangle, polygon.
- segment: { "type":"segment", "from":[x,y], "to":[x,y] }
- line: infinite line through two points { "type":"line", "from":[x,y], "to":[x,y] }
- circle: { "type":"circle", "center":[x,y], "radius": number }
- rectangle: { "type":"rectangle", "x", "y", "width", "height" } axis-aligned
- triangle: { "type":"triangle", "vertices":[[x,y],[x,y],[x,y]] }
- polygon: { "type":"polygon", "vertices":[[x,y],...] } 4+ points
solid: { "type": "cube"|"cuboid"|"triangular_prism"|"square_pyramid"|"cylinder"|"cone",
  "anchor": { "x", "y" }, "params": { "a", "b", "c", "height", "radius" }, "rotationDeg": optional }
Use Korean school math conventions. Prefer clean right angles and regular shapes when ambiguous.
If only 2D shapes, omit solid. At most one solid.`;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pt(
  v: unknown,
  w: number,
  h: number,
): [number, number] | null {
  if (!Array.isArray(v) || v.length < 2) return null;
  const x = Number(v[0]);
  const y = Number(v[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [clamp(x, 0, w), clamp(y, 0, h)];
}

function sanitizeFigure(raw: unknown, w: number, h: number): PlaneFigure | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const t = o.type;
  if (t === "segment" || t === "line") {
    const from = pt(o.from, w, h);
    const to = pt(o.to, w, h);
    if (!from || !to) return null;
    if (Math.hypot(to[0] - from[0], to[1] - from[1]) < 4) return null;
    return { type: t, from, to };
  }
  if (t === "circle") {
    const center = pt(o.center, w, h);
    const radius = Number(o.radius);
    if (!center || !Number.isFinite(radius) || radius < 3) return null;
    return { type: "circle", center, radius: clamp(radius, 3, Math.max(w, h)) };
  }
  if (t === "rectangle") {
    const x = Number(o.x);
    const y = Number(o.y);
    const width = Number(o.width);
    const height = Number(o.height);
    if (![x, y, width, height].every(Number.isFinite)) return null;
    if (width < 4 || height < 4) return null;
    return {
      type: "rectangle",
      x: clamp(x, 0, w),
      y: clamp(y, 0, h),
      width: clamp(width, 4, w),
      height: clamp(height, 4, h),
    };
  }
  if (t === "triangle") {
    const verts = o.vertices;
    if (!Array.isArray(verts) || verts.length < 3) return null;
    const vertices = [
      pt(verts[0], w, h),
      pt(verts[1], w, h),
      pt(verts[2], w, h),
    ] as [[number, number], [number, number], [number, number]];
    if (vertices.some((v) => !v)) return null;
    return { type: "triangle", vertices };
  }
  if (t === "polygon") {
    const verts = o.vertices;
    if (!Array.isArray(verts) || verts.length < 3) return null;
    const vertices: [number, number][] = [];
    for (const v of verts.slice(0, 12)) {
      const p = pt(v, w, h);
      if (p) vertices.push(p);
    }
    if (vertices.length < 3) return null;
    return { type: "polygon", vertices };
  }
  return null;
}

function sanitizeSolid(raw: unknown, w: number, h: number): SolidSpec | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const type = o.type;
  if (typeof type !== "string" || !SOLID_TYPES.includes(type as SolidType)) {
    return undefined;
  }
  const anchor = o.anchor as { x?: number; y?: number };
  const ax = Number(anchor?.x);
  const ay = Number(anchor?.y);
  if (!Number.isFinite(ax) || !Number.isFinite(ay)) return undefined;
  const params = (o.params ?? {}) as Record<string, unknown>;
  const p: SolidSpec["params"] = {};
  for (const k of ["a", "b", "c", "height", "radius"] as const) {
    const v = Number(params[k]);
    if (Number.isFinite(v) && v > 0) p[k] = v;
  }
  const rotationDeg = Number(o.rotationDeg);
  return {
    type: type as SolidType,
    anchor: { x: clamp(ax, 0, w), y: clamp(ay, 0, h) },
    params: p,
    rotationDeg: Number.isFinite(rotationDeg) ? rotationDeg : 0,
  };
}

export function sanitizeGeometryResult(
  raw: unknown,
  imgW: number,
  imgH: number,
): GeometryRecognizeResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const figures: PlaneFigure[] = [];
  if (Array.isArray(o.figures)) {
    for (const f of o.figures) {
      const s = sanitizeFigure(f, imgW, imgH);
      if (s) figures.push(s);
    }
  }
  const solid = sanitizeSolid(o.solid, imgW, imgH);
  const confidence = Number(o.confidence);
  return {
    figures,
    solid,
    confidence: Number.isFinite(confidence) ? clamp(confidence, 0, 1) : undefined,
  };
}

export type RecognizeGeometryResult =
  | { ok: true; data: GeometryRecognizeResult }
  | { ok: false; status: number; error: string };

export async function handleRecognizeGeometry(
  body: { image?: string; context?: { width?: number; height?: number } },
  env: { OPENAI_API_KEY?: string },
): Promise<RecognizeGeometryResult> {
  const key = env.OPENAI_API_KEY;
  if (!key) {
    return {
      ok: false,
      status: 503,
      error: "도형 인식 서버 설정이 없어요. (OPENAI_API_KEY)",
    };
  }

  const image = body.image?.trim();
  if (!image) {
    return { ok: false, status: 400, error: "이미지가 없어요." };
  }

  const src = image.startsWith("data:") ? image : `data:image/png;base64,${image}`;
  const imgW = Math.max(1, Number(body.context?.width) || 800);
  const imgH = Math.max(1, Number(body.context?.height) || 600);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Image size ${imgW}x${imgH} pixels. Analyze the hand-drawn geometry.`,
              },
              { type: "image_url", image_url: { url: src, detail: "high" } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        ok: false,
        status: 502,
        error: "도형 인식에 실패했어요. 다시 시도해 주세요.",
      };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      return { ok: false, status: 422, error: "인식 결과가 비어 있어요." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, status: 422, error: "인식 결과를 해석하지 못했어요." };
    }

    const result = sanitizeGeometryResult(parsed, imgW, imgH);
    if (result.figures.length === 0 && !result.solid) {
      return {
        ok: false,
        status: 422,
        error: "도형을 찾지 못했어요. 영역을 다시 선택해 주세요.",
      };
    }

    return { ok: true, data: result };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: 500,
      error: aborted
        ? "인식 시간이 초과됐어요."
        : "도형 인식 중 오류가 났어요.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
