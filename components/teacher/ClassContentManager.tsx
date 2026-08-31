"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  assignContentToClass,
  setClassContentActive,
  unassignContentFromClass,
  type ActionResult,
} from "@/app/teacher/actions";
import {
  CONTENTS,
  contentTypeBadgeClass,
  contentTypeLabel,
  type ContentMeta,
} from "@/lib/contents";
import { GRADES } from "@/lib/grades";
import { getUnit, getUnitLabel } from "@/lib/curriculum";
import type { ClassContentAssignment } from "@/lib/class-contents";
import { teacherGameDashboardHref } from "@/lib/game-dashboard-types";

type Props = {
  classId: string;
  assignments: ClassContentAssignment[];
};

const empty: ActionResult = {};

function CopyLinkButton({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="text-xs font-semibold text-wood underline-offset-2 hover:underline"
      onClick={async () => {
        const url =
          typeof window !== "undefined"
            ? `${window.location.origin}${href}`
            : href;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "복사됨!" : "공개 링크 복사"}
    </button>
  );
}

function ContentRow({
  classId,
  content,
  assignment,
}: {
  classId: string;
  content: ContentMeta;
  assignment: ClassContentAssignment | undefined;
}) {
  const [assignState, assignAction, assignPending] = useActionState(
    assignContentToClass,
    empty,
  );
  const [unassignState, unassignAction, unassignPending] = useActionState(
    unassignContentFromClass,
    empty,
  );
  const [activeState, activeAction, activePending] = useActionState(
    setClassContentActive,
    empty,
  );

  const unit = getUnit(content.unitId);
  const pending = assignPending || unassignPending || activePending;
  const message =
    assignState.message ||
    unassignState.message ||
    activeState.message ||
    assignState.error ||
    unassignState.error ||
    activeState.error;

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-wood/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${contentTypeBadgeClass(content.type)}`}
          >
            {contentTypeLabel(content.type)}
          </span>
          {!content.awardsXp ? (
            <span className="text-[11px] font-semibold text-foreground/50">
              점수 없음
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-foreground/50">
              XP 있음
            </span>
          )}
          {assignment ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                assignment.isActive
                  ? "bg-mint/40 text-wood"
                  : "bg-wood/15 text-foreground/60"
              }`}
            >
              {assignment.isActive ? "활성" : "비활성"}
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-foreground/40">
              미배정
            </span>
          )}
        </div>
        <p className="mt-1 font-display text-base text-foreground">
          {content.title}
        </p>
        <p className="text-xs text-foreground/55">
          {unit ? getUnitLabel(unit) : content.unitId}
        </p>
        {message ? (
          <p className="mt-1 text-xs font-semibold text-wood/80">{message}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CopyLinkButton href={content.href} />
        {assignment && content.type === "inquiry" ? (
          <Link
            href={`${content.href}?classId=${classId}`}
            className="rounded-xl bg-lavender/55 px-3 py-1.5 text-xs font-bold text-wood transition hover:brightness-105"
          >
            수업 대시보드
          </Link>
        ) : null}
        {assignment && content.type === "game" ? (
          <Link
            href={teacherGameDashboardHref(classId, content.key)}
            className="rounded-xl bg-gold/80 px-3 py-1.5 text-xs font-bold text-wood transition hover:brightness-105"
          >
            게임 대시보드
          </Link>
        ) : null}
        {assignment ? (
          <Link
            href={`/teacher/classes/${classId}/results/${content.key}`}
            className="rounded-xl bg-gold/50 px-3 py-1.5 text-xs font-bold text-wood transition hover:brightness-105"
          >
            {content.type === "game" ? "상세 기록" : "결과 보기"}
          </Link>
        ) : null}
        {!assignment ? (
          <form action={assignAction}>
            <input type="hidden" name="classId" value={classId} />
            <input type="hidden" name="contentKey" value={content.key} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-mint/50 px-3 py-1.5 text-xs font-bold text-wood disabled:opacity-50"
            >
              담아두기
            </button>
          </form>
        ) : (
          <>
            <form action={activeAction}>
              <input type="hidden" name="classId" value={classId} />
              <input type="hidden" name="contentKey" value={content.key} />
              <input
                type="hidden"
                name="isActive"
                value={assignment.isActive ? "false" : "true"}
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-sky/40 px-3 py-1.5 text-xs font-bold text-wood disabled:opacity-50"
              >
                {assignment.isActive ? "비활성화" : "활성화"}
              </button>
            </form>
            <form action={unassignAction}>
              <input type="hidden" name="classId" value={classId} />
              <input type="hidden" name="contentKey" value={content.key} />
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-wood/10 px-3 py-1.5 text-xs font-bold text-[#a63a1a] disabled:opacity-50"
              >
                빼기
              </button>
            </form>
          </>
        )}
      </div>
    </li>
  );
}

function ContentGrid({
  classId,
  contents,
  byKey,
}: {
  classId: string;
  contents: ContentMeta[];
  byKey: Map<string, ClassContentAssignment>;
}) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {contents.map((content) => (
        <ContentRow
          key={content.key}
          classId={classId}
          content={content}
          assignment={byKey.get(content.key)}
        />
      ))}
    </ul>
  );
}

