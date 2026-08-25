export type ContentType = "simulation" | "game" | "inquiry";

export type InquiryMeta = {
  stepCount: number;
  grading: "auto" | "none";
  scoring?: boolean;
};

export type ContentMeta = {
  /** Stable id — stored in pm_class_contents.content_key. Do not rename. */
  key: string;
  unitId: string;
  type: ContentType;
  title: string;
  /** Public play path, e.g. /play/g1-u1-1-sieve-eratosthenes */
  href: string;
  /** false for simulation; game/inquiry depend on type and inquiry.scoring */
  awardsXp: boolean;
  description?: string;
  inquiry?: InquiryMeta;
};

/**
 * Code catalog of playable content. DB only stores class assignments.
 * See docs/content-system.md.
 */
export const CONTENTS: ContentMeta[] = [
  {
    key: "g1-u1-1-sieve-eratosthenes",
    unitId: "g1-1-1",
    type: "simulation",
    title: "에라토스테네스의 체",
    href: "/play/g1-u1-1-sieve-eratosthenes",
    awardsXp: false,
    description:
      "숫자 격자에서 배수를 지워 가며 소수를 찾아보는 시뮬레이션입니다. 점수는 없어요.",
  },
  {
    key: "g1-u1-1-prime-hunt",
    unitId: "g1-1-1",
    type: "game",
    title: "소수 찾기",
    href: "/play/g1-u1-1-prime-hunt",
    awardsXp: true,
    description:
      "1000 이하 홀수 · 한 판에 나눠 보기 10번, 문제당 10초. 소수인지 판정하는 게임입니다. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
  {
    key: "g1-u1-1-factor-rain",
    unitId: "g1-1-1",
    type: "game",
    title: "소인수분해 소나기",
    href: "/play/g1-u1-1-factor-rain",
    awardsXp: true,
    description:
      "떨어지는 숫자를 소수로 나눠 1까지 소인수분해하는 게임입니다. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
  {
    key: "g1-u1-1-knight-prime",
    unitId: "g1-1-1",
    type: "game",
    title: "나이트 프라임",
    href: "/play/g1-u1-1-knight-prime",
    awardsXp: true,
    description:
      "체스 나이트처럼 L자로 움직이며 소수를 밟아 점수를 모으는 게임입니다. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
  {
    key: "g1-u1-2-sign-slime",
    unitId: "g1-1-2",
    type: "game",
    title: "부호 슬라임 대소동",
    href: "/play/g1-u1-2-sign-slime",
    awardsXp: true,
    description:
      "슬라임의 수식을 맞춰 수정구슬로 공격! 6가지 연산 단계를 골라 정수·유리수 사칙연산을 연습하는 게임. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
  {
    key: "g1-u2-2-linear-equation-balance",
    unitId: "g1-2-2",
    type: "inquiry",
    title: "대수막대와 저울로 일차방정식",
    href: "/play/g1-u2-2-linear-equation-balance",
    awardsXp: true,
    inquiry: { stepCount: 15, grading: "auto", scoring: true },
    description:
      "양팔저울과 대수막대(x, −x, 1, −1)로 등식의 성질을 탐구하고 일차방정식을 풀어 보는 활동. 학생은 선생님이 수업을 시작할 때만 참여해요.",
  },
  {
    key: "g1-u2-2-linear-equation-race",
    unitId: "g1-2-2",
    type: "inquiry",
    title: "일차방정식 레이스",
    href: "/play/g1-u2-2-linear-equation-race",
    awardsXp: true,
    inquiry: { stepCount: 15, grading: "auto", scoring: true },
    description:
      "연산을 선택해 일차방정식을 풀고 속도로 점수를 겨루는 탐구 게임. 학생은 선생님이 수업을 시작할 때만 참여해요.",
  },
  {
    key: "g1-u2-3-ordered-pair-omok",
    unitId: "g1-2-3",
    type: "game",
    title: "순서쌍 오목",
    href: "/play/g1-u2-3-ordered-pair-omok",
    awardsXp: true,
    description:
      "좌표평면에서 순서쌍 (x, y)만으로 오목을 두는 게임입니다. 컴퓨터·같은 반·전체 매칭. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
  {
    key: "g1-u3-1-angle-guess",
    unitId: "g1-3-1",
    type: "game",
    title: "각도 맞히기",
    href: "/play/g1-u3-1-angle-guess",
    awardsXp: true,
    description:
      "벌어지는 각의 크기를 맞히는 게임입니다. 30→10→5→1도 간격으로 승급. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
  {
    key: "g1-u3-3-sector-area-rect",
    unitId: "g1-3-3",
    type: "simulation",
    title: "부채꼴을 직사각형으로",
    href: "/play/g1-u3-3-sector-area-rect",
    awardsXp: false,
    description:
      "부채꼴을 작게 나눠 직사각형으로 재배열하며 넓이 공식(½×r×l)을 유추하는 시뮬레이션입니다. 점수는 없어요.",
  },
  {
    key: "g1-u3-4-solid-of-revolution",
    unitId: "g1-3-4",
    type: "simulation",
    title: "회전체 만들기",
    href: "/play/g1-u3-4-solid-of-revolution",
    awardsXp: false,
    description:
      "축을 중심으로 평면도형을 회전시켜 회전체를 만들고, 각도를 바꿔 형성 과정을 확인하는 시뮬레이션입니다. 점수는 없어요.",
  },
  {
    key: "g1-u3-4-pyramid-volume-blocks",
    unitId: "g1-3-4",
    type: "simulation",
    title: "블럭으로 보는 뿔의 부피",
    href: "/play/g1-u3-4-pyramid-volume-blocks",
    awardsXp: false,
    description:
      "정육면체 단위 블럭 계단(바깥·안쪽)으로 사각뿔 부피를 세며, 기둥 부피의 1/3에 다가감을 탐구하는 시뮬레이션입니다. 점수는 없어요.",
  },
  {
    key: "g2-u1-repeating-decimal",
    unitId: "g2-1",
    type: "simulation",
    title: "분수를 순환소수로",
    href: "/play/g2-u1-repeating-decimal",
    awardsXp: false,
    description:
      "분자·분모를 넣으면 소수로 바꾸고, 순환마디 길이와 한국식 순환 표기를 보여 주는 시뮬레이션입니다. 점수는 없어요.",
  },
  {
    key: "g2-u3-1-quadrilateral-maker",
    unitId: "g2-3-1",
    type: "game",
    title: "사각형 만들기",
    href: "/play/g2-u3-1-quadrilateral-maker",
    awardsXp: true,
    description:
      "가위바위보 후 도형을 고르고, 격자에 돌을 두어 먼저 사각형을 완성하는 게임입니다. 컴퓨터·같은 반·전체 매칭. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
  {
    key: "g2-u4-dice-simulation",
    unitId: "g2-4",
    type: "simulation",
    title: "주사위 확률 시뮬레이션",
    href: "/play/g2-u4-dice-simulation",
    awardsXp: false,
    description:
      "일반 주사위와 직육면체 주사위(윗·아랫면 0.1, 옆면 0.2)를 굴리며 특정 눈이 나올 상대도수가 이론적 확률에 수렴함을 그래프로 확인하는 시뮬레이션입니다. 점수는 없어요.",
  },
  {
    key: "g2-u4-dice-sum-race",
    unitId: "g2-4",
    type: "game",
    title: "주사위 합 10번 채우기",
    href: "/play/g2-u4-dice-sum-race",
    awardsXp: true,
    description:
      "교사가 주사위를 굴리면 2~12 합 칸이 채워져요. 10번 먼저 채워지는 합을 맞히고, 내 숫자가 나올 때마다 10점! 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
  {
    key: "g2-u4-ball-box-guess",
    unitId: "g2-4",
    type: "game",
    title: "상자 속 공 개수 맞히기",
    href: "/play/g2-u4-ball-box-guess",
    awardsXp: true,
    description:
      "교사가 숨긴 색깔 공 상자에서 복원추출로 공을 뽑으며 색깔별 개수를 추정해 맞히는 확률 게임. 빠르게 맞힐수록 높은 점수! 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
  {
    key: "g3-u1-irrational-square",
    unitId: "g3-1",
    type: "simulation",
    title: "정사각형으로 만나는 무리수",
    href: "/play/g3-u1-irrational-square",
    awardsXp: false,
    description:
      "넓이가 정수인 정사각형의 한 변 길이를 10번 직접 찾아 보며, 제곱값이 넓이와 정확히 맞지 않음을 체험하는 시뮬레이션입니다. 점수는 없어요.",
  },
  {
    key: "g3-u1-radical-fill",
    unitId: "g3-1",
    type: "inquiry",
    title: "근호 빈칸 채우기",
    href: "/play/g3-u1-radical-fill",
    awardsXp: false,
    inquiry: { stepCount: 10, grading: "auto", scoring: true },
    description:
      "서로 다른 수로 근호 연산 식의 빈칸을 채워 등식을 완성하는 탐구 활동. 학생은 선생님이 수업을 시작할 때만 참여해요. 계수는 음수·분수 가능, 근호 안은 양수만.",
  },
  {
    key: "g3-u1-square-maker",
    unitId: "g3-1",
    type: "game",
    title: "정사각형 만들기",
    href: "/play/g3-u1-square-maker",
    awardsXp: true,
    description:
      "가위바위보로 선공을 정하고, 격자에 돌을 두어 먼저 정사각형을 완성하는 게임입니다. 컴퓨터·같은 반·전체 매칭. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
  {
    key: "g3-u3-1-tangent-intro",
    unitId: "g3-3-1",
    type: "inquiry",
    title: "높이 재기 탐구",
    href: "/play/g3-u3-1-tangent-intro",
    awardsXp: true,
    inquiry: { stepCount: 5, grading: "auto", scoring: true },
    description:
      "건물·나무·등대 높이를 거리와 각만으로 구하고, 표를 만든 뒤 그 수에 탄젠트라는 이름을 붙이는 탐구 활동. 학생은 선생님이 수업을 시작할 때만 참여해요.",
  },
  {
    key: "g3-u3-1-sincos-intro",
    unitId: "g3-3-1",
    type: "inquiry",
    title: "사인·코사인 탐구",
    href: "/play/g3-u3-1-sincos-intro",
    awardsXp: true,
    inquiry: { stepCount: 5, grading: "auto", scoring: true },
    description:
      "연실·사다리·거치대의 빗변과 각만으로 수평거리와 높이를 구하고, 표를 만들며 사인·코사인을 만나는 탐구 활동. 학생은 선생님이 수업을 시작할 때만 참여해요.",
  },
  {
    key: "g3-u3-1-trig-builder",
    unitId: "g3-3-1",
    type: "game",
    title: "삼각비 다리 놓기",
    href: "/play/g3-u3-1-trig-builder",
    awardsXp: true,
    description:
      "끊어진 다리 길이를 길이×삼각비(각도)로 직접 입력해 잇는 게임입니다. 계산 대신 수식 표현력을 길러요. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
  {
    key: "g3-u3-1-trigo-slash",
    unitId: "g3-3-1",
    type: "game",
    title: "삼각비 슬래시",
    href: "/play/g3-u3-1-trigo-slash",
    awardsXp: true,
    description:
      "돌아가거나 뒤집힌 직각삼각형에서 기준각의 높이·밑변·빗변을 스와이프로 베어 삼각비를 익히는 게임입니다. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
];

export function getContent(key: string): ContentMeta | undefined {
  return CONTENTS.find((c) => c.key === key);
}

export function getContentsForUnit(unitId: string): ContentMeta[] {
  return CONTENTS.filter((c) => c.unitId === unitId);
}

export function contentTypeLabel(type: ContentType): string {
  switch (type) {
    case "simulation":
      return "시뮬레이션";
    case "inquiry":
      return "탐구";
    default:
      return "게임";
  }
}

/** Distinct pill colors so sim vs game is obvious at a glance. */
export function contentTypeBadgeClass(type: ContentType): string {
  switch (type) {
    case "simulation":
      return "bg-sky/55 text-wood";
    case "inquiry":
      return "bg-lavender/60 text-wood";
    default:
      return "bg-gold/70 text-wood";
  }
}
