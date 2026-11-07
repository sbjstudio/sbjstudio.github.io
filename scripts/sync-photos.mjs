#!/usr/bin/env node
/**
 * Scans ./shotbyjulian and writes ./photos.json.
 * Newest photographs first. Every image dropped in the folder is picked up.
 *
 *   node scripts/sync-photos.mjs
 *   node scripts/sync-photos.mjs --from "C:/Users/julia/shotbyjulian"   (import + scan)
 *   node scripts/sync-photos.mjs --quiet
 */
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHOTOS_DIR = path.join(ROOT, 'shotbyjulian');
const MANIFEST = path.join(ROOT, 'photos.json');
const CAPTIONS = path.join(PHOTOS_DIR, 'captions.json');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);

const quiet = process.argv.includes('--quiet');
const fromIndex = process.argv.indexOf('--from');
const fromDir = fromIndex !== -1 ? process.argv[fromIndex + 1] : null;
const log = (...args) => { if (!quiet) console.log(...args); };

/* ---------- image metadata ---------- */

function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

function exifOrientation(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return 1;
  let i = 2;
  while (i < buf.length - 12) {
    if (buf[i] !== 0xff) return 1;
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xe1 && buf.toString('latin1', i + 4, i + 10) === 'Exif\0\0') {
      const tiff = i + 10;
      const order = buf.toString('latin1', tiff, tiff + 2);
      if (order !== 'II' && order !== 'MM') return 1;
      const le = order === 'II';
      const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
      const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
      const ifd = tiff + u32(tiff + 4);
      if (ifd + 2 > buf.length) return 1;
      const count = u16(ifd);
      for (let k = 0; k < count; k += 1) {
        const entry = ifd + 2 + k * 12;
        if (entry + 12 > buf.length) return 1;
        if (u16(entry) === 0x0112) return u16(entry + 8);
      }
      return 1;
    }
    i += 2 + len;
  }
  return 1;
}

function pngSize(buf) {
  if (buf.toString('latin1', 1, 4) !== 'PNG') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function webpSize(buf) {
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return null;
  const kind = buf.toString('latin1', 12, 16);
  if (kind === 'VP8X') {
    return {
      width: 1 + buf.readUIntLE(24, 3),
      height: 1 + buf.readUIntLE(27, 3),
    };
  }
  if (kind === 'VP8 ') {
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }
  if (kind === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  return null;
}

async function imageMeta(file) {
  const buf = await readFile(file);
  let size = jpegSize(buf) || pngSize(buf) || webpSize(buf);

  if (size && jpegSize(buf)) {
    const orientation = exifOrientation(buf);
    if (orientation >= 5 && orientation <= 8) {
      size = { width: size.height, height: size.width };
    }
  }
  return size || { width: 0, height: 0 };
}

/* ---------- import ---------- */

async function importFrom(source) {
  const src = path.resolve(source);
  if (!existsSync(src)) {
    log(`! Folder not found: ${src}`);
    return;
  }
  await mkdir(PHOTOS_DIR, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  let copied = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) continue;
    const target = path.join(PHOTOS_DIR, entry.name);
    if (existsSync(target)) continue;
    await copyFile(path.join(src, entry.name), target);
    copied += 1;
  }
  if (copied) log(`+ imported ${copied} image(s) from ${src}`);
}

/* ---------- main ---------- */

async function main() {
  if (fromDir) await importFrom(fromDir);
  await mkdir(PHOTOS_DIR, { recursive: true });

  let captions = {};
  if (existsSync(CAPTIONS)) {
    try {
      const parsed = JSON.parse(await readFile(CAPTIONS, 'utf8'));
      if (parsed && typeof parsed === 'object') captions = parsed;
    } catch (err) {
      log(`! captions.json could not be read: ${err.message}`);
    }
  }

  const entries = await readdir(PHOTOS_DIR, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && IMAGE_EXT.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name);

  const photos = [];
  for (const name of files) {
    const full = path.join(PHOTOS_DIR, name);
    const info = await stat(full);
    const meta = await imageMeta(full);
    photos.push({
      file: name,
      src: `shotbyjulian/${encodeURIComponent(name)}`,
      width: meta.width,
      height: meta.height,
      bytes: info.size,
      mtime: info.mtimeMs,
      caption: typeof captions[name] === 'string' ? captions[name] : '',
    });
  }

  const collator = new Intl.Collator('sv', { numeric: true, sensitivity: 'base' });
  photos.sort((a, b) => {
    if (Math.abs(a.mtime - b.mtime) > 2000) return b.mtime - a.mtime;
    return collator.compare(b.file, a.file);
  });

  const payload = {
    count: photos.length,
    photos: photos.map(({ mtime, ...rest }) => rest),
  };

  await writeFile(MANIFEST, `${JSON.stringify(payload, null, 2)}\n`);
  const size = photos.reduce((sum, p) => sum + p.bytes, 0);
  log(`✓ ${photos.length} photograph(s) → photos.json (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch((err) => {
  console.error('sync-photos failed:', err);
  process.exit(1);
});
