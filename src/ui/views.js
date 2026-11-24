// DOM for each route. All text comes from README.md (via virtual:content).
import { gsap } from 'gsap';
import { handLink, drawIn } from './hand.js';

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const asset = (src) => '/' + src.replace(/^\.?\//, '');
// Outside links and attached documents of a project or honor.
const linkList = (p, cls = 'links', withDocs = true) =>
  p.links?.length || (withDocs && p.docs?.length)
    ? `<div class="${cls}">${[
        ...(withDocs ? p.docs || [] : []).map((d) => `<a href="${asset(d.src)}" target="_blank" rel="noopener">${esc(d.label)}</a>`),
        ...(p.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`),
      ].join('')}</div>`
    : '';
// Documents in a card: first-page previews that open the file.
const docTiles = (p) =>
  (p.docs || [])
    .map(
      (d) => `<a class="doc" href="${asset(d.src)}" target="_blank" rel="noopener">
        ${d.thumb ? `<img src="${asset(d.thumb)}" alt="" loading="lazy">` : `<span class="doc-blank">${d.kind.toUpperCase()}</span>`}
        <span class="doc-label">${esc(d.label)} <i>${d.kind === 'pdf' ? 'PDF' : 'report'} ↗</i></span></a>`,
    )
    .join('');

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function homeView() {
  return el(`<div></div>`);
}

// Works: Featured (3D ring) or Index (Jesper's "Full": names in a paragraph, hover preview).
export function worksView(content, { mode, onMode }) {
  const root = el(`<div>
    <div class="works-toggle" role="group" aria-label="Works view">
      <button type="button" data-m="featured" aria-pressed="${mode === 'featured'}">Featured</button><span>/</span>
      <button type="button" data-m="index" aria-pressed="${mode === 'index'}">Index</button>
    </div>
    ${mode === 'featured' ? '<p class="works-caption" aria-live="polite"></p>' : ''}
  </div>`);
  root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => onMode(b.dataset.m)));

  if (mode === 'index') {
    const idx = el(`<div class="index fade-in"><p>${content.projects
      .map((p, i) => `<a href="/works/${p.slug}" data-link data-i="${i}" aria-label="${esc(p.title)}">${letters(p.title)}</a>`)
      .join(' <span class="dot ch" aria-hidden="true">·</span> ')}</p><div class="preview"></div></div>`);
    const preview = idx.querySelector('.preview');
    const links = [...idx.querySelectorAll('a')];
    const lens = fisheye(idx.querySelector('p'));
    let x = 0, y = 0, px = 0, py = 0, raf = 0;
    const follow = () => {
      px += (x - px) * 0.18;
      py += (y - py) * 0.18;
      const skew = Math.max(-12, Math.min(12, (x - px) * 0.06));
      preview.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%) skewX(${-skew}deg) rotate(${skew * 0.3}deg)`;
      lens.frame(x, y);
      raf = requestAnimationFrame(follow);
    };
    idx.addEventListener('pointermove', (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) {
        px = x;
        py = y;
        follow();
      }
    });
    links.forEach((a, i) => {
      a.addEventListener('pointerenter', () => {
        const p = content.projects[i];
        idx.classList.add('is-hovering');
        lens.on(true);
        links.forEach((b, j) => {
          b.classList.toggle('on', i === j);
        });
        const m = p.media[0];
        preview.innerHTML = m
          ? m.kind === 'video'
            ? `<video src="${asset(m.src)}" muted autoplay loop playsinline></video>`
            : `<img src="${asset(m.thumb || m.src)}" alt="">`
          : `<div class="card-empty" style="height:100%;border:0;font-size:26px">${esc(p.org || p.title)}</div>`;
        preview.classList.add('on');
      });
      a.addEventListener('pointerleave', () => {
        idx.classList.remove('is-hovering');
        lens.on(false);
        preview.classList.remove('on');
      });
    });
    root.prepend(idx);
    root._cleanup = () => {
      cancelAnimationFrame(raf);
      lens.destroy();
    };
  }
  drawIn(root);
  return root;
}

