import type { ReactNode } from "react";

/** host 대시보드: root main padding/max-width 탈출 */
export default function GraphHostLayout({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100dvh-5.5rem)] flex-col sm:-mx-6">
      {children}
    </div>
  );
}
