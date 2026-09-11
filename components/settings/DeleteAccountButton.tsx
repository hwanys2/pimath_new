"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteMyAccount,
  getDeleteAccountPreview,
  type DeleteAccountPreview,
  type DeleteAccountState,
} from "@/app/settings/actions";
import { UserMinusIcon } from "@/components/icons";
import DangerConfirmDialog from "@/components/teacher/DangerConfirmDialog";

const empty: DeleteAccountState = {};

function ConfirmSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="block-btn block-btn-peach font-display px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "탈퇴 중…" : "영구 탈퇴"}
    </button>
  );
}

export default function DeleteAccountButton({
  variant = "page",
  dialogOpen,
  onDialogOpenChange,
  hideTrigger = false,
}: {
  variant?: "menu" | "page";
  dialogOpen?: boolean;
  onDialogOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [preview, setPreview] = useState<DeleteAccountPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [state, formAction] = useActionState(deleteMyAccount, empty);

  const open = dialogOpen ?? internalOpen;
  const setOpen = onDialogOpenChange ?? setInternalOpen;

  const close = useCallback(() => {
    setOpen(false);
    setTyped("");
    setPreviewError(null);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getDeleteAccountPreview()
      .then((next) => {
        if (!cancelled) {
          setPreview(next);
          setPreviewError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewError("학급 정보를 불러오지 못했어요.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const name = preview?.name ?? "";
  const matches = Boolean(name) && typed.trim() === name.trim();

  return (
    <>
      {hideTrigger ? null : variant === "menu" ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => setOpen(true)}
          className="font-display flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-[#a63a1a] transition hover:bg-peach/40"
        >
          <span className="shrink-0 text-[#a63a1a]/70">
            <UserMinusIcon className="h-4 w-4" />
          </span>
          탈퇴
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-display rounded-xl border-2 border-[#a63a1a]/30 bg-peach/30 px-4 py-2.5 text-sm text-[#a63a1a] transition hover:bg-peach/50"
        >
          계정 탈퇴
        </button>
      )}

      <DangerConfirmDialog
        open={open}
        title="정말 탈퇴할까요?"
        onClose={close}
      >
        <form
          action={formAction}
          onSubmit={(event) => {
            if (!matches) event.preventDefault();
          }}
          className="mt-3 flex flex-col gap-3"
        >
          <p className="text-sm leading-relaxed text-foreground/75">
            탈퇴하면{" "}
            <strong className="text-[#a63a1a]">되돌릴 수 없어요.</strong>{" "}
            선생님 계정과 학급, 학생 데이터가 데이터베이스에서 모두
            사라집니다.
          </p>
          <p className="rounded-xl bg-peach/40 px-3 py-2 text-sm font-semibold leading-relaxed text-[#a63a1a]">
            {preview
              ? `학급 ${preview.classCount}개, 학생 ${preview.studentCount}명의 로그인 계정, QR, 경험치(XP), 학습 기록, 게임·대전 기록이 모두 영구 삭제됩니다.`
              : previewError
                ? previewError
                : "학급과 학생 수를 확인하는 중…"}
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-wood">
              확인하려면 닉네임
              {name ? ` 「${name}」` : ""}을 입력하세요
            </span>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              name="confirm"
              autoComplete="off"
              autoFocus
              disabled={!name}
              className="w-full rounded-xl border-2 border-wood/15 bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-sky focus:ring-2 focus:ring-sky/40 disabled:opacity-60"
            />
          </label>
          {state.error ? (
            <p className="text-sm text-red-700" role="alert">
              {state.error}
            </p>
          ) : null}
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
