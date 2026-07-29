import { solveLocally, type SolveResult } from "./lib/board-equation-solve";

const MATHPIX_URL = "https://api.mathpix.com/v3/text";
const OPENAI_MODEL = "gpt-4o-mini";

export type RecognizeMathResult =
  | { ok: true; latex: string; text: string }
  | { ok: false; status: number; error: string };

export async function handleRecognizeMath(
  body: { image?: string },
  env: { MATHPIX_APP_ID?: string; MATHPIX_APP_KEY?: string },
): Promise<RecognizeMathResult> {
  const appId = env.MATHPIX_APP_ID;
  const appKey = env.MATHPIX_APP_KEY;
  if (!appId || !appKey) {
    return {
      ok: false,
      status: 503,
      error:
        "수식 인식 서버 설정이 없어요. 수식을 직접 입력해 주세요. (MATHPIX_APP_ID / MATHPIX_APP_KEY)",
    };
  }

  const image = body.image?.trim();
  if (!image) {
    return { ok: false, status: 400, error: "이미지가 없어요." };
  }

  const src = image.startsWith("data:") ? image : `data:image/png;base64,${image}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch(MATHPIX_URL, {
      method: "POST",
      headers: {
        app_id: appId,
        app_key: appKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        src,
        formats: ["latex_styled", "text"],
        data_options: { include_asciimath: true },
      }),
      signal: controller.signal,
    });

    const data = (await res.json()) as {
      latex_styled?: string;
      text?: string;
      error?: string;
      error_info?: { message?: string };
    };

    if (!res.ok) {
      const msg =
        data.error_info?.message ||
        data.error ||
        "수식 인식에 실패했어요. 다시 시도하거나 직접 입력해 주세요.";
      return { ok: false, status: res.status, error: msg };
    }

    const latex = data.latex_styled?.trim() || data.text?.trim() || "";
    if (!latex) {
      return {
        ok: false,
        status: 422,
        error: "인식된 수식이 없어요. 영역을 다시 선택해 주세요.",
      };
    }

    return { ok: true, latex, text: data.text ?? "" };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: 500,
      error: aborted
        ? "인식 시간이 초과됐어요. 다시 시도해 주세요."
        : "수식 인식 중 오류가 났어요.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function solveWithOpenAI(
  latex: string,
  expr: string,
  kind: "equation" | "inequality",
  apiKey: string,
): Promise<SolveResult | null> {
  const system = `You are a Korean middle/high school math teacher. Solve the given ${kind === "inequality" ? "inequality" : "equation"} step by step.
Respond ONLY with valid JSON: {"steps":["step1","step2",...],"answerLatex":"...","warnings":"optional"}
Each step may use LaTeX inside $...$ for math. Use Korean explanations.`;

  const user = `LaTeX: ${latex}\nExpression: ${expr}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as SolveResult;
    if (!Array.isArray(parsed.steps) || !parsed.answerLatex) return null;
    return parsed;
  } catch {
    return null;
  }
}

export type SolveMathResult =
  | { ok: true; data: SolveResult & { warnings?: string } }
  | { ok: false; status: number; error: string };

export async function handleSolveMath(
  body: {
    latex?: string;
    expr?: string;
    kind?: "equation" | "inequality";
  },
  env: { OPENAI_API_KEY?: string },
): Promise<SolveMathResult> {
  const kind = body.kind;
  if (kind !== "equation" && kind !== "inequality") {
    return { ok: false, status: 400, error: "지원하지 않는 유형이에요." };
  }

  const latex = (body.latex ?? "").trim();
  const expr = (body.expr ?? latex).trim();
  if (!expr) {
    return { ok: false, status: 400, error: "수식이 비어 있어요." };
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
        warnings: key
          ? undefined
          : "OPENAI_API_KEY가 없어 기본 풀이만 제공합니다.",
      },
    };
  }

  return {
    ok: false,
    status: 422,
    error:
      "자동 풀이를 만들지 못했어요. 식을 수정하거나 나중에 다시 시도해 주세요.",
  };
}
