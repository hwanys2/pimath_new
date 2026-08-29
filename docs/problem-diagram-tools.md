# 문제 그림 그리기

> 시험·학습지용 **소재별 그림 생성기**. GeoGebra·알지오매스 같은 범용 작도 프로그램이 아니다.  
> 코드 단일 출처: [`lib/diagrams/catalog.ts`](../lib/diagrams/catalog.ts)  
> 허브: `/tools/figures` · 개별 도구: `/tools/figures/{toolId}`

이후 **문제 그림 도구를 추가하거나 손볼 때**는 이 문서를 먼저 읽고, 첫 도구인 **원의 현** (`g3-circle-chords`)을 참고 구현으로 삼는다.

---

## 1. 한 줄 요약

한 카드 = 한 소재. 그 소재의 시험 그림을 **그림 위에서 바로 고쳐 PNG로** 뽑게 만든다.

교사가 점·수선·설명선을 범용 작도 순서로 만들지 않는다. 이미 그 유형에 맞춰 점만 끌면 나머지가 따라오게 한다.

---

## 2. 왜 범용 작도기가 아닌가

한국 중등 수학 교사가 시험 그림을 그릴 때 쓰는 대표 도구는 **알지오매스(AlgeoMath)**, **지오지브라(GeoGebra)**, 예전 **가나모그래프**, 한글/파워포인트 그리기 개체다.

공통 불만은 같다.

- 현 하나, 수선 하나, 길이 `x cm` 하나를 넣으려 해도 작도 순서가 길다.
- 설명선(길이 표시 호), 직각 표시, 세리프 수식 폰트를 맞추는 데 시간이 더 든다.
- 원하는 건 “원의 현 문제 그림”이지, 기하 소프트웨어 전체가 아니다.

그래서 이 제품의 도구는 **소재를 나눈 생성기**다.

| 범용 작도기 | 이 도구 |
|-------------|---------|
| 점·선·원·수선을 직접 작도 | 그 소재의 점만 끌면 수선·직각·설명선이 따라옴 |
| 설명선·직각·라벨을 따로 꾸미기 | 고른 대상의 표시 칩 + 그림 위 글자 수정 |
| 학습 곡선이 있음 | 프리셋 → 그림에서 고치기 → PNG |

알지오매스 꾸미기(설명선 `E`, LaTeX 세리프, 직각 네모)와 교과서 그림의 **결과물 스타일**은 따르되, 조작은 훨씬 좁고 얕게 둔다.

---

## 3. 정보 구조

```
도구 (/tools) 
  └─ 문제 그림 그리기 (/tools/figures)
        ├─ 중1 카드들
        ├─ 중2 카드들
        └─ 중3 카드들
              └─ 원의 현 → /tools/figures/g3-circle-chords
```

- 학년 id는 콘텐츠와 같다: `1 | 2 | 3` ([`lib/grades.ts`](../lib/grades.ts)).
- 도구 id는 **불변 슬러그**. 권장: `g{학년}-{slug}`  
  예) `g3-circle-chords`, `g3-circle-tangents`, `g2-similar-triangles`
- 허브·navbar 등록은 카탈로그만 수정하면 된다. 콘텐츠 시스템(`lib/contents.ts`)·XP·학급 배정과는 **무관**하다. 수업 도구다.

새 도구를 만들 때 파일 위치:

```
lib/diagrams/catalog.ts                    ← 메타 등록 (필수)
lib/diagrams/<toolId>/                     ← 상태, 프리셋, 장면(scene)
components/tools/figures/<id>/             ← 편집 UI (스튜디오만)
app/tools/figures/[toolId]/page.tsx        ← renderDiagramStudio() 분기만 추가
components/tools/figures/DiagramToolShell.tsx  ← 공통 뼈대. 손대지 않음
```

개별 도구 페이지 파일(`app/tools/figures/g3-tangents/page.tsx` 같은 것)을 **만들지 않는다.** 라우트는 `[toolId]` 하나다.

페이지 구성은 항상 같다. 새 도구를 넣어도 **의견은 자동으로** 붙는다.

```
/tools/figures/{toolId}
  └─ DiagramToolShell          ← 공통. 도구마다 복사하지 않음
        ├─ 스튜디오 (도구별)   ← 여기만 새로 작성
        └─ DiagramFeedback     ← 공통 의견. tool_id로 구분
```

---

## 4. 시험 그림 시각 규칙

모든 도구가 이 규칙을 기본값으로 따른다. 스타일 슬라이더로 미세 조정은 허용하되, 기본값이 시험지처럼 보여야 한다.

