export type RankingMode = "all" | "best";

export type RankingRow = {
  rank: number;
  studentId: string;
  displayName: string;
  score: number;
  createdAt: string;
  isMe: boolean;
};
