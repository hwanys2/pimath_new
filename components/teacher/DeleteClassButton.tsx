"use client";

import { useCallback, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteClass } from "@/app/teacher/actions";
import DangerConfirmDialog from "@/components/teacher/DangerConfirmDialog";

type Props = {
  classId: string;
  name: string;
  studentCount: number;
  label?: string;
};

function ConfirmSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="block-btn block-btn-peach font-display px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "삭제 중…" : "영구 삭제"}
    </button>
  );
}

export default function DeleteClassButton({
  classId,
  name,
  studentCount,
  label = "삭제",
}: Props) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === name.trim();

  const close = useCallback(() => {
    setOpen(false);
    setTyped("");
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-[#a63a1a] underline-offset-2 hover:underline"
      >
        {label}
      </button>
      <DangerConfirmDialog
        open={open}
        title="학급을 삭제할까요?"
        onClose={close}
      >
        <form
          action={deleteClass}
          onSubmit={(event) => {
            if (typed.trim() !== name.trim()) event.preventDefault();
          }}
          className="mt-3 flex flex-col gap-3"
        >
          <input type="hidden" name="classId" value={classId} />
          <p className="text-sm leading-relaxed text-foreground/75">
            학급을 삭제하면{" "}
            <strong className="text-[#a63a1a]">되돌릴 수 없어요.</strong>
          </p>
          <p className="rounded-xl bg-peach/40 px-3 py-2 text-sm font-semibold leading-relaxed text-[#a63a1a]">
            「{name}」의 학생 {studentCount}명과 함께 로그인 계정, QR,
            경험치(XP), 학습 기록, 게임·대전 기록이 모두 영구 삭제됩니다.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-wood">
              확인하려면 학급 이름 「{name}」을 입력하세요
            </span>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoFocus
              className="w-full rounded-xl border-2 border-wood/15 bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-sky focus:ring-2 focus:ring-sky/40"
            />
          </label>
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-xl bg-wood/10 px-4 py-2 text-sm font-bold text-wood hover:bg-wood/15"
            >
              취소
            </button>
            <ConfirmSubmit disabled={!matches} />
          </div>
        </form>
      </DangerConfirmDialog>
    </>
  );
}
