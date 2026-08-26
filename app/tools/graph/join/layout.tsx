import type { ReactNode } from "react";

/** 학생 참여: root main padding을 줄여 뷰포트 높이를 최대한 활용 */
export default function GraphJoinLayout({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100dvh-5.5rem)] flex-col sm:-mx-6 sm:-my-8">
      {children}
    </div>
  );
}
