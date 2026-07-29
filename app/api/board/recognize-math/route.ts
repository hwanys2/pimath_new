import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";

const MATHPIX_URL = "https://api.mathpix.com/v3/text";

export async function POST(req: Request) {
  const actor = await getActor();
  if (!actor || actor.type !== "teacher") {
    return NextResponse.json(
      { error: "선생님 계정으로 로그인해야 수식 인식을 사용할 수 있어요." },
      { status: 401 },
    );
  }

  const appId = process.env.MATHPIX_APP_ID;
  const appKey = process.env.MATHPIX_APP_KEY;
  if (!appId || !appKey) {
    return NextResponse.json(
      {
        error:
          "수식 인식 서버 설정이 없어요. 수식을 직접 입력해 주세요. (MATHPIX_APP_ID / MATHPIX_APP_KEY)",
      },
      { status: 503 },
    );
  }

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const image = body.image?.trim();
  if (!image) {
    return NextResponse.json({ error: "이미지가 없어요." }, { status: 400 });
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
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    const latex = data.latex_styled?.trim() || data.text?.trim() || "";
    if (!latex) {
      return NextResponse.json(
        { error: "인식된 수식이 없어요. 영역을 다시 선택해 주세요." },
        { status: 422 },
      );
    }

    return NextResponse.json({ latex, text: data.text ?? "" });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      {
        error: aborted
          ? "인식 시간이 초과됐어요. 다시 시도해 주세요."
          : "수식 인식 중 오류가 났어요.",
      },
      { status: 500 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
