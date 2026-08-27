/**
 * Audit every Shadow Temple diagram variant:
 *  - drawn angle vs labeled angle
 *  - measure-label bounding-box overlap
 *  - labels off-canvas
 */
const W = 400;
const H = 260;

const polar = (cx, cy, r, deg) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const labelBox = (x, y, text, size = 10) => {
  const w = String(text).length * size * 0.62 + 10;
  const h = size + 6;
  const t = y - size + 1;
  return { l: x - w / 2, r: x + w / 2, t, b: t + h, text, x, y };
};

const boxesOverlap = (a, b, pad = 3) =>
  !(a.r + pad < b.l || b.r + pad < a.l || a.b + pad < b.t || b.b + pad < a.t);

const smallerAngle = (v, p1, p2) => {
  const a1 = Math.atan2(p1.y - v.y, p1.x - v.x);
  const a2 = Math.atan2(p2.y - v.y, p2.x - v.x);
  let d = Math.abs(a1 - a2) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
};

const signedDelta = (fromDeg, toDeg) => {
  // Match arcPath: sweep = to>from ? 1 : 0, large = |to-from|>180
  const raw = toDeg - fromDeg;
  const large = Math.abs(raw) > 180;
  const sweepPos = toDeg > fromDeg;
  // Positive-angle (clockwise in y-down polar) span of the actual SVG arc:
  let span;
  if (sweepPos) {
    span = raw;
    if (span < 0) span += 360;
    if (!large && span > 180) span = 360 - span; // shouldn't happen
    if (large && span < 180) span = 360 - (360 - span);
  } else {
    span = -raw;
    if (span < 0) span += 360;
  }
  // Simpler: the arc that arcPath draws has angular measure:
  const abs = Math.abs(toDeg - fromDeg);
  const minor = abs > 180 ? 360 - abs : abs;
  const major = 360 - minor;
  const useLarge = abs > 180;
  return useLarge ? major : minor;
};

const offCanvas = (box) => box.l < 4 || box.t < 4 || box.r > W - 4 || box.b > H - 4;

const sideLabelAway = (p, q, centroid, dist) => {
  const mx = (p.x + q.x) / 2;
  const my = (p.y + q.y) / 2;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (nx * (centroid.x - mx) + ny * (centroid.y - my) > 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: mx + nx * dist, y: my + ny * dist };
};

const altarBaseLabel = (vertex, far, baseY, extraDown = 0) => {
  const span = far.x - vertex.x;
  const nudge = Math.sign(span) * Math.min(16, Math.abs(span) * 0.2);
  return {
    x: (vertex.x + far.x) / 2 + nudge,
    y: baseY + 22 + extraDown,
  };
};