1. **흰 배경, 검은 선.** 장식 색·그라데이션·이모지는 그림 안에 넣지 않는다.
2. **선은 가늘고 일정.** 기본 굵기는 인쇄해도 무너지지 않을 정도만.
3. **수식 세리프.** 점 이름·변수는 이탤릭 세리프, 숫자와 단위(`cm`)·한글은 직립.  
   (`16 cm`, `$x$ cm`, `$O$`, `$AB$` 가 교과서와 같아야 한다.)
4. **길이 표시는 설명선.** 선분 옆에 점선 호(또는 짧은 괄호 곡선) + 그 가운데 라벨.  
   알지오매스 “꾸미기: 설명선”과 같은 역할이다. 숫자만 선 위에 덩그러니 두지 않는다.
5. **직각은 작은 네모.** 호나 점 세 개로 직각을 대체하지 않는다.
6. **중심·꼭짓점은 작은 채운 점** + 바깥쪽 라벨. 라벨이 선과 겹치면 드래그로 옮길 수 있게 한다.
7. **비율.** 기본은 입력한 길이가 그림과 맞게. 드래그로 모양을 잡을 때는 대략이어도 된다. 보이는 숫자를 고치면 그때 그림을 다시 맞춘다.
8. **내보내기.** 1순위는 **PNG**(한글·워드·슬라이드에 붙이기). SVG는 있으면 좋다. 화면 미리보기와 다운로드 파일이 같은 장면이어야 한다.

---

## 5. 편집 UI 원칙 (직관성)

새 도구 UI는 원의 현과 **같은 뼈대**를 쓴다.

1. **그림은 시험 크기.** 캔버스는 문제지에 들어갈 정도로 작게, 조작은 오른쪽 컬럼에 둔다.
2. **값은 그림에서 고친다.** 보이는 숫자·점 이름을 누르면 바로 수정한다. 숫자를 넣으면 그림도 맞춰 바뀐다. `x`를 넣으면 미지수로 표시한다.
3. **끝점은 길이 고정.** 원 위 점을 끌면 반대쪽이 원을 따라간다. 현 가운데를 밀 때만 거리가 바뀐다.
4. **표시는 고른 현의 칩.** 수선, 직각, OA/OB, 중점 등. 현 목록에서 바로 지운다.
5. **스타일은 접어 둔다.** 선 굵기, 여백, 저장 배율. 글자 크기는 오른쪽에서 바로 키울 수 있게 둔다.
6. **저장이 항상 보인다.** PNG 다운로드, 이미지 복사. 파일 이름은 한글 소재명.
7. **프리셋은 시작점.** “같은 길이의 두 현”처럼 자주 나오는 그림부터 고른 뒤, 그림 위에서 고쳐 나간다.

---

## 6. 새 도구 추가 체크리스트

1. [`lib/diagrams/catalog.ts`](../lib/diagrams/catalog.ts)에 `DiagramToolMeta`를 추가한다. `status: "ready"` 전에는 허브에 준비 중 카드로만 둔다.
2. `lib/diagrams/<toolId>/`에 상태 타입, 프리셋(실제 시험 유형 2~4개), `buildScene()`을 둔다.
3. 장면은 캔버스/SVG가 같이 쓸 수 있는 명령 목록으로 만든다. 미리보기와 PNG가 어긋나면 안 된다.
4. `components/tools/figures/<toolId>/`에 스튜디오 UI. 그림이 주 편집면. 프리셋·표시 칩 → (접힌) 스타일 → 저장.
5. [`app/tools/figures/[toolId]/page.tsx`](../app/tools/figures/[toolId]/page.tsx)의 `renderDiagramStudio()`에 `case`만 추가한다. 라우트를 새로 만들지 않는다. 페이지는 반드시 [`DiagramToolShell`](../components/tools/figures/DiagramToolShell.tsx)로 감싼다 — 스튜디오만 `return`하면 의견이 빠진다.
6. 기본 프리셋으로 PNG를 저장해 보고, 라벨 겹침·직각 위치·단위 이탤릭 여부를 확인한다.
7. 이 문서 §8 도구 목록에 한 줄 추가한다. 의견용 마이그레이션·컴포넌트·RPC는 **추가하지 않는다.** 같은 `pm_diagram_feedback`이 `tool_id`로 갈린다.

하지 말 것:

- 범용 기하 캔버스(자유 작도, 도구 팔레트 10개 이상)를 이 허브에 넣지 않는다.
- `lib/contents.ts`에 넣거나 XP를 주지 않는다.
- 기존 콘텐츠 단원 페이지를 이 도구의 진입점으로 바꾸지 않는다. 진입은 `/tools/figures`다.
- 도구별 `page.tsx`를 새로 만들거나, 스튜디오 안에 `DiagramFeedback`를 복사하지 않는다.
- 도구마다 의견 테이블/알림 RPC를 새로 만들지 않는다.

