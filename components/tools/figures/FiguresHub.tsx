"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GRADES, isValidGrade, type GradeId } from "@/lib/grades";
import {
  getDiagramToolsForGrade,
  type DiagramToolMeta,
} from "@/lib/diagrams/catalog";

export default function FiguresHub() {
  const searchParams = useSearchParams();
  const parsed = Number(searchParams.get("grade") ?? 1);
  const grade: GradeId = isValidGrade(parsed) ? parsed : 1;
  const tools = getDiagramToolsForGrade(grade);
  const ready = tools.filter((t) => t.status === "ready");
  const soon = tools.filter((t) => t.status === "soon");
  const meta = GRADES.find((g) => g.id === grade)!;

  return (
    <div className="space-y-8">
      <header className="text-center">
        <p className="text-sm font-semibold text-wood">
          <Link href="/tools" className="hover:underline">
            수업 도구
          </Link>
          <span className="mx-1.5 text-foreground/30">/</span>
          문제 그림
        </p>
        <h1 className="font-display mt-2 text-3xl text-wood-dark sm:text-4xl">
          문제 그림 그리기
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-foreground/70">
          시험·학습지에 넣는 그림을, 그 소재만 골라 바로 그립니다. 점과 수선을
          하나씩 작도하지 않아도 돼요.
        </p>
      </header>

      <nav
        className="flex justify-center gap-2"
        aria-label="학년 선택"
      >
        {GRADES.map((g) => {
          const active = g.id === grade;
          const count = getDiagramToolsForGrade(g.id).filter(
            (t) => t.status === "ready",
          ).length;
          return (
            <Link
              key={g.id}
              href={`/tools/figures?grade=${g.id}`}
              className={`font-display rounded-2xl px-5 py-2.5 text-base transition ${
                active
                  ? "bg-wood text-cream shadow-[0_3px_0_rgba(90,58,34,0.35)]"
                  : "bg-white/80 text-wood-dark hover:bg-white"
              }`}
            >
              {g.label}
              <span
                className={`ml-2 text-xs font-semibold ${
                  active ? "text-cream/70" : "text-foreground/40"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-wood">{meta.label}</p>
            <h2 className="font-display text-2xl text-wood-dark">그림 도구</h2>
          </div>
        </div>

        {ready.length === 0 && soon.length === 0 ? (
          <div className="quest-card-static px-6 py-12 text-center">
            <p className="font-display text-xl text-wood-dark">
              {meta.label} 도구는 아직 없어요
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-foreground/60">
              소재별로 하나씩 추가할 예정이에요. 지금은 중1 「수직선」·「좌표평면」·「다각형」·「원과 부채꼴」·「겨냥도」·「히스토그램」,
              중2 「순환소수 나눗셈」·「일차부등식」, 중3 「원의 현」부터 사용할 수 있어요.
            </p>
            <Link
              href="/tools/figures?grade=1"
              className="font-display mt-5 inline-block rounded-xl bg-wood px-4 py-2.5 text-sm text-cream"
            >
              중1 도구 보기
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {ready.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
            {soon.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ToolCard({ tool }: { tool: DiagramToolMeta }) {
  const inner = (
    <>
      <div className="flex items-start gap-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-3xl text-wood-dark shadow-sm"
          aria-hidden
        >
          {tool.id === "g3-circle-chords" ? (
            <ChordThumb />
          ) : tool.id === "g1-number-line" ? (
            <NumberLineThumb />
          ) : tool.id === "g1-coordinate-plane" ? (
            <CoordinatePlaneThumb />
          ) : tool.id === "g1-solid-sketch" ? (
            <SolidThumb />
          ) : tool.id === "g1-circle-sectors" ? (
            <SectorThumb />
          ) : tool.id === "g1-histogram" ? (
            <HistogramThumb />
          ) : tool.id === "g2-repeating-decimal" ? (
            <DivisionThumb />
          ) : tool.id === "g2-linear-inequality" ? (
            <InequalityThumb />
          ) : (
            tool.emoji
          )}
        </span>
        <div>
          <p className="text-[11px] font-bold tracking-wide text-wood/70">
            {tool.unitHint}
          </p>
          <h3 className="font-display text-xl text-wood-dark">{tool.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/75">
            {tool.description}
          </p>
        </div>
      </div>
      <p className="font-display mt-4 text-right text-sm text-wood-dark/80">
        {tool.status === "ready" ? "열기 →" : "준비 중"}
      </p>
    </>
  );

  if (tool.status !== "ready") {
    return (
      <div className="quest-card-static p-6 opacity-70">{inner}</div>
    );
  }

  return (
    <Link
      href={tool.href}
      className="quest-card group block p-6 no-underline transition hover:-translate-y-1"
    >
      {inner}
    </Link>
  );
}

function ChordThumb() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
      <circle cx="24" cy="24" r="16" fill="none" stroke="#6b4423" strokeWidth="1.7" />
      <line x1="12" y1="17" x2="36" y2="17" stroke="#6b4423" strokeWidth="1.5" />
      <line x1="14" y1="32" x2="34" y2="32" stroke="#6b4423" strokeWidth="1.5" />
      <line x1="24" y1="24" x2="24" y2="17" stroke="#6b4423" strokeWidth="1.2" />
      <line x1="24" y1="24" x2="24" y2="32" stroke="#6b4423" strokeWidth="1.2" />
      <circle cx="24" cy="24" r="1.6" fill="#6b4423" />
    </svg>
  );
}

function NumberLineThumb() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
      <line x1="6" y1="24" x2="42" y2="24" stroke="#6b4423" strokeWidth="1.6" />
      <polygon points="6,24 11,21.2 11,26.8" fill="#6b4423" />
      <polygon points="42,24 37,21.2 37,26.8" fill="#6b4423" />
      <line x1="14" y1="20" x2="14" y2="28" stroke="#6b4423" strokeWidth="1.3" />
      <line x1="24" y1="20" x2="24" y2="28" stroke="#6b4423" strokeWidth="1.3" />
      <line x1="34" y1="20" x2="34" y2="28" stroke="#6b4423" strokeWidth="1.3" />
      <circle cx="19" cy="24" r="1.8" fill="#6b4423" />
    </svg>
  );
}

function CoordinatePlaneThumb() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
      <line x1="8" y1="24" x2="42" y2="24" stroke="#6b4423" strokeWidth="1.5" />
      <line x1="24" y1="40" x2="24" y2="8" stroke="#6b4423" strokeWidth="1.5" />
      <polygon points="42,24 37,21.4 37,26.6" fill="#6b4423" />
      <polygon points="24,8 21.4,13 26.6,13" fill="#6b4423" />
      <line x1="24" y1="24" x2="36" y2="12" stroke="#c45a7a" strokeWidth="1.6" />
      <circle cx="32" cy="16" r="1.7" fill="#6b4423" />
    </svg>
  );
}

function SolidThumb() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
      <polygon points="14,16 28,12 40,18 26,22" fill="#efe7dc" stroke="#6b4423" strokeWidth="1.4" />
      <polygon points="14,16 26,22 26,36 14,30" fill="#e4d8c8" stroke="#6b4423" strokeWidth="1.4" />
      <polygon points="26,22 40,18 40,32 26,36" fill="#f4eee6" stroke="#6b4423" strokeWidth="1.4" />
      <line x1="14" y1="16" x2="14" y2="30" stroke="#6b4423" strokeWidth="1.3" strokeDasharray="2.4 1.8" />
      <line x1="14" y1="30" x2="26" y2="36" stroke="#6b4423" strokeWidth="1.3" />
      <line x1="14" y1="30" x2="28" y2="26" stroke="#6b4423" strokeWidth="1.2" strokeDasharray="2.4 1.8" />
    </svg>
  );
}

function SectorThumb() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
      <circle cx="24" cy="24" r="16" fill="none" stroke="#6b4423" strokeWidth="1.6" />
      <path d="M24 24 L40 24 A16 16 0 0 0 32.3 10.3 Z" fill="#efe7dc" stroke="#6b4423" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="1.6" fill="#6b4423" />
    </svg>
  );
}

function InequalityThumb() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
      <line x1="6" y1="30" x2="42" y2="30" stroke="#6b4423" strokeWidth="1.5" />
      <polygon points="6,30 11,27.4 11,32.6" fill="#6b4423" />
      <polygon points="42,30 37,27.4 37,32.6" fill="#6b4423" />
      <line x1="14" y1="27" x2="14" y2="33" stroke="#6b4423" strokeWidth="1.2" />
      <line x1="22" y1="27" x2="22" y2="33" stroke="#6b4423" strokeWidth="1.2" />
      <line x1="30" y1="27" x2="30" y2="33" stroke="#6b4423" strokeWidth="1.2" />
      <line x1="38" y1="27" x2="38" y2="33" stroke="#6b4423" strokeWidth="1.2" />
      <rect x="22" y="16" width="16" height="14" fill="#f4c4d4" />
      <line x1="22" y1="16" x2="22" y2="30" stroke="#6b4423" strokeWidth="1.3" />
      <line x1="22" y1="16" x2="40" y2="16" stroke="#6b4423" strokeWidth="1.3" />
      <polygon points="40,16 36,13.6 36,18.4" fill="#6b4423" />
      <circle cx="22" cy="30" r="2.4" fill="#fff" stroke="#6b4423" strokeWidth="1.4" />
    </svg>
  );
}

function HistogramThumb() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
      <line x1="8" y1="38" x2="42" y2="38" stroke="#6b4423" strokeWidth="1.5" />
      <line x1="10" y1="40" x2="10" y2="8" stroke="#6b4423" strokeWidth="1.5" />
      <rect x="14" y="28" width="6" height="10" fill="#efe7dc" stroke="#6b4423" strokeWidth="1.2" />
      <rect x="20" y="18" width="6" height="20" fill="#efe7dc" stroke="#6b4423" strokeWidth="1.2" />
      <rect x="26" y="14" width="6" height="24" fill="#efe7dc" stroke="#6b4423" strokeWidth="1.2" />
      <rect x="32" y="22" width="6" height="16" fill="#efe7dc" stroke="#6b4423" strokeWidth="1.2" />
      <polyline
        points="14,38 17,28 23,18 29,14 35,22 41,38"
        fill="none"
        stroke="#c45a7a"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function DivisionThumb() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
      <line x1="16" y1="12" x2="42" y2="12" stroke="#6b4423" strokeWidth="1.5" />
      <line x1="16" y1="12" x2="16" y2="20" stroke="#6b4423" strokeWidth="1.5" />
      <text x="8" y="22" fontSize="11" fill="#6b4423" fontFamily="serif">
        7
      </text>
      <text x="20" y="22" fontSize="11" fill="#6b4423" fontFamily="serif">
        1
      </text>
      <text x="22" y="10" fontSize="9" fill="#6b4423" fontFamily="serif">
        0.14
      </text>
      <circle cx="20" cy="19" r="5" fill="#f4c5d4" />
      <text x="20" y="22" fontSize="11" fill="#6b4423" fontFamily="serif">
        1
      </text>
    </svg>
  );
}

