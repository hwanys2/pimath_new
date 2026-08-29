"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AssignContentButton, {
  type TeacherClassOption,
} from "@/components/content/AssignContentButton";
import { useActor } from "@/components/auth/ActorProvider";

type TeacherAssignContext = {
  classes: TeacherClassOption[];
  assignedByContent: Record<string, string[]>;
};

const AssignContext = createContext<TeacherAssignContext | null | undefined>(
  undefined,
);

function useAssignContext(keys: string[]): TeacherAssignContext | null {
  const scoped = useContext(AssignContext);
  const { actor, loading } = useActor();
  const [ctx, setCtx] = useState<TeacherAssignContext | null>(null);
  const keyParam = keys.join(",");

  useEffect(() => {
    if (scoped !== undefined) return;
    if (loading || actor?.type !== "teacher" || keys.length === 0) {
      setCtx(null);
      return;
    }

    let cancelled = false;
    void fetch(`/api/teacher/assign-context?keys=${encodeURIComponent(keyParam)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : { ctx: null }))
      .then((data: { ctx?: TeacherAssignContext | null }) => {
        if (!cancelled) setCtx(data.ctx ?? null);
      })
      .catch(() => {
        if (!cancelled) setCtx(null);
      });

    return () => {
      cancelled = true;
    };
  }, [actor, keyParam, keys.length, loading, scoped]);

  if (scoped !== undefined) return scoped;
  return ctx;
}

export function TeacherAssignScope({
  contentKeys,
  children,
}: {
  contentKeys: string[];
  children: ReactNode;
}) {
  const ctx = useAssignContext(contentKeys);
  const value = useMemo(() => ctx, [ctx]);
  return (
    <AssignContext.Provider value={value}>{children}</AssignContext.Provider>
  );
}

export default function TeacherAssignSlot({
  contentKey,
}: {
  contentKey: string;
}) {
  const { actor } = useActor();
  const ctx = useAssignContext([contentKey]);

  if (actor?.type !== "teacher" || !ctx) return null;

  return (
    <AssignContentButton
      contentKey={contentKey}
      classes={ctx.classes}
      assignedClassIds={ctx.assignedByContent[contentKey] ?? []}
    />
  );
}