const altarOnWood = (lenA, lenB, includedDeg, region) => {
  const rad = (includedDeg * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const maxW = region.right - region.left;
  const tryOrient = (along, rising, labelAlong, labelRising) => {
    const tipX = rising * cos;
    const span = Math.max(along, tipX) - Math.min(0, tipX);
    const rawH = rising * sin;
    const s = Math.min(maxW / (span + 0.01), region.maxH / (rawH + 0.01), 13.5);
    return {
      along,
      rising,
      labelAlong,
      labelRising,
      s,
      height: rawH * s,
      span: span * s,
      tipX: tipX * s,
    };
  };
  const c1 = tryOrient(lenA, lenB, lenA, lenB);
  const c2 = tryOrient(lenB, lenA, lenB, lenA);
  const best = c1.height >= c2.height ? c1 : c2;
  const minLocalX = Math.min(0, best.tipX);
  const V = {
    x: region.left - minLocalX + (maxW - best.span) / 2,
    y: region.baseY,
  };
  const A = { x: V.x + best.along * best.s, y: V.y };
  const B = polar(V.x, V.y, best.rising * best.s, -includedDeg);
  return { V, A, B, s: best.s, labelAlong: best.labelAlong, labelRising: best.labelRising, along: best.along, rising: best.rising };
};

let issues = [];
const issue = (room, variant, kind, detail) => {
  issues.push({ room, variant, kind, detail });
};

const reportLabels = (room, variant, labels, angleErrs = []) => {
  for (const e of angleErrs) {
    if (Math.abs(e.got - e.want) > 1.2) {
      issue(room, variant, "angle", `${e.name}: drawn ${e.got.toFixed(1)}° vs label ${e.want}° (arc ${e.arc?.toFixed?.(1) ?? "—"})`);
    }
  }
  for (let i = 0; i < labels.length; i++) {
    if (offCanvas(labels[i])) {
      issue(room, variant, "clip", `"${labels[i].text}" off-canvas ${JSON.stringify({ l: +labels[i].l.toFixed(1), r: +labels[i].r.toFixed(1), t: +labels[i].t.toFixed(1), b: +labels[i].b.toFixed(1) })}`);
    }
    for (let j = i + 1; j < labels.length; j++) {
      if (boxesOverlap(labels[i], labels[j])) {
        issue(
          room,
          variant,
          "overlap",
          `"${labels[i].text}" ∩ "${labels[j].text}"`,
        );
      }
    }
  }
};

/* ---------------- Gate ---------------- */
const GATE = [
  { d: 9, deg: 30 },
  { d: 12, deg: 30 },
  { d: 7, deg: 45 },
  { d: 9, deg: 45 },
  { d: 4, deg: 60 },
  { d: 6, deg: 60 },
];
for (const v of GATE) {
  const base = { x: 292, y: 224 };
  const foreheadY = 56;
  const oppPreferred = base.y - foreheadY;
  const adjPreferred = oppPreferred / Math.tan((v.deg * Math.PI) / 180);
  const obsX = Math.max(40, base.x - adjPreferred);
  const adj = base.x - obsX;
  const opp = adj * Math.tan((v.deg * Math.PI) / 180);
  const obs = { x: obsX, y: base.y };
  const key = { x: base.x, y: base.y - opp };
  const dirToKey = -v.deg;
  const midFloorX = (obs.x + base.x) / 2;
  const drawn = smallerAngle(obs, { x: obs.x + 40, y: obs.y }, key);
  const arc = signedDelta(dirToKey, 0);
  const labels = [
    labelBox(obs.x + 44, obs.y - 15, `${v.deg}°`, 10),
    labelBox(midFloorX, base.y + 16, `${v.d} m`, 10),
  ];
  reportLabels("gate", `d=${v.d} θ=${v.deg}`, labels, [
    { name: "elevation", got: drawn, want: v.deg, arc },
  ]);
}

/* ---------------- Lava ---------------- */
const LAVA = [
  { a: 8, b: 5, deg: 60 },
  { a: 8, b: 15, deg: 60 },
  { a: 10, b: 16, deg: 60 },
  { a: 8, b: 7, deg: 120 },
  { a: 16, b: 5, deg: 120 },
];
for (const v of LAVA) {
  const ab = Math.sqrt(Math.max(0, v.a * v.a + v.b * v.b - 2 * v.a * v.b * Math.cos((v.deg * Math.PI) / 180)));
  const fit = 210 / Math.max(ab, v.a, v.b);
  const A = { x: 200 - (ab * fit) / 2, y: 78 };
  const B = { x: 200 + (ab * fit) / 2, y: 78 };
  const ra = v.a * fit;
  const rb = v.b * fit;
  const bx = ab * fit;
  const px = (ra * ra - rb * rb + bx * bx) / (2 * bx);
  const py = Math.sqrt(Math.max(0, ra * ra - px * px));
  const P = { x: A.x + px, y: A.y + py };
  const midA = { x: (P.x + A.x) / 2, y: (P.y + A.y) / 2 };
  const midB = { x: (P.x + B.x) / 2, y: (P.y + B.y) / 2 };
  const dirPA = (Math.atan2(A.y - P.y, A.x - P.x) * 180) / Math.PI;
  const dirPB = (Math.atan2(B.y - P.y, B.x - P.x) * 180) / Math.PI;
  const drawn = smallerAngle(P, A, B);
  const arc = signedDelta(dirPA, dirPB);
  const labels = [
    labelBox(P.x, P.y - 28, `${v.deg}°`, 10),
    labelBox(midA.x - 18, midA.y, `${v.a} m`, 10),
    labelBox(midB.x + 18, midB.y, `${v.b} m`, 10),
  ];
  reportLabels("lava", `a=${v.a} b=${v.b} θ=${v.deg}`, labels, [
    { name: "∠APB", got: drawn, want: v.deg, arc },
  ]);
}

/* ---------------- Bridge ---------------- */
const BRIDGE = [
  { alpha: 30, beta: 60, d: 12 },
  { alpha: 30, beta: 60, d: 16 },
  { alpha: 30, beta: 45, d: 20 },
  { alpha: 30, beta: 45, d: 16 },
  { alpha: 45, beta: 60, d: 10 },
  { alpha: 45, beta: 60, d: 14 },
];
for (const v of BRIDGE) {
  const y0 = 196;
  const ta = Math.tan((v.alpha * Math.PI) / 180);
  const tb = Math.tan((v.beta * Math.PI) / 180);
  const af = 1 / ta;
  const fb = 1 / tb;
  const total = af + fb;
  const scale = Math.min(250 / total, 118);
  const A = { x: 200 - (total * scale) / 2, y: y0 };
  const B = { x: 200 + (total * scale) / 2, y: y0 };
  const C = { x: A.x + af * scale, y: y0 - scale };
  const dirAC = (Math.atan2(C.y - A.y, C.x - A.x) * 180) / Math.PI;
  const dirBC = (Math.atan2(C.y - B.y, C.x - B.x) * 180) / Math.PI;
  const horizRight = { x: A.x + 40, y: A.y };
  const horizLeft = { x: B.x - 40, y: B.y };
  const drawnA = smallerAngle(A, horizRight, C);
  const drawnB = smallerAngle(B, horizLeft, C);
  const arcA = signedDelta(dirAC, 0);
  const arcB = signedDelta(dirBC, -180);
  const labels = [
    labelBox(A.x + 34, A.y - 12, `${v.alpha}°`, 10),
    labelBox(B.x - 34, B.y - 12, `${v.beta}°`, 10),
    labelBox((A.x + B.x) / 2, y0 + 18, `AB = ${v.d} m`, 10),
  ];
  reportLabels("bridge", `α=${v.alpha} β=${v.beta} d=${v.d}`, labels, [
    { name: "α at A", got: drawnA, want: v.alpha, arc: arcA },
    { name: "β at B", got: drawnB, want: v.beta, arc: arcB },
  ]);
}

/* ---------------- Shield ---------------- */
const SHIELD = [
  { a: 6, b: 4, deg: 60 },
  { a: 8, b: 5, deg: 30 },
  { a: 6, b: 5, deg: 45 },
];
for (const v of SHIELD) {
  const rad = (v.deg * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const natW = v.a + v.b * Math.abs(cos);
  const natH = Math.max(0.2, v.b * sin);
  const scale = Math.min(240 / natW, 78 / natH);
  const ax = v.a * scale;
  const bx = v.b * scale * cos;
  const by = -v.b * scale * sin;
  const cx = 210;
  const cy = 136;
  const V = { x: cx - (ax + bx) / 2, y: cy - by / 2 };
  const pA = { x: V.x + ax, y: V.y };
  const pB = { x: V.x + bx, y: V.y + by };
  const sideB = Math.hypot(bx, by);
  const arcR = Math.min(22, ax * 0.24, sideB * 0.3);
  const midA = { x: (V.x + pA.x) / 2, y: (V.y + pA.y) / 2 + 22 };
  const midB = { x: (V.x + pB.x) / 2 - 26, y: (V.y + pB.y) / 2 };
  const angleLabel = polar(V.x, V.y, arcR + (v.deg <= 30 ? 36 : 22), -v.deg / 2);
  const drawn = smallerAngle(V, pA, pB);
  const arc = signedDelta(-v.deg, 0);
  const labels = [
    labelBox(midA.x, midA.y, `${v.a}`, 12),
    labelBox(midB.x, midB.y, `${v.b}`, 12),
    labelBox(angleLabel.x, angleLabel.y, `${v.deg}°`, 11),
  ];
  reportLabels("shield", `a=${v.a} b=${v.b} θ=${v.deg}`, labels, [
    { name: "included ∠", got: drawn, want: v.deg, arc },
  ]);
}

/* ---------------- Altar ---------------- */
const ALTAR_ACUTE = [
  { a: 8, b: 6, deg: 60 },
  { a: 6, b: 4, deg: 45 },
  { a: 10, b: 4, deg: 30 },
];
const ALTAR_OBTUSE = [
  { a: 10, b: 4, deg: 120 },
  { a: 8, b: 6, deg: 135 },
  { a: 12, b: 5, deg: 150 },
];
const baseY = 168;
for (const v of ALTAR_ACUTE) {
  const acute = altarOnWood(v.a, v.b, v.deg, { left: 28, right: 188, baseY, maxH: 92 });
  const acuteArcR = Math.min(20, acute.along * acute.s * 0.2, acute.rising * acute.s * 0.26);
  const acuteAngleLabel = polar(acute.V.x, acute.V.y, acuteArcR + 20, -v.deg / 2);
  const acuteCentroid = {
    x: (acute.V.x + acute.A.x + acute.B.x) / 3,
    y: (acute.V.y + acute.A.y + acute.B.y) / 3,
  };
  const acuteMidA = altarBaseLabel(acute.V, acute.A, baseY);
  const acuteMidB = sideLabelAway(acute.V, acute.B, acuteCentroid, 24);
  const drawn = smallerAngle(acute.V, acute.A, acute.B);
  const arc = signedDelta(-v.deg, 0);
  const labels = [
    labelBox(acuteAngleLabel.x, acuteAngleLabel.y, `${v.deg}°`, 11),
    labelBox(acuteMidB.x, acuteMidB.y, `${acute.labelRising}`, 12),
    labelBox(acuteMidA.x, acuteMidA.y, `${acute.labelAlong}`, 12),
  ];
  reportLabels("altar-acute", `a=${v.a} b=${v.b} θ=${v.deg}`, labels, [
    { name: "included ∠", got: drawn, want: v.deg, arc },
  ]);
}
for (const v of ALTAR_OBTUSE) {
  const obtuse = altarOnWood(v.a, v.b, v.deg, { left: 208, right: 378, baseY, maxH: 86 });
  const obtuseArcR = Math.min(18, obtuse.along * obtuse.s * 0.18, obtuse.rising * obtuse.s * 0.24);
  const obtuseAngleLabel = polar(obtuse.V.x, obtuse.V.y, obtuseArcR + 28, -Math.min(80, v.deg / 2 + 14));
  const obtuseCentroid = {
    x: (obtuse.V.x + obtuse.A.x + obtuse.B.x) / 3,
    y: (obtuse.V.y + obtuse.A.y + obtuse.B.y) / 3,
  };
  const obtuseMidA = altarBaseLabel(obtuse.V, obtuse.A, baseY, 12);
  const obtuseMidB = sideLabelAway(obtuse.V, obtuse.B, obtuseCentroid, 24);
  const drawn = smallerAngle(obtuse.V, obtuse.A, obtuse.B);
  const arc = signedDelta(-v.deg, 0);
  const labels = [
    labelBox(obtuseAngleLabel.x, obtuseAngleLabel.y, `${v.deg}°`, 11),
    labelBox(obtuseMidB.x, obtuseMidB.y, `${obtuse.labelRising}`, 12),
    labelBox(obtuseMidA.x, obtuseMidA.y, `${obtuse.labelAlong}`, 12),
  ];
  reportLabels("altar-obtuse", `a=${v.a} b=${v.b} θ=${v.deg}`, labels, [
    { name: "included ∠", got: drawn, want: v.deg, arc },
  ]);
}

/* ---------------- Star ---------------- */
const STAR = [
  { d1: 12, d2: 10, deg: 30 },
  { d1: 16, d2: 14, deg: 30 },
  { d1: 18, d2: 8, deg: 30 },
  { d1: 12, d2: 9, deg: 90 },
  { d1: 10, d2: 12, deg: 60 },
];
for (const v of STAR) {
  const box = { l: 78, r: 322, t: 118, b: 208 };
  const boxW = box.r - box.l;
  const boxH = box.b - box.t;
  const dir1 = 18;
  const u1 = v.d1 / 2;
  const u2 = v.d2 / 2;
  const raw = {
    a: polar(0, 0, u1, dir1),
    c: polar(0, 0, u1, dir1 + 180),
    d: polar(0, 0, u2, dir1 + v.deg),
    b: polar(0, 0, u2, dir1 + v.deg + 180),
  };
  const rawXs = [raw.a.x, raw.b.x, raw.c.x, raw.d.x];
  const rawYs = [raw.a.y, raw.b.y, raw.c.y, raw.d.y];
  const rawW = Math.max(...rawXs) - Math.min(...rawXs);
  const rawH = Math.max(...rawYs) - Math.min(...rawYs);
  const scale = Math.min((boxW - 36) / rawW, (boxH - 28) / rawH);
  const cx = (box.l + box.r) / 2;
  const cy = (box.t + box.b) / 2;
  const midRawX = (Math.min(...rawXs) + Math.max(...rawXs)) / 2;
  const midRawY = (Math.min(...rawYs) + Math.max(...rawYs)) / 2;
  const map = (p) => ({ x: cx + (p.x - midRawX) * scale, y: cy + (p.y - midRawY) * scale });
  const Q = { a: map(raw.a), b: map(raw.b), c: map(raw.c), d: map(raw.d) };
  const X = map({ x: 0, y: 0 });
  const outwardFrom = (vertex, origin, dist) => {
    const dx = vertex.x - origin.x;
    const dy = vertex.y - origin.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: vertex.x + (dx / len) * dist, y: vertex.y + (dy / len) * dist };
  };
  const arcR = Math.min(24, 0.28 * Math.min(v.d1, v.d2) * scale);
  const d1Text = `d₁ = ${v.d1} m`;
  const d2Text = `d₂ = ${v.d2} m`;
  const angText = `${v.deg}°`;
  let best = null;
  for (const flip of [false, true]) {
    const angFrom = dir1 + (flip ? 180 : 0);
    const ang = polar(X.x, X.y, arcR + 26, angFrom + v.deg / 2);
    const angBox = labelBox(ang.x, ang.y, angText, 11);
    for (const dist of [16, 22, 30, 38]) {
      const d1Opts = [outwardFrom(Q.a, X, dist), outwardFrom(Q.c, X, dist)];
      const d2Opts = [outwardFrom(Q.b, X, dist), outwardFrom(Q.d, X, dist)];
      for (const p1 of d1Opts) {
        for (const p2 of d2Opts) {
          const b1 = labelBox(p1.x, p1.y, d1Text, 11);
          const b2 = labelBox(p2.x, p2.y, d2Text, 11);
          const clipped = [b1, b2, angBox].filter(
            (box) => box.l < 8 || box.r > 392 || box.t < 100 || box.b > 250,
          ).length;
          const collided =
            boxesOverlap(b1, b2, 4) ||
            boxesOverlap(b1, angBox, 4) ||
            boxesOverlap(b2, angBox, 4);
          const minGap = Math.min(
            Math.hypot(p1.x - p2.x, p1.y - p2.y),
            Math.hypot(p1.x - ang.x, p1.y - ang.y),
            Math.hypot(p2.x - ang.x, p2.y - ang.y),
          );
          const score = minGap - clipped * 90 - (collided ? 400 : 0);
          if (!best || score > best.score) best = { d1: p1, d2: p2, ang, angFrom, score, collided };
        }
      }
    }
  }
  const drawn = smallerAngle(X, Q.a, Q.d);
  const arc = signedDelta(best.angFrom, best.angFrom + v.deg);
  const labels = [
    labelBox(best.d1.x, best.d1.y, d1Text, 11),
    labelBox(best.d2.x, best.d2.y, d2Text, 11),
    labelBox(best.ang.x, best.ang.y, angText, 11),
  ];
  reportLabels("star", `d1=${v.d1} d2=${v.d2} φ=${v.deg}`, labels, [
    { name: "φ at X", got: drawn, want: v.deg, arc },
  ]);
}

const byKind = {};
for (const i of issues) {
  byKind[i.kind] ??= 0;
  byKind[i.kind] += 1;
  console.log(`[${i.kind}] ${i.room} ${i.variant} — ${i.detail}`);
}
console.log("\n---");
console.log(`issues: ${issues.length}`, byKind);
if (issues.length === 0) console.log("all variants clean");
