"use client";

import { useCallback, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteStudent } from "@/app/teacher/actions";
import DangerConfirmDialog from "@/components/teacher/DangerConfirmDialog";

type Props = {
  classId: string;
  studentId: string;
  displayName: string;
};

function ConfirmSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="block-btn block-btn-peach font-display px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "삭제 중…" : "영구 삭제"}
    </button>
  );
}

export default function DeleteStudentButton({
  classId,
  studentId,
  displayName,
}: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-[#a63a1a] underline-offset-2 hover:underline"
      >
        삭제
      </button>
      <DangerConfirmDialog
        open={open}
        title="학생을 삭제할까요?"
        onClose={close}
      >
        <form action={deleteStudent} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="studentId" value={studentId} />
          <p className="text-sm leading-relaxed text-foreground/75">
            <strong className="text-foreground">{displayName}</strong> 학생을
            삭제하면{" "}
            <strong className="text-[#a63a1a]">되돌릴 수 없어요.</strong>
          </p>
          <p className="rounded-xl bg-peach/40 px-3 py-2 text-sm font-semibold leading-relaxed text-[#a63a1a]">
            로그인 계정, QR, 경험치(XP), 학습 기록, 게임·대전 기록이 모두 영구
            삭제됩니다.
          </p>
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-xl bg-wood/10 px-4 py-2 text-sm font-bold text-wood hover:bg-wood/15"
            >
              취소
            </button>
            <ConfirmSubmit />
          </div>
        </form>
      </DangerConfirmDialog>
    </>
  );
}