// each letter in its own span, so the lens can move and size it on its own
const letters = (t) =>
  esc(t).replace(/(&[a-z#0-9]+;|\S)/gi, '<span class="ch" aria-hidden="true">$1</span>');

// Index lens: a magnifying-glass bulge that follows the pointer over the titles. Inside a
// radius R, a letter at distance r is moved out to g(r/R)·R and sized by how much g stretches
// there: big under the pointer, a little squeezed toward the rim, untouched beyond it (g is
// smooth at the rim, so nothing jumps). It swells in while a title is hovered, eases out after.
function fisheye(para) {
  const chars = [...para.querySelectorAll('.ch')];
  const K = 1.1; // strength: letters under the pointer grow to 1 + K
  const g = (u) => u + K * u * (1 - u) * (1 - u);
  const dg = (u) => 1 + K * (1 - u) * (1 - 3 * u);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let rest = null, R = 160, want = 0, amt = 0;
  let bent = new Set(); // letters the lens is currently moving

  // where each letter sits with no lens (page coordinates; the index is fixed, so they hold)
  function measure() {
    for (const k of bent) chars[k].style.transform = '';
    bent.clear();
    rest = new Float32Array(chars.length * 2);
    chars.forEach((c, k) => {
      const r = c.getBoundingClientRect();
      rest[k * 2] = r.left + r.width / 2;
      rest[k * 2 + 1] = r.top + r.height / 2;
    });
    R = parseFloat(getComputedStyle(para).fontSize) * 5.5;
  }
  const remeasure = () => (rest = null);
  addEventListener('resize', remeasure);
  document.fonts?.ready.then(remeasure);

  return {
    on(v) { want = v && !still ? 1 : 0; },
    frame(x, y) {
      amt += (want - amt) * 0.2;
      if (want === 0 && amt < 0.002) {
        amt = 0;
        if (bent.size) {
          for (const k of bent) chars[k].style.transform = '';
          bent.clear();
        }
        return;
      }
      if (!rest) measure();
      const R2 = R * R;
      const next = new Set();
      for (let k = 0; k < chars.length; k++) {
        const vx = rest[k * 2] - x, vy = rest[k * 2 + 1] - y;
        const d2 = vx * vx + vy * vy;
        if (d2 >= R2) continue;
        // push outward along the ray from the pointer; size by the local stretch
        const u = Math.sqrt(d2) / R;
        const f = u > 1e-4 ? g(u) / u : 1 + K;
        const s = 1 + (Math.sqrt(Math.max(0.3, dg(u) * f)) - 1) * amt;
        const t = (f - 1) * amt;
        chars[k].style.transform = `translate(${(vx * t).toFixed(1)}px,${(vy * t).toFixed(1)}px) scale(${s.toFixed(3)})`;
        next.add(k);
      }
      for (const k of bent) if (!next.has(k)) chars[k].style.transform = '';
      bent = next;
    },
    destroy() { removeEventListener('resize', remeasure); },
  };
}

// Project card (Jesper): text pinned left, media scrolling right; edges bend with scroll speed.
export function projectCard(p, { onClose }) {
  const media = p.media.length || p.docs?.length
    ? p.media
        .map((m) =>
          m.kind === 'video'
            ? `<video src="${asset(m.src)}" muted autoplay loop playsinline controls></video>`
            : `<img src="${asset(m.src)}" alt="${esc(m.alt)}" loading="lazy">`,
        )
        .join('') + docTiles(p)
    : `<div class="card-empty">camera-shy project :)<br>I forgot to take pictures</div>`;
  const chips = [p.org, p.org.includes(p.year) ? '' : p.year, ...p.tags].filter(Boolean).map((c) => `<span class="chip">${esc(c)}</span>`).join('');
  const root = el(`<div class="card-wrap" role="dialog" aria-modal="true" aria-label="${esc(p.title)}">
    <article class="card">
      <button class="card-close" type="button" aria-label="Close">×</button>
      <svg class="card-progress" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="11" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>
      <div class="card-scroll">
        <div class="card-info">
          <h2>${esc(p.title)}</h2>
          <p>${esc(p.description)}</p>
          <div class="chips">${chips}</div>
          ${linkList(p, 'card-links', false)}
        </div>
        <div class="card-media">${media}</div>
      </div>
    </article>
  </div>`);
  const card = root.querySelector('.card');
  const scroller = root.querySelector('.card-scroll');
  const ring = root.querySelector('.card-progress circle');
  root.querySelector('.card-close').addEventListener('click', onClose);
  root.addEventListener('click', (e) => e.target === root && onClose());

  // Bend: the card's top and bottom edges bow with scroll velocity (clip-path).
  let last = 0, vel = 0, raf = 0;
  const shape = () => {
    const y = scroller.scrollTop;
    vel += ((y - last) - vel) * 0.2;
    last = y;
    const b = Math.max(-28, Math.min(28, vel * 0.9));
    const w = card.clientWidth, h = card.clientHeight, r = 28;
    card.style.clipPath = `path('M ${r} 0 Q ${w / 2} ${b} ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} Q ${w / 2} ${h + b} ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z')`;
    const max = scroller.scrollHeight - scroller.clientHeight;
    ring.style.strokeDashoffset = String(1 - (max > 0 ? y / max : 1));
    raf = requestAnimationFrame(shape);
  };
  shape();
  gsap.from(card, { y: '8vh', scale: 0.94, opacity: 0, duration: 0.8, ease: 'expo.out' });
  root._cleanup = () => cancelAnimationFrame(raf);
  root._close = (done) => gsap.to(card, { y: '6vh', opacity: 0, scale: 0.96, duration: 0.45, ease: 'power2.in', onComplete: done });
  return root;
}

export function aboutView(content) {
  const bio = content.about.bio.length
    ? content.about.bio.map((b) => `<p>${esc(b)}</p>`).join('')
    : `<p class="todo">Write a few lines under “### About” in README.md and they appear here.</p>`;
  const root = el(`<section class="about fade-in" aria-label="About">
    <h2>hello,</h2>
    ${bio}
    <p class="hint-inline" style="color:var(--muted);font-size:12px;letter-spacing:.1em;text-transform:uppercase">Drag or scroll to spin the photos</p>
  </section>`);
  return root;
}

// Coursework and Resume are loose sheets of paper on the desk. The sheet element goes on
// <body> so it can fly above the huge page title; app.js animates it out of / back onto the
// 3D sheet (ui/paper.js).
function sheetView(sheet) {
  const root = el(`<div></div>`);
  document.body.appendChild(sheet);
  root._sheet = sheet;
  root._cleanup = () => sheet.remove();
  return root;
}

export function courseworkView(content) {
  const schools = content.education
    .map(
      (s) => `<h3>${esc(s.name)}</h3><p class="school-detail">${esc(s.detail)}</p>
      <ol>${s.courses.map((c) => `<li class="${c.current ? 'now' : ''}">${esc(c.name)}</li>`).join('')}</ol>`,
    )
    .join('');
  return sheetView(el(`<section class="notebook paper-sheet" aria-label="Coursework">${schools}</section>`));
}

// The resume itself (also used by the print page, /resume/print).
export function resumeBody(content, { photos: withPhotos = true } = {}) {
  const photos = (p) =>
    withPhotos && p.media.length
      ? `<div class="resume-photos">${p.media
          .filter((m) => m.kind === 'image')
          .map((m) => `<a href="${asset(m.src)}" target="_blank" rel="noopener"><img src="${asset(m.thumb || m.src)}" alt="${esc(m.alt || p.title)}" loading="lazy"></a>`)
          .join('')}</div>`
      : '';
  const list = (items, { withDesc = true, withPhotos = false } = {}) =>
    `<ol>${items
      .map(
        (p) => `<li><span><strong>${esc(p.title)}</strong>${p.org ? ` <span class="org">· ${esc(p.year ? p.org.replace(new RegExp(`[,\\s]*${p.year}$`), '') : p.org)}</span>` : ''}${p.meta && !/^\(?\d{4}\)?$/.test(p.meta) ? ` <span class="org">· ${esc(p.meta.replace(/\s*\(\d{4}\)$/, ''))}</span>` : ''}</span>
        <span class="yr">${esc(p.year || '')}</span>
        ${withDesc && p.description ? `<p>${esc(p.description)}</p>` : ''}
        ${linkList(p, 'resume-links')}
        ${withPhotos ? photos(p) : ''}</li>`,
      )
      .join('')}</ol>`;
  const edu = `<ol>${content.education
    .map((s) => `<li><span><strong>${esc(s.name)}</strong></span><span class="yr"></span><p>${esc(s.detail)}</p></li>`)
    .join('')}</ol>`;
  return `<header class="resume-head"><h2>${esc(content.name || '')}</h2><p>${esc([content.contact.email, content.contact.github].filter(Boolean).join('  ·  '))}</p></header>
    <div class="resume-grid">
      <h3>Education</h3>${edu}
      <h3>Projects &amp; leadership</h3>${list(content.projects)}
      <h3>Honors</h3>${list(content.honors, { withDesc: false, withPhotos: true })}
      <h3>Certificates</h3>${list(content.certificates)}
    </div>`;
}

export function resumeView(content) {
  const sheet = el(`<section class="resume paper-sheet" aria-label="Resume">
    <div class="resume-tools">
      ${handLink({ href: '/resume/print', text: 'print / save', attrs: 'target="_blank" rel="noopener"' })}
      <span class="resume-pdf" hidden>${handLink({ href: '/resume.pdf', text: 'download PDF', attrs: 'download' })}</span>
    </div>
    ${resumeBody(content)}
  </section>`);
  drawIn(sheet);
  fetch('/resume.pdf', { method: 'HEAD' })
    .then((r) => {
      if (r.ok && (r.headers.get('content-type') || '').includes('pdf')) {
        sheet.querySelector('.resume-pdf').hidden = false;
        drawIn(sheet);
      }
    })
    .catch(() => {});
  return sheetView(sheet);
}

export function contactView(content) {
  const c = content.contact;
  // a note card beside the phone: its own paper, so it reads the same over the desk mat,
  // the desk or the lamp light, in either theme
  const root = el(`<section class="contact paper-sheet fade-in" aria-label="Contact">
    <h2>say hi,</h2>
    ${c.email ? `<button class="big email" type="button" title="Click to copy">${esc(c.email)}</button>` : ''}
    ${c.githubUrl ? `<a class="big" href="${esc(c.githubUrl)}" target="_blank" rel="noopener">${esc(c.github)}</a>` : ''}
  </section>`);
  // Clicking the email copies it (no mail app) and shows a little splash.
  root.querySelector('.email')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(c.email);
      splash('copied!', c.email);
    } catch {
      splash('copy failed', 'select the address and copy it');
    }
  });
  return root;
}

function splash(word, small) {
  document.querySelector('.splash')?.remove();
  const s = el(`<div class="splash" role="status"><span class="word">${esc(word)}</span><span class="small">${esc(small)}</span></div>`);
  document.body.appendChild(s);
  gsap
    .timeline({ onComplete: () => s.remove() })
    .fromTo(s, { scale: 0.4, rotation: -8, opacity: 0 }, { scale: 1, rotation: -3, opacity: 1, duration: 0.5, ease: 'back.out(2.2)' })
    .to(s, { opacity: 0, y: -16, duration: 0.4, ease: 'power2.in' }, '+=1.1');
}

// "back to the desk": the same handwritten link on every page but the desk itself.
export function backLink() {
  const b = el(`<div class="back">${handLink({ href: '/', text: 'back to the desk', attrs: 'data-link' })}</div>`);
  drawIn(b);
  return b;
}
