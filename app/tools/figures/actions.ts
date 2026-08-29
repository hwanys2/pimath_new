"use server";

import { revalidatePath } from "next/cache";
import { getDiagramTool } from "@/lib/diagrams/catalog";
import {
  listDiagramFeedback,
  mapFeedbackError,
} from "@/lib/diagrams/feedback";
import type {
  DiagramFeedbackItem,
  DiagramFeedbackStatus,
} from "@/lib/diagrams/feedback-types";
import { createClient } from "@/lib/supabase/server";

export type DiagramFeedbackActionResult = {
  error?: string;
  comments?: DiagramFeedbackItem[];
};

async function refreshComments(
  toolId: string,
): Promise<DiagramFeedbackItem[]> {
  revalidatePath(`/tools/figures/${toolId}`);
  return listDiagramFeedback(toolId);
}

export async function createDiagramFeedbackAction(input: {
  toolId: string;
  body: string;
}): Promise<DiagramFeedbackActionResult> {
  const tool = getDiagramTool(input.toolId);
  if (!tool || tool.status !== "ready") {
    return { error: "도구를 찾을 수 없어요." };
  }

  const body = input.body.trim();
  if (!body) return { error: "내용을 입력해 주세요." };
  if (body.length > 2000) return { error: "내용은 2000자까지예요." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_create_diagram_feedback", {
    p_tool_id: tool.id,
    p_body: body,
    p_tool_title: tool.title,
  });

  if (error) {
    console.error("[pm] createDiagramFeedback failed:", error.message);
    return { error: mapFeedbackError(error.message) };
  }

  return { comments: await refreshComments(tool.id) };
}

export async function resolveDiagramFeedbackAction(input: {
  toolId: string;
  id: string;
  status: DiagramFeedbackStatus;
  adminNote: string;
}): Promise<DiagramFeedbackActionResult> {
  const tool = getDiagramTool(input.toolId);
  if (!tool) return { error: "도구를 찾을 수 없어요." };
  if (input.status !== "applied" && input.status !== "rejected") {
    return { error: "요청이 올바르지 않아요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_resolve_diagram_feedback", {
    p_id: input.id,
    p_status: input.status,
    p_admin_note: input.adminNote.trim() || null,
  });

  if (error) {
    console.error("[pm] resolveDiagramFeedback failed:", error.message);
    return { error: mapFeedbackError(error.message) };
  }

  return { comments: await refreshComments(tool.id) };
}
