/**
 * Turns assets/icon/icon.svg into the icon formats each platform wants:
 *   assets/icon/AppIcon.icns  macOS app bundle
 *   assets/icon/icon.ico      Windows executable
 *   assets/icon/icon-512.png  Linux desktop entry
 *
 * Uses only what ships with macOS (sips, iconutil). Run it from the repo root via
 * `bun run icons`; the outputs are committed so releases can be built without it.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");
const ICON_DIR = join(ROOT, "assets", "icon");
const SVG = join(ICON_DIR, "icon.svg");

async function run(cmd: string[]): Promise<void> {
  const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "pipe" });
  const stderr = await new Response(proc.stderr).text();
  if ((await proc.exited) !== 0) throw new Error(`${cmd[0]} failed: ${stderr.trim()}`);
}

/** Rasterise the SVG at one size. */
async function png(size: number, out: string): Promise<string> {
  await run(["sips", "-s", "format", "png", "-Z", String(size), SVG, "--out", out]);
  return out;
}

/**
 * Assemble a .ico containing PNG images. Windows Vista and later read PNG-in-ICO,
 * which avoids having to encode legacy BMP with an AND mask.
 */
function buildIco(entries: { size: number; data: Uint8Array }[]): Uint8Array {
  const HEADER = 6;
  const ENTRY = 16;
  const totalSize =
    HEADER + ENTRY * entries.length + entries.reduce((n, e) => n + e.data.length, 0);
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // 1 = icon
  view.setUint16(4, entries.length, true);

  let offset = HEADER + ENTRY * entries.length;
  entries.forEach((entry, i) => {
    const at = HEADER + i * ENTRY;
    out[at] = entry.size >= 256 ? 0 : entry.size; // 0 means 256
    out[at + 1] = entry.size >= 256 ? 0 : entry.size;
    out[at + 2] = 0; // palette size
    out[at + 3] = 0; // reserved
    view.setUint16(at + 4, 1, true); // colour planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, entry.data.length, true);
    view.setUint32(at + 12, offset, true);
    out.set(entry.data, offset);
    offset += entry.data.length;
  });

  return out;
}

const scratch = join(ICON_DIR, ".scratch");
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });

// --- macOS .icns -----------------------------------------------------------
const iconset = join(scratch, "AppIcon.iconset");
mkdirSync(iconset, { recursive: true });
for (const base of [16, 32, 128, 256, 512]) {
  await png(base, join(iconset, `icon_${base}x${base}.png`));
  await png(base * 2, join(iconset, `icon_${base}x${base}@2x.png`));
}
await run(["iconutil", "-c", "icns", iconset, "-o", join(ICON_DIR, "AppIcon.icns")]);

// --- Windows .ico ----------------------------------------------------------
const icoEntries: { size: number; data: Uint8Array }[] = [];
for (const size of [16, 32, 48, 64, 128, 256]) {
  const file = await png(size, join(scratch, `ico-${size}.png`));
  icoEntries.push({ size, data: new Uint8Array(readFileSync(file)) });
}
writeFileSync(join(ICON_DIR, "icon.ico"), buildIco(icoEntries));

// --- Linux PNG -------------------------------------------------------------
await png(512, join(ICON_DIR, "icon-512.png"));

rmSync(scratch, { recursive: true, force: true });
console.log("[icons] wrote AppIcon.icns, icon.ico and icon-512.png to assets/icon/");
