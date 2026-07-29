import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { solveLocally, type SolveResult } from "@/lib/board-equation-solve";

const MODEL = "gpt-4o-mini";

async function solveWithOpenAI(
  latex: string,
  expr: string,
  kind: "equation" | "inequality",
): Promise<SolveResult | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const system = `You are a Korean middle/high school math teacher. Solve the given ${kind === "inequality" ? "inequality" : "equation"} step by step.
Respond ONLY with valid JSON: {"steps":["step1","step2",...],"answerLatex":"...","warnings":"optional"}
Each step may use LaTeX inside $...$ for math. Use Korean explanations.`;

  const user = `LaTeX: ${latex}\nExpression: ${expr}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
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

export async function POST(req: Request) {
  const actor = await getActor();
  if (!actor || actor.type !== "teacher") {
    return NextResponse.json(
      { error: "선생님 계정으로만 풀이를 요청할 수 있어요." },
      { status: 401 },
    );
  }

  let body: {
    latex?: string;
    expr?: string;
    kind?: "equation" | "inequality";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const kind = body.kind;
  if (kind !== "equation" && kind !== "inequality") {
    return NextResponse.json({ error: "지원하지 않는 유형이에요." }, { status: 400 });
  }

  const latex = (body.latex ?? "").trim();
  const expr = (body.expr ?? latex).trim();
  if (!expr) {
    return NextResponse.json({ error: "수식이 비어 있어요." }, { status: 400 });
  }

  const ai = await solveWithOpenAI(latex, expr, kind);
  if (ai) {
    return NextResponse.json(ai);
  }

  const local = solveLocally(expr, kind);
  if (local) {
    return NextResponse.json({
      ...local,
      warnings: process.env.OPENAI_API_KEY
        ? undefined
        : "OPENAI_API_KEY가 없어 기본 풀이만 제공합니다.",
    });
  }

  return NextResponse.json(
    {
      error:
        "자동 풀이를 만들지 못했어요. 식을 수정하거나 나중에 다시 시도해 주세요.",
    },
    { status: 422 },
  );
}
