// Web versions of the photos: img/_originals/<path> → img/<path>
//   <name>.jpg        max 1800px, for project cards, the resume page and README
//   <name>.thumb.jpg  max 640px, for 3D textures (wall photos, ring panels) and previews
// Metadata (EXIF, including GPS location) is stripped; orientation is applied first.
// Originals stay local: img/_originals is git-ignored.
//
// Usage: npm run images         (only converts files that changed)
//        npm run images -- --all
import sharp from 'sharp';
import { readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'img/_originals');
const out = join(root, 'img');
const all = process.argv.includes('--all');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.name.startsWith('.') ? [] : d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  );
}

let made = 0;
for (const file of walk(src)) {
  const ext = extname(file).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp', '.heic'].includes(ext)) continue;
  const rel = relative(src, file);
  if (rel.startsWith('reference/')) continue; // modelling references, never published
  const isPng = ext === '.png';
  const base = join(out, rel.slice(0, -ext.length));
  const full = base + (isPng ? '.png' : '.jpg');
  const thumb = base + '.thumb.jpg';
  if (!all && existsSync(full) && existsSync(thumb) && statSync(full).mtimeMs > statSync(file).mtimeMs) continue;
  mkdirSync(dirname(full), { recursive: true });
  const img = () => sharp(file, { failOn: 'none' }).rotate();
  const big = img().resize(1800, 1800, { fit: 'inside', withoutEnlargement: true });
  await (isPng ? big.png({ compressionLevel: 9, palette: true }) : big.jpeg({ quality: 78, mozjpeg: true })).toFile(full);
  await img().resize(640, 640, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 76, mozjpeg: true }).toFile(thumb);
  made++;
}
console.log(`images: ${made} converted`);
