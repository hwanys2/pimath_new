"use client";

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
import { getUnit, getUnitLabel } from "@/lib/curriculum";
import type { ClassContentAssignment } from "@/lib/class-contents";

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

export default function ClassContentManager({ classId, assignments }: Props) {
  const byKey = useMemo(() => {
    const map = new Map<string, ClassContentAssignment>();
    for (const a of assignments) map.set(a.contentKey, a);
    return map;
  }, [assignments]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl text-wood">수업 콘텐츠</h2>
        <p className="mt-1 text-sm text-foreground/65">
          담아두면 학생 목록에 보이고, 활성화해야 목록에서 플레이할 수 있어요.
          공개 링크는 배정과 관계없이 항상 열립니다.
        </p>
      </div>

      {CONTENTS.length === 0 ? (
        <p className="text-sm text-foreground/50">등록된 콘텐츠가 아직 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {CONTENTS.map((content) => (
            <ContentRow
              key={content.key}
              classId={classId}
              content={content}
              assignment={byKey.get(content.key)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
