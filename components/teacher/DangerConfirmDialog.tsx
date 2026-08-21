"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export default function DangerConfirmDialog({
  open,
  title,
  onClose,
  children,
}: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-wood/40 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-3xl border-2 border-[#a63a1a]/30 bg-cream p-5 shadow-2xl sm:p-6">
        <h2
          id={titleId}
          className="font-display text-xl text-[#a63a1a] sm:text-2xl"
        >
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