---

## 7. 참고 구현: 원의 현 (`g3-circle-chords`)

중3 `3.2 원의 성질`에서 나오는 전형적인 그림.

- 원, 중심 `$O$`, 현, 중심에서 현에 내린 수선, 직각, 반지름, 설명선 길이.
- 성질: 수선이 현을 이등분, 같은 거리 ↔ 같은 길이, \( r^2 = d^2 + (\ell/2)^2 \).
- **조작:** 원 둘레를 끌어 현을 그린다. 끝점 드래그는 길이 고정·원 위 회전. 끝점을 더블클릭하거나 중심까지 끌면 OA/OB를 잇는다. 설명선은 끌어서 높이만 바꾸고 끝점을 넘기지 않는다. 글자를 누르면 이름/숫자를 고친다. Delete·목록의 지우기로 현을 지운다.
- 수선·직각·OA/OB 등은 오른쪽 패널 칩. 그림은 작게, 패널은 오른쪽 컬럼.
- 프리셋이 곧 문제 유형의 시작점이다.

이후 접선, 원주각, 닮음 삼각형 등을 넣을 때도 **같은 카탈로그·같은 스타일 규칙·같은 라벨 모드·같은 `DiagramToolShell`(하단 의견)** 을 재사용한다.

---

## 8. 도구 목록

| id | 학년 | 제목 | 상태 |
|----|------|------|------|
| `g3-circle-chords` | 중3 | 원의 현 | ready |

---

## 9. 의견 (모든 도구 페이지 공통)

단일 출처. 별도 `diagram-feedback.md`를 만들지 않는다. DB 객체 목록은 [`docs/supabase-pm-conventions.md`](supabase-pm-conventions.md)에도 한 줄로 적혀 있고, 제품 규칙은 여기가 맞다.

**새 도구를 추가할 때 의견 UI·테이블·알림을 다시 만들지 않는다.** 카탈로그 id가 곧 `tool_id`다. [`DiagramToolShell`](../components/tools/figures/DiagramToolShell.tsx)이 스튜디오 아래에 [`DiagramFeedback`](../components/tools/figures/DiagramFeedback.tsx)를 붙인다.

| 규칙 | 내용 |
|------|------|
| 열람 | 로그인 없이 공개 |
| 작성 | 교사 로그인. 미로그인 시 `/login/teacher?next=/tools/figures/{toolId}#feedback` |
| 삭제 | 작성자는 본인 댓글, 관리자(`hwanys2@naver.com`)는 모든 댓글 |
| 관리자 | `hwanys2@naver.com`만 반영완료(`applied`) / 반려(`rejected`) + 선택 사유(`admin_note`) |
| 저장 | `pm_diagram_feedback.tool_id` = 카탈로그 `id` (예: `g3-circle-chords`) |
| RPC | `pm_list_diagram_feedback` · `pm_create_diagram_feedback` · `pm_resolve_diagram_feedback` · `pm_delete_diagram_feedback` |
| 알림 | 새 댓글만 기존 `create_notification`으로 관리자 foreducator 알림 (벨·텔레그램·웹푸시). URL `https://www.pimath.kr/tools/figures/{toolId}#feedback` |
| 본인 댓글 | `create_notification`이 자기 알림을 막음 |

손대지 말 것: `create_notification` 정의, `common_notification` 스키마, 레거시 `pimath_comment`.

구현 파일:

- 뼈대: [`components/tools/figures/DiagramToolShell.tsx`](../components/tools/figures/DiagramToolShell.tsx)
- UI: [`components/tools/figures/DiagramFeedback.tsx`](../components/tools/figures/DiagramFeedback.tsx)
- 액션: [`app/tools/figures/actions.ts`](../app/tools/figures/actions.ts)
- 마이그레이션: `supabase/migrations/20260829040000_pm_diagram_feedback.sql`, `20260829050000_pm_delete_diagram_feedback.sql`

---

## 10. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-08-27 | 초판. 허브 + 원의 현 첫 도구. 범용 작도기가 아닌 소재별 생성기 지침. |
| 2026-08-27 | 원의 현: 작은 캔버스 + 오른쪽 패널, 끝점 길이 고정, 설명선 높이 드래그, 현 삭제. |
| 2026-08-29 | 도구 페이지 하단 의견 스레드. 관리자 반영완료/반려. 새 댓글은 foreducator 알림. |
| 2026-08-29 | 의견 삭제: 작성자 본인, 관리자는 전체. |
| 2026-08-29 | 공통 `DiagramToolShell`로 고정. 새 도구는 스튜디오 분기만 추가하면 의견이 붙음. |
