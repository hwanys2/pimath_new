import type { ReactNode } from "react";
import DiagramFeedback from "@/components/tools/figures/DiagramFeedback";
import { isDiagramAdminEmail } from "@/lib/diagrams/admin";
import type { DiagramToolMeta } from "@/lib/diagrams/catalog";
import { listDiagramFeedback } from "@/lib/diagrams/feedback";
import { getDisplayUser } from "@/lib/auth";

/**
 * Shared chrome for every /tools/figures/{toolId} page.
 * Studio goes in children; feedback is always mounted. Do not bypass this.
 */
export default async function DiagramToolShell({
  tool,
  children,
}: {
  tool: DiagramToolMeta;
  children: ReactNode;
}) {
  const [user, comments] = await Promise.all([
    getDisplayUser(),
    listDiagramFeedback(tool.id),
  ]);

  return (
    <div className="space-y-10">
      {children}
      <DiagramFeedback
        toolId={tool.id}
        toolTitle={tool.title}
        initialComments={comments}
        isLoggedIn={user != null}
        isAdmin={isDiagramAdminEmail(user?.email)}
      />
    </div>
  );
}
