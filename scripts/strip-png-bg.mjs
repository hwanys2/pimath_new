#!/usr/bin/env node
/**
 * Strip solid/checker backgrounds from Pi stage + cosmetic PNGs.
 * Writes in place (after backup to public/images/.bak/).
 */
import fs from "node:fs";
import path from "node:path";
import { removeBackground } from "@imgly/background-removal-node";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const BAK = path.join(ROOT, "public/images/.bak");

function collectTargets() {
  const files = [];
  const roots = [
    path.join(ROOT, "public/images"),
    path.join(ROOT, "public/images/cosmetics"),
  ];
  for (const dir of roots) {
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".png")) continue;
      // Skip known-good originals and non-progression art
      if (name === "mascot-v2.png") continue;
      if (name.startsWith("grade-")) continue;
      if (name === "hero-banner.png") continue;
      if (name.startsWith("pi-") || dir.endsWith("cosmetics")) {
        files.push(path.join(dir, name));
      }
    }
  }
  return files;
}

async function processOne(file) {
  const rel = path.relative(ROOT, file);
  const bakPath = path.join(BAK, rel.replace(/^public\/images\//, ""));
  fs.mkdirSync(path.dirname(bakPath), { recursive: true });
  if (!fs.existsSync(bakPath)) fs.copyFileSync(file, bakPath);

  const input = fs.readFileSync(file);
  const blob = new Blob([input], { type: "image/png" });
  const result = await removeBackground(blob, {
    output: { format: "image/png", quality: 1 },
  });
  const buf = Buffer.from(await result.arrayBuffer());

  // Normalize: trim + ensure alpha, max dimension for web
  const meta = await sharp(buf).metadata();
  const maxSide = Math.max(meta.width || 1, meta.height || 1);
  const scale = maxSide > 1024 ? 1024 / maxSide : 1;
  await sharp(buf)
    .resize(
      Math.round((meta.width || 1) * scale),
      Math.round((meta.height || 1) * scale),
      { fit: "inside" },
    )
    .ensureAlpha()
    .png()
    .toFile(file);

  return rel;
}

const targets = collectTargets();
console.log(`Processing ${targets.length} files…`);
let ok = 0;
let fail = 0;
for (const f of targets) {
  try {
    const rel = await processOne(f);
    console.log("OK", rel);
    ok++;
  } catch (e) {
    console.error("FAIL", path.relative(ROOT, f), e.message);
    fail++;
  }
}
console.log(JSON.stringify({ ok, fail, total: targets.length }));
