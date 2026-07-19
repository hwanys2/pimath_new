#!/usr/bin/env node
/**
 * Flag PNGs with baked-in black backgrounds or checkerboard "fake transparency".
 * Usage: node scripts/check-png-alpha.mjs [paths...]
 * Exit 1 if any flagged files when --strict is passed.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");

function listDefaults() {
  const dirs = [
    path.join(ROOT, "public/images"),
    path.join(ROOT, "public/images/cosmetics"),
  ];
  const out = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".png")) continue;
      // Keep original grade/mascot out of auto-regen list unless flagged
      out.push(path.join(dir, name));
    }
  }
  return out;
}

async function analyze(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const n = width * height;

  let opaque = 0;
  let nearBlackOpaque = 0;
  let cornerOpaque = 0;
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  for (const [x, y] of corners) {
    const i = (y * width + x) * channels;
    if (data[i + 3] > 200) cornerOpaque++;
  }

  // Sample edge strip for checker / black fill
  let grayBins = new Map();
  let edgeOpaque = 0;
  let edgeSamples = 0;
  const sampleEdge = (x, y) => {
    const i = (y * width + x) * channels;
    const a = data[i + 3];
    edgeSamples++;
    if (a > 200) {
      edgeOpaque++;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r < 30 && g < 30 && b < 30) nearBlackOpaque++;
      if (Math.abs(r - g) < 12 && Math.abs(g - b) < 12) {
        const bin = Math.round(r / 32) * 32;
        grayBins.set(bin, (grayBins.get(bin) || 0) + 1);
      }
    }
  };

  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 80))) {
    sampleEdge(x, 0);
    sampleEdge(x, height - 1);
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 80))) {
    sampleEdge(0, y);
    sampleEdge(width - 1, y);
  }

  for (let i = 0; i < n; i++) {
    const a = data[i * channels + 3];
    if (a > 250) {
      opaque++;
      const r = data[i * channels];
      const g = data[i * channels + 1];
      const b = data[i * channels + 2];
      if (r < 25 && g < 25 && b < 25) nearBlackOpaque++;
    }
  }

  const blackPct = (nearBlackOpaque / n) * 100;
  const opaquePct = (opaque / n) * 100;
  const edgeOpaquePct = edgeSamples ? (edgeOpaque / edgeSamples) * 100 : 0;
  const distinctGrays = [...grayBins.values()].filter((c) => c > 8).length;
  const checkerSuspect =
    edgeOpaquePct > 60 && distinctGrays >= 2 && grayBins.size >= 2;

  const reasons = [];
  if (cornerOpaque >= 3) reasons.push("opaque_corners");
  if (blackPct > 8) reasons.push(`black_fill_${blackPct.toFixed(1)}%`);
  if (checkerSuspect) reasons.push("checkerboard");
  // Fully opaque image with dark/light uniform edge often means solid bg
  if (opaquePct > 92 && edgeOpaquePct > 90) reasons.push("fully_opaque_bg");

  return {
    file: path.relative(ROOT, file),
    width,
    height,
    opaquePct: +opaquePct.toFixed(1),
    blackPct: +blackPct.toFixed(1),
    cornerOpaque,
    edgeOpaquePct: +edgeOpaquePct.toFixed(1),
    checkerSuspect,
    bad: reasons.length > 0,
    reasons,
  };
}

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const paths = args.filter((a) => !a.startsWith("--"));
const files = paths.length ? paths.map((p) => path.resolve(p)) : listDefaults();

const results = [];
for (const f of files) {
  try {
    results.push(await analyze(f));
  } catch (e) {
    results.push({
      file: path.relative(ROOT, f),
      bad: true,
      reasons: [`error:${e.message}`],
    });
  }
}

const bad = results.filter((r) => r.bad);
console.log(JSON.stringify({ total: results.length, bad: bad.length, badFiles: bad }, null, 2));

if (strict && bad.length) process.exit(1);