export default function ClassContentManager({ classId, assignments }: Props) {
  const byKey = useMemo(() => {
    const map = new Map<string, ClassContentAssignment>();
    for (const a of assignments) map.set(a.contentKey, a);
    return map;
  }, [assignments]);

  const { active, inactive, unassignedByGrade } = useMemo(() => {
    const activeList: ContentMeta[] = [];
    const inactiveList: ContentMeta[] = [];
    const unassigned: ContentMeta[] = [];
    for (const content of CONTENTS) {
      const assignment = byKey.get(content.key);
      if (!assignment) unassigned.push(content);
      else if (assignment.isActive) activeList.push(content);
      else inactiveList.push(content);
    }
    return {
      active: activeList,
      inactive: inactiveList,
      unassignedByGrade: GRADES.map((grade) => ({
        grade,
        items: unassigned.filter(
          (content) => getUnit(content.unitId)?.grade === grade.id,
        ),
      })).filter((group) => group.items.length > 0),
    };
  }, [byKey]);

  const assignedCount = active.length + inactive.length;
  const unassignedCount = unassignedByGrade.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground/65">
        새 학급은 비어 있어요. 수업에 쓸 콘텐츠만 담아 두고, 활성화해야 학생
        목록에서 플레이할 수 있어요. 공개 링크는 배정과 관계없이 항상 열립니다.
      </p>

      {CONTENTS.length === 0 ? (
        <p className="text-sm text-foreground/50">등록된 콘텐츠가 아직 없어요.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {assignedCount === 0 ? (
            <p className="coming-soon-slot px-5 py-8 text-center text-sm text-foreground/55">
              아직 담아 둔 콘텐츠가 없어요. 아래 「콘텐츠 담기」에서 수업에 쓸
              것만 골라 주세요.
            </p>
          ) : (
            <>
              {active.length > 0 ? (
                <ContentGrid
                  classId={classId}
                  contents={active}
                  byKey={byKey}
                />
              ) : (
                <p className="rounded-2xl bg-wood/5 px-4 py-3 text-sm text-foreground/55">
                  담아 둔 콘텐츠는 모두 비활성이에요. 활성화해야 학생 목록에서
                  플레이할 수 있어요.
                </p>
              )}

              {inactive.length > 0 ? (
                <details className="group rounded-2xl bg-wood/5 open:bg-wood/[0.07]">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-foreground/65 marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block text-xs transition group-open:rotate-90"
                      >
                        ▸
                      </span>
                      비활성 {inactive.length}개
                    </span>
                  </summary>
                  <div className="px-3 pb-3">
                    <ContentGrid
                      classId={classId}
                      contents={inactive}
                      byKey={byKey}
                    />
                  </div>
                </details>
              ) : null}
            </>
          )}

          {unassignedCount > 0 ? (
            <details
              className="group rounded-2xl border-2 border-dashed border-wood/20 bg-white/60 open:bg-white/80"
              open={assignedCount === 0}
            >
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-wood marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block text-xs transition group-open:rotate-90"
                  >
                    ▸
                  </span>
                  콘텐츠 담기 · {unassignedCount}개
                </span>
              </summary>
              <div className="flex flex-col gap-4 px-3 pb-3">
                {unassignedByGrade.map(({ grade, items }) => (
                  <div key={grade.id} className="flex flex-col gap-2">
                    <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-wood/70">
                      {grade.label}
                    </h3>
                    <ContentGrid
                      classId={classId}
                      contents={items}
                      byKey={byKey}
                    />
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}
