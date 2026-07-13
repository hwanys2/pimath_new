# 수학하는 즐거움 (Math Adventure)

중학교 수학을 시뮬레이션·게임으로 탐험하는 모험형 학습 사이트입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 열어주세요.

## 페이지

- `/` — 랜딩 (탐험 배너 + 학년별 퀘스트 카드)
- `/grade/1` — 중1
- `/grade/2` — 중2
- `/grade/3` — 중3

## 기술 스택

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- Google Fonts (Jua, Noto Sans KR)

## 캐릭터 / 아트 가이드

시뮬레이션·게임용 이미지를 그릴 때 캐릭터를 일관되게 유지하려면 아래 문서를 참고하세요.

- [docs/character-style-guide.md](docs/character-style-guide.md) — 캐릭터 시트, 팔레트, 프롬프트, 에셋 목록
- 레퍼런스 PNG: `public/images/mascot-v2.png`, `grade-1-v2.png`, `grade-2-v2.png`, `grade-3-v2.png`
