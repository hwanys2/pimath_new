# @hwanys2/pm-board

Shared electronic whiteboard for **pimath** and **foreducator.com**.

## Install (foreducator / CI)

`.npmrc`:

```
@hwanys2:registry=https://npm.pkg.github.com
```

```bash
npm install @hwanys2/pm-board
```

Set `NODE_AUTH_TOKEN` (GitHub PAT with `read:packages`) on Vercel.

## Usage

```tsx
import "@hwanys2/pm-board/styles/pm-board.css";
import { BoardApp } from "@hwanys2/pm-board";

<BoardApp
  brand={{ title: "foreducator - 전자칠판", homeHref: "https://foreducator.com" }}
  storageKey="fe-board-v1"
  apiBase=""
  rosters={rosters}
  isTeacher
/>
```

Server routes should call `handleRecognizeMath` / `handleSolveMath` from `@hwanys2/pm-board/server`.

## Publish (maintainers)

From repo root after version bump in `packages/pm-board/package.json`:

```bash
npm publish -w packages/pm-board
```

Requires `NODE_AUTH_TOKEN` with `write:packages`.
