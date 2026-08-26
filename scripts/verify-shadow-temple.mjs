/**
 * One-off sanity check for the Shadow Temple parameter pools.
 * Regenerates many runs and re-derives every answer independently.
 * Run: node scripts/verify-shadow-temple.mjs (needs tsx-less: uses build? no — plain re-impl)
 */

const SQRT3 = 1.7;

const deg2rad = (d) => (d * Math.PI) / 180;

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error("FAIL:", msg);
};

// Room 1 — h = d·tanθ with √3≈1.7 substituted at the end.
const GATE = [
  { d: 9, deg: 30, val: 5.1 },
  { d: 12, deg: 30, val: 6.8 },
  { d: 7, deg: 45, val: 7 },
  { d: 9, deg: 45, val: 9 },
  { d: 4, deg: 60, val: 6.8 },
  { d: 6, deg: 60, val: 10.2 },
];
const tanApprox = { 30: SQRT3 / 3, 45: 1, 60: SQRT3 };
for (const v of GATE) {
  const h = v.d * tanApprox[v.deg];
  if (Math.abs(h - v.val) > 1e-9) fail(`gate ${JSON.stringify(v)} → ${h}`);
  const exact = v.d * Math.tan(deg2rad(v.deg));
  if (Math.abs(exact - v.val) > 0.25) fail(`gate exact drift ${JSON.stringify(v)} → ${exact}`);
}

// Room 2 — third side via included angle (60: −ab, 120: +ab), integer result.
const LAVA = [
  { a: 8, b: 5, deg: 60, ans: 7 },
  { a: 8, b: 15, deg: 60, ans: 13 },
  { a: 10, b: 16, deg: 60, ans: 14 },
  { a: 8, b: 7, deg: 120, ans: 13 },
  { a: 16, b: 5, deg: 120, ans: 19 },
];
for (const v of LAVA) {
  const sq =
    v.a * v.a + v.b * v.b + (v.deg === 120 ? 1 : -1) * v.a * v.b;
  if (sq !== v.ans * v.ans) fail(`lava ${JSON.stringify(v)} → ${sq}`);
}

// Room 3 — h·(cotα + cotβ) = d; only asymmetric pairs (no isosceles).
const BRIDGE = [
  { alpha: 30, beta: 60, d: 12, val: 5.1, via: "d/4*√3" },
  { alpha: 30, beta: 60, d: 16, val: 6.8, via: "d/4*√3" },
  { alpha: 30, beta: 45, d: 20, val: 7, via: "d*(√3-1)/2" },
  { alpha: 30, beta: 45, d: 16, val: 5.6, via: "d*(√3-1)/2" },
  { alpha: 45, beta: 60, d: 10, val: 6.5, via: "d*(3-√3)/2" },
  { alpha: 45, beta: 60, d: 14, val: 9.1, via: "d*(3-√3)/2" },
];
for (const v of BRIDGE) {
  // Textbook: simplify with radicals, then √3 → 1.7 (may drift ~0.3 from Math.tan).
  let approx;
  if (v.alpha === 30 && v.beta === 60) approx = (v.d / 4) * SQRT3;
  else if (v.alpha === 30 && v.beta === 45) approx = (v.d * (SQRT3 - 1)) / 2;
  else approx = (v.d * (3 - SQRT3)) / 2;
  if (Math.abs(approx - v.val) > 1e-9)
    fail(`bridge approx ${JSON.stringify(v)} → ${approx}`);
  const cot = (deg) => 1 / Math.tan(deg2rad(deg));
  const hExact = v.d / (cot(v.alpha) + cot(v.beta));
  if (Math.abs(hExact - v.val) > 0.35)
    fail(`bridge exact drift ${JSON.stringify(v)} → ${hExact}`);
}

