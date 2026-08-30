import type { SceneCmd } from "@/lib/diagrams/scene";

export type IconId =
  | "school"
  | "home"
  | "store"
  | "library"
  | "hospital"
  | "park"
  | "busStop"
  | "station"
  | "mart"
  | "cafe"
  | "post"
  | "gym"
  | "tree"
  | "mountain"
  | "bridge"
  | "person"
  | "bus"
  | "bike"
  | "playground"
  | "plaza";

export const ICON_EMOJI: Record<IconId, string> = {
  school: "🏫",
  home: "🏠",
  store: "🏪",
  library: "📚",
  hospital: "🏥",
  park: "🌳",
  busStop: "🚏",
  station: "🚉",
  mart: "🛒",
  cafe: "☕",
  post: "📮",
  gym: "🏋️",
  tree: "🌲",
  mountain: "⛰️",
  bridge: "🌉",
  person: "🧍",
  bus: "🚌",
  bike: "🚲",
  playground: "🎠",
  plaza: "🏛️",
};

export const ICON_OPTIONS: { id: IconId; label: string; emoji: string }[] = [
  { id: "school", label: "학교", emoji: ICON_EMOJI.school },
  { id: "home", label: "집", emoji: ICON_EMOJI.home },
  { id: "store", label: "가게", emoji: ICON_EMOJI.store },
  { id: "library", label: "도서관", emoji: ICON_EMOJI.library },
  { id: "hospital", label: "병원", emoji: ICON_EMOJI.hospital },
  { id: "park", label: "공원", emoji: ICON_EMOJI.park },
  { id: "busStop", label: "정류장", emoji: ICON_EMOJI.busStop },
  { id: "station", label: "역", emoji: ICON_EMOJI.station },
  { id: "mart", label: "마트", emoji: ICON_EMOJI.mart },
  { id: "cafe", label: "카페", emoji: ICON_EMOJI.cafe },
  { id: "post", label: "우체국", emoji: ICON_EMOJI.post },
  { id: "gym", label: "체육관", emoji: ICON_EMOJI.gym },
  { id: "tree", label: "나무", emoji: ICON_EMOJI.tree },
  { id: "mountain", label: "산", emoji: ICON_EMOJI.mountain },
  { id: "bridge", label: "다리", emoji: ICON_EMOJI.bridge },
  { id: "person", label: "사람", emoji: ICON_EMOJI.person },
  { id: "bus", label: "버스", emoji: ICON_EMOJI.bus },
  { id: "bike", label: "자전거", emoji: ICON_EMOJI.bike },
  { id: "playground", label: "놀이터", emoji: ICON_EMOJI.playground },
  { id: "plaza", label: "광장", emoji: ICON_EMOJI.plaza },
];

export function iconEmoji(icon: IconId): string {
  return ICON_EMOJI[icon];
}

/** Draw a place icon centered at (cx, cy). */
export function appendIconCmds(
  cmds: SceneCmd[],
  icon: IconId,
  cx: number,
  cy: number,
  size: number,
): void {
  cmds.push({
    t: "emoji",
    x: cx,
    y: cy,
    char: ICON_EMOJI[icon],
    size: size * 0.92,
  });
}
