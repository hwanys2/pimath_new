export function hofMyPlace(input: {
  students: { isMe: boolean; rank: number }[];
  viewingOwnGroup: boolean;
  viewerRank: number | null;
}): number | null {
  const fromRow = input.students.find((row) => row.isMe)?.rank ?? null;
  if (fromRow != null) return fromRow;
  if (input.viewingOwnGroup && input.viewerRank != null) return input.viewerRank;
  return null;
}