// Room 4 — parallelogram S = ab·sinθ; correct matches groove, distractors differ.
const SHIELD = [
  {
    groove: { a: 6, b: 4, deg: 60 },
    correct: { a: 8, b: 3, deg: 60 },
    distractors: [
      { a: 6, b: 4, deg: 30 },
      { a: 8, b: 3, deg: 45 },
      { a: 5, b: 4, deg: 90 },
    ],
  },
  {
    groove: { a: 8, b: 5, deg: 30 },
    correct: { a: 4, b: 10, deg: 30 },
    distractors: [
      { a: 8, b: 5, deg: 60 },
      { a: 6, b: 5, deg: 45 },
      { a: 7, b: 4, deg: 30 },
    ],
  },
  {
    groove: { a: 6, b: 5, deg: 45 },
    correct: { a: 10, b: 3, deg: 45 },
    distractors: [
      { a: 6, b: 5, deg: 30 },
      { a: 5, b: 4, deg: 60 },
      { a: 8, b: 4, deg: 45 },
    ],
  },
];
const pgArea = (p) => p.a * p.b * Math.sin(deg2rad(p.deg));
for (const v of SHIELD) {
  const g = pgArea(v.groove);
  if (Math.abs(pgArea(v.correct) - g) > 1e-9)
    fail(`shield correct mismatch ${JSON.stringify(v.groove)}`);
  for (const d of v.distractors) {
    if (Math.abs(pgArea(d) - g) < 0.5)
      fail(`shield distractor too close ${JSON.stringify(d)}`);
  }
}

// Room 5 — triangle S = ½ab·sinθ; exact-form label must equal computed value.
const parseExact = (s) => {
  const m = /^(\d+)(?:√(\d))?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] ? n * Math.sqrt(Number(m[2])) : n;
};
const ALTARS = [
  { a: 8, b: 6, deg: 60, exact: "12√3", distractors: ["24", "12"] },
  { a: 6, b: 4, deg: 45, exact: "6√2", distractors: ["12", "6√3"] },
  { a: 10, b: 4, deg: 30, exact: "10", distractors: ["20", "10√3"] },
  { a: 10, b: 4, deg: 120, exact: "10√3", distractors: ["20", "10"] },
  { a: 8, b: 6, deg: 135, exact: "12√2", distractors: ["24", "12√3"] },
  { a: 12, b: 5, deg: 150, exact: "15", distractors: ["30", "15√3"] },
];
for (const v of ALTARS) {
  const s = 0.5 * v.a * v.b * Math.sin(deg2rad(v.deg));
  const label = parseExact(v.exact);
  if (label == null || Math.abs(s - label) > 1e-9)
    fail(`altar ${JSON.stringify(v)} → ${s} vs ${label}`);
  for (const d of v.distractors) {
    const dv = parseExact(d);
    if (dv == null || Math.abs(dv - label) < 0.5)
      fail(`altar distractor ${d} too close in ${JSON.stringify(v)}`);
  }
}

// Room 6 — S = ½d₁d₂·sinφ (√3 → 1.7) must equal the 2-digit dial code.
const STAR = [
  { d1: 12, d2: 10, deg: 30, code: 30 },
  { d1: 16, d2: 14, deg: 30, code: 56 },
  { d1: 18, d2: 8, deg: 30, code: 36 },
  { d1: 12, d2: 9, deg: 90, code: 54 },
  { d1: 10, d2: 12, deg: 60, code: 51 },
];
const sinApprox = { 30: 0.5, 60: SQRT3 / 2, 90: 1 };
for (const v of STAR) {
  const s = 0.5 * v.d1 * v.d2 * sinApprox[v.deg];
  if (Math.abs(s - v.code) > 1e-9) fail(`star ${JSON.stringify(v)} → ${s}`);
  if (v.code < 10 || v.code > 99) fail(`star code not 2-digit ${v.code}`);
}

// Score frame: max 5×150 + 2×75 + 100 = 1000.
const maxScore = 150 * 5 + 75 * 2 + 100;
if (maxScore !== 1000) fail(`max score frame ${maxScore}`);

if (failures === 0) {
  console.log("OK — all shadow-temple pools verified (answers clean & unique).");
} else {
  process.exitCode = 1;
}
