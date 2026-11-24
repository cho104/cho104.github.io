import sharp from 'sharp';
import { readdirSync, statSync, mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, extname } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'img/_originals');
const out = join(root, 'img');
const all = process.argv.includes('--all');
if (!existsSync(src)) {
  console.log('images: no img/_originals folder here (originals stay local), nothing to convert');
  process.exit(0);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.name.startsWith('.') ? [] : d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  );
}

let made = 0;
for (const file of walk(src)) {
  const ext = extname(file).toLowerCase();
  const rel = relative(src, file);
  if (ext === '.pdf' && !/^(reference|wallpaper|room|private|unused)\//.test(rel)) {
    const to = join(out, rel), thumb = to + '.thumb.jpg';
    if (!all && existsSync(to) && existsSync(thumb) && statSync(to).mtimeMs > statSync(file).mtimeMs) continue;
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(file, to);
    try {
      const page = join(tmpdir(), `page1-${process.pid}.png`);
      execFileSync('sips', ['-s', 'format', 'png', '-Z', '1600', file, '--out', page], { stdio: 'ignore' });
      await sharp(page).flatten({ background: '#ffffff' }).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(thumb);
      rmSync(page, { force: true });
    } catch {
      console.warn(`  ! no preview for ${rel} (needs macOS sips)`);
    }
    made++;
    continue;
  }
  if (!['.jpg', '.jpeg', '.png', '.webp', '.heic'].includes(ext)) continue;
  if (/^(reference|wallpaper|room|private|unused)\//.test(rel)) continue;
  const isPng = ext === '.png';
  const base = join(out, rel.slice(0, -ext.length));
  const full = base + (isPng ? '.png' : '.jpg');
  const thumb = base + '.thumb.jpg';
  if (!all && existsSync(full) && existsSync(thumb) && statSync(full).mtimeMs > statSync(file).mtimeMs) continue;
  mkdirSync(dirname(full), { recursive: true });
  let input = file, tmp = '';
  if (ext === '.heic') {
    tmp = join(tmpdir(), `heic-${process.pid}.jpg`);
    try {
      execFileSync('sips', ['-s', 'format', 'jpeg', file, '--out', tmp], { stdio: 'ignore' });
      input = tmp;
    } catch {
      console.warn(`  ! skipped ${rel} (HEIC needs macOS sips)`);
      continue;
    }
  }
  const img = () => sharp(input, { failOn: 'none' }).rotate();
  const big = img().resize(1800, 1800, { fit: 'inside', withoutEnlargement: true });
  await (isPng ? big.png({ compressionLevel: 9, palette: true }) : big.jpeg({ quality: 78, mozjpeg: true })).toFile(full);
  await img().resize(640, 640, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 76, mozjpeg: true }).toFile(thumb);
  if (tmp) rmSync(tmp, { force: true });
  made++;
}
console.log(`images: ${made} converted`);
