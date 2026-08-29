export type DiagramFeedbackStatus = "open" | "applied" | "rejected";

export type DiagramFeedbackItem = {
  id: string;
  body: string;
  status: DiagramFeedbackStatus;
  adminNote: string | null;
  authorName: string;
  isAuthor: boolean;
  isAdminAuthor: boolean;
  createdAt: string;
  resolvedAt: string | null;
};
