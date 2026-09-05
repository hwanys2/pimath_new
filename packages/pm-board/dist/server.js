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
var OPENAI_MODEL = "gpt-4o-mini";
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
  const timeout = setTimeout(() => controller.abort(), 2e4);
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2e4);
  let res;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
  handleRecognizeMath,
  handleSolveMath
};
