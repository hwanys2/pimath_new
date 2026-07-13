# 수학하는 즐거움 — 캐릭터 & 아트 스타일 가이드

> 목적: 시뮬레이션·게임·배너·아이콘을 만들 때 **같은 세계관·같은 캐릭터**가 일관되게 보이도록 한다.  
> 새 이미지를 AI로 그리거나 디자이너에게 맡길 때 **이 문서를 먼저 참고**하고, 가능하면 `public/images/`의 기존 PNG를 **레퍼런스로 첨부**한다.

---

## 1. 세계관 한 줄 요약

중학교 수학을 **캐주얼 RPG / 모험 게임**처럼 탐험한다.  
학습 = 미션·퀘스트, 성취 = 레벨·배지. 캐릭터는 “선생님”이 아니라 **또래 모험가 동료**다.

브랜드명: **수학하는 즐거움** / **Math Adventure**

---

## 2. 공통 아트 스타일 (반드시 지킬 것)

| 항목 | 규칙 |
|------|------|
| 장르 | Casual mobile RPG / 모험 게임 일러스트 (애니메·만화풍, 과한 리얼리즘 X) |
| 선 | 깨끗하고 부드러운 라인. 너무 두껍거나 거친 스케치감 X |
| 채색 | 부드러운 셀셰이딩 + 약간의 그라데이션. 과한 글로우/네온 남발 X |
| 분위기 | 밝고 친근함. 중학생 대상 — 유치한 유아풍 X, 어두운 다크판타지 X |
| 비율 | 전신 기준 대략 4~5등신. 머리 크게, 눈 크고 표현력 있게 |
| 소품 | 수학 도구·기호를 **무기/마법 아이템**처럼 사용 (컴퍼스 지팡이, 수식 두루마리, 각도기 등) |
| 배경 | UI용 캐릭터는 **진짜 투명 PNG(알파)**. 체커보드 격자를 픽셀로 그리지 말 것 |
| 금지 | 보라 네온 사이버펑크, 현실 사진풍, 과도한 공포/잔혹, 성인화된 비율 |

### 공통 키워드 (영문 프롬프트용)

```
casual mobile RPG character art, clean soft lineart, soft cel-shading,
bright pastel adventure game style, friendly middle-school vibe,
math symbols as magical quest props, high quality digital illustration,
true transparent background PNG, no checkerboard, no watermark, no text UI
```

### 공통 네거티브

```
photorealistic, dark grim fantasy, horror, neon cyberpunk, low quality,
blurry, deformed hands, extra limbs, checkerboard background, fake transparency grid,
watermark, logo, UI buttons, adult proportions
```

---

## 3. 컬러 팔레트

### 사이트/UI 공통

| 이름 | 용도 | 대략 hex |
|------|------|----------|
| Cream | 페이지 배경 | `#FEF9F0` |
| Wood | 상단 메뉴바 | `#8B5E3C` |
| Sky | 버튼·악센트 | `#A8D8FF` |
| Mint | 중1 테마 | `#9DE8C8` |
| Peach | 중2 테마 | `#FFC9A8` |
| Lavender | 중3 테마 | `#D4C4FF` |
| Gold | CTA·배지 | `#FFD76A` |

### 캐릭터별 메인 컬러

| 캐릭터 | 메인 | 서브 | 포인트 |
|--------|------|------|--------|
| 파이 (메인 마스코트) | Sky blue `#7EC8F5` | Teal backpack `#5EC4B0` | Gold staff, Lavender sash |
| 초원 (중1) | Mint `#7DD3B0` | Teal `#4DB6A0` | Gold trim, Crystal blue blade |
| 언덕 (중2) | Peach `#F8B195` | Cream `#FFF0E0` | Lavender accents `#C9A0DC` |
| 별빛 (중3) | Lavender `#B8A0E8` | Cream sleeves | Gold stars, Purple crystal |

---

## 4. 캐릭터 시트

에셋 경로 기준: `public/images/`

### 4.1 파이 (Pi) — 메인 마스코트

| 항목 | 내용 |
|------|------|
| 파일 | `mascot-v2.png` |
| ID | `pi` / `mascot` |
| 역할 | 사이트 얼굴, 홈 히어로, 안내·튜토리얼 NPC |
| 학년 소속 | 공통 (전 학년 등장 가능) |
| 이름 제안 | **파이** (π를 모험의 상징으로) |
| 성별/나이감 | 남 / 중학생 또래 |
| 성격 | 밝고 자신감 있음. “같이 가보자!” 타입 |

**외형 고정 요소 (절대 바꾸지 말 것)**

