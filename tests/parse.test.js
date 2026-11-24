import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseReadme } from '../src/content/parse.js';

const sample = `me@uni.ac.kr |
+82 10 1234 5678 |
[https://github.com/someone](https://github.com/someone)

### About
Hello, I build things.

![desk](img/about/desk.jpg)

### Education (relevant courses)
#### **Some High School**, Town (Class of '24)
1. Algebra
2. (Current) Databases

### Projects & Leaderships
1. **First Project** (Some Lab)
Did a thing.
![cover](img/first/cover.jpg)
tags: PyTorch, NLP · 2025

2. **Second Project** (Club)
Did another thing.

![loose image after blank line](img/second/demo.mp4)

### Honors
1. **A Prize**, Nationwide (2022)
`;

test('contact is email + GitHub only, phone scrubbed everywhere', () => {
  const d = parseReadme(sample);
  assert.equal(d.contact.email, 'me@uni.ac.kr');
  assert.equal(d.contact.githubUrl, 'https://github.com/someone');
  assert.doesNotMatch(JSON.stringify(d), /1234|5678|\+82/);
});

test('about: bio paragraphs and photos', () => {
  const d = parseReadme(sample);
  assert.deepEqual(d.about.bio, ['Hello, I build things.']);
  assert.deepEqual(d.about.photos.map((p) => p.src), ['img/about/desk.jpg']);
});

test('education: schools, courses, current flag', () => {
  const d = parseReadme(sample);
  assert.equal(d.education[0].name, 'Some High School');
  assert.deepEqual(d.education[0].courses, [
    { name: 'Algebra', current: false },
    { name: 'Databases', current: true },
  ]);
});

test('projects: org, description, media, tags, year', () => {
  const d = parseReadme(sample);
  const [a, b] = d.projects;
  assert.equal(a.title, 'First Project');
  assert.equal(a.org, 'Some Lab');
  assert.equal(a.description, 'Did a thing.');
  assert.deepEqual(a.tags, ['PyTorch', 'NLP']);
  assert.equal(a.year, '2025');
  assert.equal(a.media[0].kind, 'image');
  // an unindented image after a blank line still belongs to the previous project
  assert.equal(b.media[0].src, 'img/second/demo.mp4');
  assert.equal(b.media[0].kind, 'video');
});

test('honors keep their meta and year', () => {
  const d = parseReadme(sample);
  assert.equal(d.honors[0].title, 'A Prize');
  assert.equal(d.honors[0].year, '2022');
});

test('the real README parses and never leaks the phone number', () => {
  const d = parseReadme(readFileSync(new URL('../README.md', import.meta.url), 'utf8'));
  assert.ok(d.projects.length >= 10);
  assert.ok(d.education.length >= 2);
  assert.doesNotMatch(JSON.stringify(d), /4411|\+82/);
});

test('<img> tags count as media, with thumbnails when they exist', () => {
  const md = `### About
Hi.

<img src="img/about/a.jpg" width="160"> <img src="img/about/b.jpg" alt="B" width="160">

### Projects
1. **P** (Org)
Text here.
<img src="img/projects/p/01.jpg" width="160">
`;
  const d = parseReadme(md, { exists: (p) => p === 'img/about/a.thumb.jpg' });
  assert.deepEqual(d.about.bio, ['Hi.']);
  assert.deepEqual(d.about.photos.map((p) => [p.src, p.thumb]), [
    ['img/about/a.jpg', 'img/about/a.thumb.jpg'],
    ['img/about/b.jpg', 'img/about/b.jpg'],
  ]);
  assert.equal(d.projects[0].description, 'Text here.');
  assert.equal(d.projects[0].media[0].src, 'img/projects/p/01.jpg');
  assert.ok(d.mediaFiles.includes('img/about/a.thumb.jpg'));
  assert.match(d.readmeHtml, /<img class="thumb" src="\/img\/about\/a\.thumb\.jpg"/);
});

test('links and documents come out of the description', () => {
  const d = parseReadme(`### Projects
1. **Linked** (Lab)
Built it.
<img src="img/x/a.jpg" width="160"> https://github.com/me/repo [Slides: Talk](img/x/talk.pdf)
https://www.isca-archive.org/x/paper.pdf
`, { exists: (p) => p === 'img/x/talk.pdf.thumb.jpg' });
  const [p] = d.projects;
  assert.equal(p.description, 'Built it.');
  assert.deepEqual(p.links.map((l) => l.label), ['GitHub · repo', 'Paper (PDF)']);
  assert.deepEqual(p.docs, [{ src: 'img/x/talk.pdf', label: 'Slides: Talk', kind: 'pdf', thumb: 'img/x/talk.pdf.thumb.jpg' }]);
  assert.ok(d.mediaFiles.includes('img/x/talk.pdf') && d.mediaFiles.includes('img/x/talk.pdf.thumb.jpg'));
});
