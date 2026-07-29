// src/lib/board-geometry-recognize.ts
var OPENAI_MODEL = "gpt-4o-mini";
var SOLID_TYPES = [
  "cube",
  "cuboid",
  "triangular_prism",
  "square_pyramid",
  "cylinder",
  "cone"
];
var SYSTEM = `You analyze rough hand-drawn school geometry in an image crop.
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
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function pt(v, w, h) {
  if (!Array.isArray(v) || v.length < 2) return null;
  const x = Number(v[0]);
  const y = Number(v[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [clamp(x, 0, w), clamp(y, 0, h)];
}
function sanitizeFigure(raw, w, h) {
  if (!raw || typeof raw !== "object") return null;
  const o = raw;
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
      height: clamp(height, 4, h)
    };
  }
  if (t === "triangle") {
    const verts = o.vertices;
    if (!Array.isArray(verts) || verts.length < 3) return null;
    const vertices = [
      pt(verts[0], w, h),
      pt(verts[1], w, h),
      pt(verts[2], w, h)
    ];
    if (vertices.some((v) => !v)) return null;
    return { type: "triangle", vertices };
  }
  if (t === "polygon") {
    const verts = o.vertices;
    if (!Array.isArray(verts) || verts.length < 3) return null;
    const vertices = [];
    for (const v of verts.slice(0, 12)) {
      const p = pt(v, w, h);
      if (p) vertices.push(p);
    }
    if (vertices.length < 3) return null;
    return { type: "polygon", vertices };
  }
  return null;
}
function sanitizeSolid(raw, w, h) {
  if (!raw || typeof raw !== "object") return void 0;
  const o = raw;
  const type = o.type;
  if (typeof type !== "string" || !SOLID_TYPES.includes(type)) {
    return void 0;
  }
  const anchor = o.anchor;
  const ax = Number(anchor?.x);
  const ay = Number(anchor?.y);
  if (!Number.isFinite(ax) || !Number.isFinite(ay)) return void 0;
  const params = o.params ?? {};
  const p = {};
  for (const k of ["a", "b", "c", "height", "radius"]) {
    const v = Number(params[k]);
    if (Number.isFinite(v) && v > 0) p[k] = v;
  }
  const rotationDeg = Number(o.rotationDeg);
  return {
    type,
    anchor: { x: clamp(ax, 0, w), y: clamp(ay, 0, h) },
    params: p,
    rotationDeg: Number.isFinite(rotationDeg) ? rotationDeg : 0
  };
}
function sanitizeGeometryResult(raw, imgW, imgH) {
  const o = raw && typeof raw === "object" ? raw : {};
  const figures = [];
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
    confidence: Number.isFinite(confidence) ? clamp(confidence, 0, 1) : void 0
  };
}
async function handleRecognizeGeometry(body, env) {
  const key = env.OPENAI_API_KEY;
  if (!key) {
    return {
      ok: false,
      status: 503,
      error: "\uB3C4\uD615 \uC778\uC2DD \uC11C\uBC84 \uC124\uC815\uC774 \uC5C6\uC5B4\uC694. (OPENAI_API_KEY)"
    };
  }
  const image = body.image?.trim();
  if (!image) {
    return { ok: false, status: 400, error: "\uC774\uBBF8\uC9C0\uAC00 \uC5C6\uC5B4\uC694." };
  }
  const src = image.startsWith("data:") ? image : `data:image/png;base64,${image}`;
  const imgW = Math.max(1, Number(body.context?.width) || 800);
  const imgH = Math.max(1, Number(body.context?.height) || 600);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45e3);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
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
                text: `Image size ${imgW}x${imgH} pixels. Analyze the hand-drawn geometry.`
              },
              { type: "image_url", image_url: { url: src, detail: "high" } }
            ]
          }
        ]
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      return {
        ok: false,
        status: 502,
        error: "\uB3C4\uD615 \uC778\uC2DD\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694."
      };
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      return { ok: false, status: 422, error: "\uC778\uC2DD \uACB0\uACFC\uAC00 \uBE44\uC5B4 \uC788\uC5B4\uC694." };
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, status: 422, error: "\uC778\uC2DD \uACB0\uACFC\uB97C \uD574\uC11D\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694." };
    }
    const result = sanitizeGeometryResult(parsed, imgW, imgH);
    if (result.figures.length === 0 && !result.solid) {
      return {
        ok: false,
        status: 422,
        error: "\uB3C4\uD615\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC601\uC5ED\uC744 \uB2E4\uC2DC \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."
      };
    }
    return { ok: true, data: result };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: 500,
      error: aborted ? "\uC778\uC2DD \uC2DC\uAC04\uC774 \uCD08\uACFC\uB410\uC5B4\uC694." : "\uB3C4\uD615 \uC778\uC2DD \uC911 \uC624\uB958\uAC00 \uB0AC\uC5B4\uC694."
    };
  } finally {
    clearTimeout(timeout);
  }
}

// src/lib/board-equation-solve.ts
function solveLocally(expr, kind) {
  const s = expr.replace(/\s+/g, "").replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/−/g, "-");
  if (kind === "inequality") {
    return solveInequalityLocal(s);
  }
  return solveEquationLocal(s);
}
function solveEquationLocal(s) {
  const parts = s.split("=");
  if (parts.length !== 2) return null;
  let left = parts[0];
  let right = parts[1];
  if (!left.includes("x") && right.includes("x")) {
    [left, right] = [right, left];
  }
  if (!left.includes("x")) return null;
  const linear = matchLinear(left, right);
  if (linear) {
    const { a, b } = linear;
    if (Math.abs(a) < 1e-12) return null;
    const x = -b / a;
    return {
      steps: [
        `\uC77C\uCC28\uBC29\uC815\uC2DD $${formatLinear(a, b)} = 0$`,
        `$x = ${formatNum(-b)}/${formatNum(a)} = ${formatNum(x)}$`
      ],
      answerLatex: `x = ${formatNum(x)}`
    };
  }
  const quad = matchQuadratic(left, right);
  if (quad) {
    const { a, b, c } = quad;
    const D = b * b - 4 * a * c;
    const steps = [
      `\uC774\uCC28\uBC29\uC815\uC2DD $${a}x^2 ${b >= 0 ? "+" : ""}${b}x ${c >= 0 ? "+" : ""}${c} = 0$`,
      `\uD310\uBCC4\uC2DD $D = ${b}^2 - 4 \\cdot ${a} \\cdot ${c} = ${D}$`
    ];
    if (D < 0) {
      return {
        steps: [...steps, "\uC2E4\uADFC\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."],
        answerLatex: "\\text{\uC2E4\uADFC \uC5C6\uC74C}"
      };
    }
    const sqrtD = Math.sqrt(D);
    const x1 = (-b + sqrtD) / (2 * a);
    const x2 = (-b - sqrtD) / (2 * a);
    steps.push(
      `$x = \\frac{-${b} \\pm \\sqrt{${D}}}{${2 * a}}$`,
      D === 0 ? `$x = ${formatNum(x1)}$` : `$x_1 = ${formatNum(x1)},\\quad x_2 = ${formatNum(x2)}$`
    );
    return {
      steps,
      answerLatex: D === 0 ? `x = ${formatNum(x1)}` : `x = ${formatNum(x1)} \\text{ \uB610\uB294 } x = ${formatNum(x2)}`
    };
  }
  const pure = s.match(/^x\^2=(-?\d+(?:\.\d+)?)$/);
  if (pure) {
    const k = parseFloat(pure[1]);
    if (k < 0) {
      return {
        steps: ["$x^2 = " + k + "$", "\uC2E4\uC218 \uD574\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."],
        answerLatex: "\\text{\uC2E4\uADFC \uC5C6\uC74C}"
      };
    }
    const r = Math.sqrt(k);
    return {
      steps: [
        `$x^2 = ${k}$`,
        `$x = \\pm\\sqrt{${k}} = \\pm ${formatNum(r)}$`
      ],
      answerLatex: `x = \\pm ${formatNum(r)}`
    };
  }
  return null;
}
function solveInequalityLocal(s) {
  const m = s.match(/^(.+?)(<=|>=|<|>)(.+)$/);
  if (!m) return null;
  let left = m[1];
  const op = m[2];
  let right = m[3];
  if (!left.includes("x") && right.includes("x")) {
    [left, right] = [right, left];
  }
  const linear = matchLinear(left, right);
  if (!linear) return null;
  const { a, b } = linear;
  if (Math.abs(a) < 1e-12) return null;
  const boundary = -b / a;
  const flip = a < 0;
  let interval;
  const effective = flip ? flipOp(op) : op;
  if (effective === ">" || effective === ">=") {
    interval = `${effective === ">" ? "(" : "["}${formatNum(boundary)}, \\infty)`;
  } else {
    interval = `${effective === "<" ? "(" : "["}-\\infty, ${formatNum(boundary)}${effective === "<=" ? "]" : ")"}`;
  }
  return {
    steps: [
      `\uC77C\uCC28\uBD80\uB4F1\uC2DD $${formatLinear(a, b)} ${op} 0$`,
      `\uC591\uBCC0\uC744 ${formatNum(a)}\uB85C \uB098\uB215\uB2C8\uB2E4${flip ? " (\uBD80\uB4F1\uD638 \uBC29\uD5A5 \uBC18\uC804)" : ""}.`,
      `$x ${effective} ${formatNum(boundary)}$`
    ],
    answerLatex: interval
  };
}
function flipOp(op) {
  if (op === "<") return ">";
  if (op === ">") return "<";
  if (op === "<=") return ">=";
  if (op === ">=") return "<=";
  return op;
}
function matchLinear(left, right) {
  const moved = moveToZero(left, right);
  const m = moved.match(/^([+-]?(?:\d+(?:\.\d+)?)?)x([+-]\d+(?:\.\d+)?)?$/);
  if (!m) {
    const m2 = moved.match(/^([+-]?\d+(?:\.\d+)?)x$/);
    if (m2) return { a: parseFloat(m2[1]), b: 0 };
    return null;
  }
  const a = m[1] === "" || m[1] === "+" ? 1 : m[1] === "-" ? -1 : parseFloat(m[1]);
  const b = m[2] ? parseFloat(m[2]) : 0;
  return { a, b };
}
function matchQuadratic(left, right) {
  const moved = moveToZero(left, right);
  const re = /^([+-]?(?:\d+(?:\.\d+)?)?)x\^2([+-](?:\d+(?:\.\d+)?)?x)?([+-]\d+(?:\.\d+)?)?$/;
  const m = moved.match(re);
  if (!m) return null;
  const a = m[1] === "" || m[1] === "+" ? 1 : m[1] === "-" ? -1 : parseFloat(m[1]);
  let b = 0;
  if (m[2]) {
    const raw = m[2];
    b = raw === "+x" || raw === "x" ? 1 : raw === "-x" ? -1 : parseFloat(raw);
  }
  const c = m[3] ? parseFloat(m[3]) : 0;
  return { a, b, c };
}
function moveToZero(left, right) {
  if (right === "0") return left;
  return `${left}-(${right})`;
}
function formatLinear(a, b) {
  const ax = a === 1 ? "x" : a === -1 ? "-x" : `${a}x`;
  if (b === 0) return ax;
  return `${ax}${b >= 0 ? "+" : ""}${b}`;
}
function formatNum(n) {
  const r = Math.round(n * 1e6) / 1e6;
  return Number.isInteger(r) ? String(r) : String(r);
}

// src/server.ts
var MATHPIX_URL = "https://api.mathpix.com/v3/text";
var OPENAI_MODEL2 = "gpt-4o-mini";
async function handleRecognizeMath(body, env) {
  const appId = env.MATHPIX_APP_ID;
  const appKey = env.MATHPIX_APP_KEY;
  if (!appId || !appKey) {
    return {
      ok: false,
      status: 503,
      error: "\uC218\uC2DD \uC778\uC2DD \uC11C\uBC84 \uC124\uC815\uC774 \uC5C6\uC5B4\uC694. \uC218\uC2DD\uC744 \uC9C1\uC811 \uC785\uB825\uD574 \uC8FC\uC138\uC694. (MATHPIX_APP_ID / MATHPIX_APP_KEY)"
    };
  }
  const image = body.image?.trim();
  if (!image) {
    return { ok: false, status: 400, error: "\uC774\uBBF8\uC9C0\uAC00 \uC5C6\uC5B4\uC694." };
  }
  const src = image.startsWith("data:") ? image : `data:image/png;base64,${image}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25e3);
  try {
    const res = await fetch(MATHPIX_URL, {
      method: "POST",
      headers: {
        app_id: appId,
        app_key: appKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        src,
        formats: ["latex_styled", "text"],
        data_options: { include_asciimath: true }
      }),
      signal: controller.signal
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error_info?.message || data.error || "\uC218\uC2DD \uC778\uC2DD\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694. \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uAC70\uB098 \uC9C1\uC811 \uC785\uB825\uD574 \uC8FC\uC138\uC694.";
      return { ok: false, status: res.status, error: msg };
    }
    const latex = data.latex_styled?.trim() || data.text?.trim() || "";
    if (!latex) {
      return {
        ok: false,
        status: 422,
        error: "\uC778\uC2DD\uB41C \uC218\uC2DD\uC774 \uC5C6\uC5B4\uC694. \uC601\uC5ED\uC744 \uB2E4\uC2DC \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."
      };
    }
    return { ok: true, latex, text: data.text ?? "" };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: 500,
      error: aborted ? "\uC778\uC2DD \uC2DC\uAC04\uC774 \uCD08\uACFC\uB410\uC5B4\uC694. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." : "\uC218\uC2DD \uC778\uC2DD \uC911 \uC624\uB958\uAC00 \uB0AC\uC5B4\uC694."
    };
  } finally {
    clearTimeout(timeout);
  }
}
async function solveWithOpenAI(latex, expr, kind, apiKey) {
  const system = `You are a Korean middle/high school math teacher. Solve the given ${kind === "inequality" ? "inequality" : "equation"} step by step.
Respond ONLY with valid JSON: {"steps":["step1","step2",...],"answerLatex":"...","warnings":"optional"}
Each step may use LaTeX inside $...$ for math. Use Korean explanations.`;
  const user = `LaTeX: ${latex}
Expression: ${expr}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL2,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.steps) || !parsed.answerLatex) return null;
    return parsed;
  } catch {
    return null;
  }
}
async function handleSolveMath(body, env) {
  const kind = body.kind;
  if (kind !== "equation" && kind !== "inequality") {
    return { ok: false, status: 400, error: "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uC720\uD615\uC774\uC5D0\uC694." };
  }
  const latex = (body.latex ?? "").trim();
  const expr = (body.expr ?? latex).trim();
  if (!expr) {
    return { ok: false, status: 400, error: "\uC218\uC2DD\uC774 \uBE44\uC5B4 \uC788\uC5B4\uC694." };
  }
  const key = env.OPENAI_API_KEY;
  if (key) {
    const ai = await solveWithOpenAI(latex, expr, kind, key);
    if (ai) {
      return { ok: true, data: ai };
    }
  }
  const local = solveLocally(expr, kind);
  if (local) {
    return {
      ok: true,
      data: {
        ...local,
        warnings: key ? void 0 : "OPENAI_API_KEY\uAC00 \uC5C6\uC5B4 \uAE30\uBCF8 \uD480\uC774\uB9CC \uC81C\uACF5\uD569\uB2C8\uB2E4."
      }
    };
  }
  return {
    ok: false,
    status: 422,
    error: "\uC790\uB3D9 \uD480\uC774\uB97C \uB9CC\uB4E4\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC2DD\uC744 \uC218\uC815\uD558\uAC70\uB098 \uB098\uC911\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694."
  };
}
export {
  handleRecognizeGeometry,
  handleRecognizeMath,
  handleSolveMath
};
