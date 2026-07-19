export type RankingScope = "world" | "school" | "class";
export type RankingMode = "all" | "best";

export type RankingRow = {
  rank: number;
  studentId: string;
  displayName: string;
  className: string | null;
  score: number;
  createdAt: string;
  isMe: boolean;
};

export type XpRankingRow = {
  rank: number;
  studentId: string;
  displayName: string;
  className: string | null;
  totalXp: number;
  level: number;
  isMe: boolean;
};
