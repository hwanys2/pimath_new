"use client";

import { useState } from "react";
import { getOrCreateStudentQrToken } from "@/app/teacher/actions";
import { downloadDataUrl } from "@/components/teacher/downloadDataUrl";
import { qrDataUrl } from "@/lib/student-qr-image";
import { getStudentQrLoginUrl, studentQrFileName } from "@/lib/student-qr";

export default function StudentQrPngButton({
  studentId,
  displayName,
  origin,
}: {
  studentId: string;
  displayName: string;
  origin: string;
}) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      const result = await getOrCreateStudentQrToken(studentId);
      if (!result.token) {
        window.alert(result.error ?? "QR을 만들지 못했어요.");
        return;
      }
      await downloadDataUrl(
        await qrDataUrl(getStudentQrLoginUrl(origin, result.token)),
        studentQrFileName(displayName),
      );
    } catch {
      window.alert("QR 이미지를 저장하지 못했어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-xs font-semibold text-wood underline-offset-2 hover:underline disabled:opacity-40"
    >
      {pending ? "QR…" : "QR 저장"}
    </button>
  );
}
