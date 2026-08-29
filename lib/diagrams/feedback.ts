import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getDiagramTool } from "@/lib/diagrams/catalog";
import type {
  DiagramFeedbackItem,
  DiagramFeedbackStatus,
} from "@/lib/diagrams/feedback-types";

export type {
  DiagramFeedbackItem,
  DiagramFeedbackStatus,
} from "@/lib/diagrams/feedback-types";

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asStatus(value: unknown): DiagramFeedbackStatus {
  return value === "applied" || value === "rejected" ? value : "open";
}

function mapRow(row: Record<string, unknown>): DiagramFeedbackItem | null {
  const id = asText(row.id);
  const body = asText(row.body);
  const createdAt = asText(row.created_at);
  if (!id || !body || !createdAt) return null;
  return {
    id,
    body,
    status: asStatus(row.status),
    adminNote: asText(row.admin_note),
    authorName: asText(row.author_name) ?? "회원",
    isAuthor: Boolean(row.is_author),
    isAdminAuthor: Boolean(row.is_admin_author),
    createdAt,
    resolvedAt: asText(row.resolved_at),
  };
}

function firstRows(data: unknown): Record<string, unknown>[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is Record<string, unknown> =>
        row != null && typeof row === "object",
    );
  }
  if (typeof data === "object") return [data as Record<string, unknown>];
  return [];
}

export async function listDiagramFeedback(
  toolId: string,
): Promise<DiagramFeedbackItem[]> {
  if (!getDiagramTool(toolId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_list_diagram_feedback", {
    p_tool_id: toolId,
  });
  if (error) {
    console.error("[pm] listDiagramFeedback failed:", error.message);
    return [];
  }
  return firstRows(data)
    .map(mapRow)
    .filter((row): row is DiagramFeedbackItem => row != null);
}

export function mapFeedbackError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("login_required")) {
    return "로그인이 필요해요.";
  }
  if (lower.includes("not allowed")) {
    return "이 의견은 지울 수 없어요.";
  }
  if (lower.includes("body_required")) {
    return "내용을 입력해 주세요.";
  }
  if (lower.includes("body_too_long") || lower.includes("note_too_long")) {
    return "내용은 2000자까지예요.";
  }
  if (lower.includes("too fast")) {
    return "조금 뒤에 다시 보내 주세요.";
  }
  if (lower.includes("not admin")) {
    return "관리자만 처리할 수 있어요.";
  }
  if (lower.includes("not found")) {
    return "의견을 찾을 수 없어요.";
  }
  if (lower.includes("invalid tool") || lower.includes("invalid status")) {
    return "요청이 올바르지 않아요.";
  }
  return `처리하지 못했어요. (${message})`;
}
