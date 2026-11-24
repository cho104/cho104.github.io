// After `vite build`: copy media the README references, and give every route its own
// index.html so deep links work on GitHub Pages (which has no SPA fallback).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseReadme } from '../src/content/parse.js';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const data = parseReadme(readFileSync(join(root, 'README.md'), 'utf8'), { exists: (p) => existsSync(join(root, p)) });

let missing = 0;
for (const file of data.mediaFiles) {
  const from = join(root, file);
  if (!existsSync(from)) {
    console.warn(`  ! README references ${file}, but the file does not exist`);
    missing++;
    continue;
  }
  mkdirSync(dirname(join(dist, file)), { recursive: true });
  copyFileSync(from, join(dist, file));
}
if (existsSync(join(root, 'resume.pdf'))) copyFileSync(join(root, 'resume.pdf'), join(dist, 'resume.pdf'));

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const routes = ['works', 'about', 'coursework', 'resume', 'contact', 'readme', ...data.projects.map((p) => `works/${p.slug}`)];
for (const r of routes) {
  mkdirSync(join(dist, r), { recursive: true });
  writeFileSync(join(dist, r, 'index.html'), html);
}
writeFileSync(join(dist, '404.html'), html);
writeFileSync(join(dist, '.nojekyll'), '');
console.log(`postbuild: ${data.mediaFiles.length - missing} media files, ${routes.length} routes`);