- 갈색 헝클어진 짧은 머리, 큰 갈색 눈, 환한 미소
- 흰 티셔츠에 `+ − × ÷` 컬러 기호
- 연하늘색 오픈 후드 재킷 + 금색 별 핀
- 청록색 배낭 + 피타고라스 두루마리 (`a²+b²=c²` 삼각형 도해)
- 배낭 태그 `√x`, 허리 주머니 `?`
- **금색 컴퍼스/지팡이** (파란 다이얼 + 파란 수정 꼭대기, 숫자·기호가 떠다님)
- 연보라 긴 스카프/망토에 `π`, `=` 기호
- 파란 반바지 + 통굽 스니커즈

**레퍼런스 프롬프트 (영문)**

```
Same character as reference: Math Adventure mascot "Pi", young male middle-school adventurer,
messy dark brown hair, big brown eyes, cheerful smile,
white t-shirt with colorful + - × ÷ symbols, open light-blue hoodie with gold star pin,
teal explorer backpack with Pythagorean theorem scroll a²+b²=c², √x tag, ? pouch,
golden compass staff with glowing blue crystal and floating numbers,
lavender flowing sash with π and = symbols, blue shorts, chunky sneakers,
casual mobile RPG art style, soft cel-shading, bright pastel, transparent background
```

**활용 장면 예**

- 환영 / 미션 시작 / 클리어 축하 / 힌트 제공 / 로딩·대기

---

### 4.2 초원 — 중1 가이드

| 항목 | 내용 |
|------|------|
| 파일 | `grade-1-v2.png` |
| ID | `chorwon` / `grade1` |
| 학년 | 중1 · 칭호 **초원의 탐험가** |
| 배지 | 새싹 배지 |
| 성별/나이감 | 남 / 중1 또래 |
| 성격 | 호기심 많고 씩씩함. 기초를 즐겁게 밟아가는 타입 |

**외형 고정 요소**

- 갈색 스파이크 머리, **초록 눈**, 밝은 미소
- 민트 후드 튜닉 + 민트 망토 + 금색 목 버클
- 청록 반바지, 갈색 벨트·주머니
- 민트/화이트 통굽 부츠
- **수정 검** (하늘색 날) + **숫자 `1` 모양 방패** (금테, 민트 퀼팅, 작은 왕관)
- 발밑 작은 풀밭·꽃, 주변에 `+` 스파클·구름

**레퍼런스 프롬프트**

```
Same character as reference: grade-1 Math Adventure hero "Chorwon",
young male adventurer, spiky brown hair, large green eyes, confident smile,
mint-green hooded tunic and cape with gold clasps, teal shorts, brown leather belt pouch,
chunky mint-and-white boots, crystal-blue sword, large gold-rimmed shield shaped like number 1,
soft grassy patch, pastel sparkles, casual RPG style, transparent background
```

---

### 4.3 언덕 — 중2 가이드

| 항목 | 내용 |
|------|------|
| 파일 | `grade-2-v2.png` |
| ID | `eondeok` / `grade2` |
| 학년 | 중2 · 칭호 **언덕의 모험가** |
| 배지 | 불꽃 배지 |
| 성별/나이감 | 여 / 중2 또래 |
| 성격 | 명랑하고 똑똑함. 도구로 직접 실험해 보는 타입 |

**외형 고정 요소**

- 어깨~턱선 웨이브 갈색 머리 + **피치색 리본/머리띠**
- 큰 갈색 눈, 환한 미소
- 피치색 후드 망토(흰 기하학 무늬 가장자리) + 크림 상의 + 피치 반바지
- 갈색 벨트, 보라 허리 띠, 보라 별이 빛나는 가죽 가방
- 피치 부츠 + 보라 끈 + 별 장식
- **수학 두루마리**(도형·수식) + **반투명 보라 각도기**
- 주변에 와이어프레임 정육면체, 삼각형, `2+3=5` 같은 떠다니는 수식

**레퍼런스 프롬프트**

```
Same character as reference: grade-2 Math Adventure hero "Eondeok",
young female adventurer, wavy chin-length brown hair with peach bow headband,
large brown eyes, cheerful smile, peach hooded cloak with white geometric trim,
cream shirt, peach shorts, brown belt, purple sash, leather satchel with glowing purple star,
chunky peach boots with purple laces, holding oversized math scroll and translucent purple protractor,
floating cube triangle equations, casual RPG pastel style, transparent background
```

---

### 4.4 별빛 — 중3 가이드

| 항목 | 내용 |
|------|------|
| 파일 | `grade-3-v2.png` |
| ID | `byeolbit` / `grade3` |
| 학년 | 중3 · 칭호 **별빛의 용사** |
| 배지 | 별빛 배지 |
| 성별/나이감 | 여 / 중3 또래 |
| 성격 | 차분하고 자신감 있음. 보스 미션을 이끄는 타입 |

**외형 고정 요소**

