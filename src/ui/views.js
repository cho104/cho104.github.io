// DOM for each route. All text comes from README.md (via virtual:content).
import { gsap } from 'gsap';
import { handLink, drawIn } from './hand.js';

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const asset = (src) => '/' + src.replace(/^\.?\//, '');

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
    <div class="works-back">${handLink({ href: '/', text: 'back to the desk', attrs: 'data-link' })}</div>
  </div>`);
  root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => onMode(b.dataset.m)));

  if (mode === 'index') {
    const idx = el(`<div class="index fade-in"><p>${content.projects
      .map((p, i) => `<a href="/works/${p.slug}" data-link data-i="${i}">${esc(p.title)}</a>`)
      .join(' <span class="dot">·</span> ')}</p><div class="preview"></div></div>`);
    const preview = idx.querySelector('.preview');
    const links = [...idx.querySelectorAll('a')];
    let x = 0, y = 0, px = 0, py = 0, raf = 0;
    const follow = () => {
      px += (x - px) * 0.18;
      py += (y - py) * 0.18;
      const skew = Math.max(-12, Math.min(12, (x - px) * 0.06));
      preview.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%) skewX(${-skew}deg) rotate(${skew * 0.3}deg)`;
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
        links.forEach((b, j) => {
          b.classList.toggle('on', i === j);
          b.classList.toggle('near', Math.abs(i - j) <= 2 && i !== j);
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
        preview.classList.remove('on');
      });
    });
    root.prepend(idx);
    root._cleanup = () => cancelAnimationFrame(raf);
  }
  drawIn(root);
  return root;
}

// Project card (Jesper): text pinned left, media scrolling right; edges bend with scroll speed.
export function projectCard(p, { onClose }) {
  const media = p.media.length
    ? p.media
        .map((m) =>
          m.kind === 'video'
            ? `<video src="${asset(m.src)}" muted autoplay loop playsinline controls></video>`
            : `<img src="${asset(m.src)}" alt="${esc(m.alt)}" loading="lazy">`,
        )
        .join('')
    : `<div class="card-empty">media for this project goes here:<br>add images under it in README.md</div>`;
  const chips = [p.org, p.year, ...p.tags].filter(Boolean).map((c) => `<span class="chip">${esc(c)}</span>`).join('');
  const root = el(`<div class="card-wrap" role="dialog" aria-modal="true" aria-label="${esc(p.title)}">
    <article class="card">
      <button class="card-close" type="button" aria-label="Close">×</button>
      <svg class="card-progress" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="11" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>
      <div class="card-scroll">
        <div class="card-info">
          <h2>${esc(p.title)}</h2>
          <p>${esc(p.description)}</p>
          <div class="chips">${chips}</div>
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
    <p class="hint-inline" style="color:var(--muted);font-size:12px;letter-spacing:.1em;text-transform:uppercase">Drag to spin the photos</p>
  </section>`);
  return root;
}

export function courseworkView(content) {
  const schools = content.education
    .map(
      (s) => `<h3>${esc(s.name)}</h3><p class="school-detail">${esc(s.detail)}</p>
      <ol>${s.courses.map((c) => `<li class="${c.current ? 'now' : ''}">${esc(c.name)}</li>`).join('')}</ol>`,
    )
    .join('');
  const page = el(`<section class="notebook" aria-label="Coursework">${schools}</section>`);
  // Slides out of the 3D notebook: starts at the notebook's place on screen, lying flat,
  // then lifts up to the reading position.
  page._emerge = (from) => {
    const to = page.getBoundingClientRect();
    gsap.set(page, { visibility: 'visible', transformPerspective: 1400, transformOrigin: '50% 100%' });
    if (!from) return gsap.fromTo(page, { opacity: 0, y: 20 }, { opacity: 1, y: 0, rotation: -1.2, duration: 0.6 });
    gsap.fromTo(
      page,
      {
        // bottom edge on the open pages (right part of the notebook's box, which includes the cover)
        x: from.left + from.width * 0.62 - (to.left + to.width / 2),
        y: from.top + from.height * 0.85 - (to.top + to.height),
        scale: Math.min(1, from.width / to.width),
        rotationX: 72,
        rotation: 8,
        opacity: 0.4,
      },
      { x: 0, y: 0, scale: 1, rotationX: 0, rotation: -1.2, opacity: 1, duration: 1.3, ease: 'power3.inOut' },
    );
  };
  return page;
}

export function resumeView(content) {
  const photos = (p) =>
    p.media.length
      ? `<div class="resume-photos">${p.media
          .filter((m) => m.kind === 'image')
          .map((m) => `<a href="${asset(m.src)}" target="_blank" rel="noopener"><img src="${asset(m.thumb || m.src)}" alt="${esc(m.alt || p.title)}" loading="lazy"></a>`)
          .join('')}</div>`
      : '';
  const list = (items, { withDesc = true, withPhotos = false } = {}) =>
    `<ol>${items
      .map(
        (p) => `<li><span><strong>${esc(p.title)}</strong>${p.org ? ` <span class="org">· ${esc(p.org)}</span>` : ''}${p.meta && !/^\(?\d{4}\)?$/.test(p.meta) ? ` <span class="org">· ${esc(p.meta.replace(/\s*\(\d{4}\)$/, ''))}</span>` : ''}</span>
        <span class="yr">${esc(p.year || '')}</span>
        ${withDesc && p.description ? `<p>${esc(p.description)}</p>` : ''}
        ${withPhotos ? photos(p) : ''}</li>`,
      )
      .join('')}</ol>`;
  const edu = `<ol>${content.education
    .map((s) => `<li><span><strong>${esc(s.name)}</strong></span><span class="yr"></span><p>${esc(s.detail)}</p></li>`)
    .join('')}</ol>`;
  const root = el(`<section class="resume fade-in" aria-label="Resume">
    <div class="resume-pdf" hidden>${handLink({ href: '/resume.pdf', text: 'download PDF', attrs: 'download' })}</div>
    <div class="resume-grid">
      <h3>Education</h3>${edu}
      <h3>Projects &amp; leadership</h3>${list(content.projects)}
      <h3>Honors</h3>${list(content.honors, { withDesc: false, withPhotos: true })}
      <h3>Certificates</h3>${list(content.certificates)}
    </div>
  </section>`);
  // the huge title is fixed; fade it out as the resume scrolls under it
  const title = document.querySelector('.page-title');
  root.addEventListener('scroll', () => {
    title.style.opacity = String(Math.max(0, 1 - root.scrollTop / 220));
  });
  root._cleanup = () => (title.style.opacity = '');
  fetch('/resume.pdf', { method: 'HEAD' })
    .then((r) => {
      if (r.ok && (r.headers.get('content-type') || '').includes('pdf')) {
        root.querySelector('.resume-pdf').hidden = false;
        drawIn(root);
      }
    })
    .catch(() => {});
  return root;
}

export function contactView(content) {
  const c = content.contact;
  const root = el(`<section class="contact fade-in" aria-label="Contact">
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