- 밤색 웨이브 머리 **하이 포니테일** + **큰 보라 리본**
- **보라색 눈**, 자신감 있는 미소
- 라벤더 후드 튜닉/재킷 + 크림 긴소매 + 금테 + **가슴 금색 별 브로치**
- 라벤더 망토(안감 금색·별 무늬)
- 진보라 레깅스/바지, 라벤더 부츠(크림 커프·금 별)
- 갈색 가죽 벨트·사첼·작은 **별 표지 공책**
- 손 위에 **떠 있는 빛나는 보라 수정** + 별 스파클

**레퍼런스 프롬프트**

```
Same character as reference: grade-3 Math Adventure hero "Byeolbit",
young female mage adventurer, wavy chestnut ponytail with large purple bow,
large purple eyes, confident smile, lavender hooded tunic with cream sleeves and gold star brooch,
lavender cape with gold lining and stars, dark purple pants, lavender boots with cream cuffs,
brown leather belt satchel and small star-emblem journal,
floating glowing jagged purple crystal above her palm, star sparkles,
casual RPG pastel style, transparent background
```

---

## 5. 새 그림 그릴 때 워크플로

1. **이 문서**에서 해당 캐릭터 시트를 연다.
2. `public/images/`의 **해당 PNG를 레퍼런스 이미지로 첨부**한다. (가장 중요)
3. 프롬프트에 `Same character as reference` + **고정 요소 목록** + **공통 스타일 키워드**를 넣는다.
4. 장면에 맞는 **포즈/표정만** 바꾼다. 옷·소품·헤어·팔레트는 유지.
5. 결과물이 투명 배경인지 확인한다. 체커보드가 보이면 배경 제거 후 저장.
6. 새 파일은 아래에 맞춰 저장하고, 이 문서 **§7 에셋 목록**에 한 줄 추가한다.

### 포즈/표정 변형 예시 (캐릭터는 동일)

| 용도 | 지시 예 |
|------|---------|
| 대기/로비 | standing idle, friendly wave |
| 미션 시작 | pointing forward excitedly |
| 성공 | thumbs up, sparkles, victory pose |
| 실패/재도전 | gentle encouraging smile, offering hand |
| 설명/튜토리얼 | holding chalkboard or glowing formula card |
| 인게임 아바타 | bust portrait / half-body, simple pose |
| 사이드뷰 러너 | side-view running sprite sheet style (같은 옷·머리) |

### 장면 프롬프트 템플릿

```
[공통 스타일 키워드]

Same character as reference: [캐릭터 영문 이름 + 고정 요소 2~4개]

Action/pose: [포즈]
Expression: [표정]
Framing: [full body | half body | bust]
Background: true transparent PNG (or soft pastel scene if needed)
Do not change costume, hair, eye color, or signature props.
```

---

## 6. 프로그램별 사용 원칙

| 콘텐츠 | 추천 캐릭터 |
|--------|-------------|
| 홈 / 공통 안내 | 파이 |
| 중1 시뮬레이션·게임 | 초원 (+ 필요시 파이 조연) |
| 중2 시뮬레이션·게임 | 언덕 (+ 필요시 파이 조연) |
| 중3 시뮬레이션·게임 | 별빛 (+ 필요시 파이 조연) |
| 학년 선택 UI | 각 학년 전용 캐릭터 |
| 배지/레벨업 연출 | 해당 학년 캐릭터 + 파이 |

- 새 조연 NPC를 만들 때도 **같은 스타일·같은 파스텔 RPG 규칙**을 따른다.
- 학년 테마 색(민트/피치/라벤더)을 UI·이펙트·아이템에 맞춘다.

---

## 7. 에셋 목록 (갱신 유지)

| 파일 | 캐릭터 | 용도 | 비고 |
|------|--------|------|------|
| `public/images/mascot-v2.png` | 파이 | 메인 마스코트 전신 | 투명 PNG |
| `public/images/grade-1-v2.png` | 초원 | 중1 전신 | 투명 PNG |
| `public/images/grade-2-v2.png` | 언덕 | 중2 전신 | 투명 PNG |
| `public/images/grade-3-v2.png` | 별빛 | 중3 전신 | 투명 PNG |
| `public/images/hero-banner.png` | (배경) | 홈 탐험 배너 | 풍경 일러스트 |

코드에서 경로 참조: [`lib/grades.ts`](../lib/grades.ts), [`components/HeroBanner.tsx`](../components/HeroBanner.tsx), [`components/TopMenuBar.tsx`](../components/TopMenuBar.tsx)

---

## 8. Cursor / AI에게 요청할 때 복붙용

```
docs/character-style-guide.md 와 public/images/ 의 레퍼런스 PNG를 보고,
[파이|초원|언덕|별빛] 캐릭터를 일관된 스타일로 [용도/포즈] 이미지를 만들어줘.
옷·머리·눈색·시그니처 소품은 바꾸지 말고, 투명 PNG로 저장해줘.
```

---

## 9. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-13 | 초판: 파이·초원·언덕·별빛 시트, 팔레트, 프롬프트, 워크플로 정리 |
