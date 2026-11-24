import { createWorld } from './three/world.js';
import { setTitle } from './ui/title.js';
import { showLabel, hideLabel, placeLabel } from './ui/labels.js';
import { playIntro } from './ui/intro.js';
import { paperFlight } from './ui/paper.js';
import * as V from './ui/views.js';

const TITLES = { home: '', works: 'Works,', about: 'About,', coursework: 'Coursework,', resume: 'Resume,', contact: 'Contact,' };
const HINTS = {
  home: 'Click something on the desk',
  works: 'Scroll, drag or use ← → to look around · click a project',
};
const NOTES = {
  cube: "Haven't taught myself to solve it. Yet.",
  mouse: "Honestly, I'd rather have a Microsoft Arc Mouse",
  duck: 'cute, right?',
  outside: "Where my eyes go when the code won't compile.",
};
const LABELS = { coursework: 'coursework', resume: 'resume', works: 'works', contact: 'contact', about: 'about' };

function parse(path) {
  const p = path.replace(/\/+$/, '') || '/';
  if (p === '/') return { name: 'home' };
  const m = p.match(/^\/works\/([^/]+)$/);
  if (m) return { name: 'works', slug: decodeURIComponent(m[1]) };
  const name = p.slice(1);
  return TITLES[name] !== undefined ? { name } : { name: 'home' };
}

export async function start(content) {
  const name = content.name || 'cho104';
  document.querySelector('.nav-home').textContent = name;

  const view = document.getElementById('view');
  const hint = document.querySelector('.hint');
  const themeBtn = document.querySelector('.nav-theme');
  let theme = document.documentElement.dataset.theme || 'light';
  let worksMode = 'featured';
  let current = { name: null };
  let card = null;
  let returnFocus = null;

  const photoCaption = document.createElement('p');
  photoCaption.className = 'photo-caption';
  photoCaption.setAttribute('aria-hidden', 'true');
  document.body.appendChild(photoCaption);
  function showCaption(text, at) {
    photoCaption.textContent = text || '';
    photoCaption.classList.toggle('on', !!text);
    if (text) photoCaption.style.transform = `translate(${at.x + 18}px, ${at.y - 34}px) rotate(-2deg)`;
  }

  let ringIndex = 0;
  let hovered = null;
  const labelFor = (id) => (id === 'lamp' ? (theme === 'light' ? 'lights off' : 'lights on') : LABELS[id]);
  const esc = (t = '') =>
    String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function caption(i) {
    const cap = document.querySelector('.works-caption');
    const p = content.projects[i];
    if (!cap || !p || cap.dataset.i === String(i)) return;
    cap.dataset.i = i;
    cap.innerHTML = `<span class="num">${String(i + 1).padStart(2, '0')}</span> <a href="/works/${esc(p.slug)}" data-link>${esc(p.title)}</a> <span class="org">${esc(p.org)}</span>`;
    cap.classList.remove('fade-in');
    void cap.offsetWidth;
    cap.classList.add('fade-in');
  }

  const intro = playIntro(name);
  await Promise.all([
    intro.started,
    ...['400 20px "Instrument Sans"', '600 20px "Instrument Sans"', '700 40px "Instrument Sans"', '40px "Reenie Beanie"'].map((f) =>
      document.fonts.load(f).catch(() => {}),
    ),
  ]);

  const world = createWorld({
    canvas: document.getElementById('gl'),
    content,
    theme,
    on: {
      navigate: (to) => go(to),
      pick: (id) => (id === 'lamp' ? toggleTheme() : go(id === 'home' ? '/' : `/${id}`)),
      project: (slug) => go(`/works/${slug}`),
      hover: (id) => {
        hovered = id;
        document.querySelectorAll('[data-route]').forEach((a) => a.classList.toggle('is-hot', a.dataset.route === id));
        if (id) showLabel(id, labelFor(id));
        else hideLabel();
      },
      labelAt: placeLabel,
      photo: (i, at) => showCaption(content.about.photos[i]?.alt, at),
      note: (key, at) => showCaption(NOTES[key], at),
      worksIndex: (i) => caption((ringIndex = i)),
      wheelBlocked: () => !!card || (current.name === 'works' && worksMode === 'index'),
      ringHidden: () => current.name === 'works' && worksMode === 'index',
    },
  });

  document.querySelectorAll('[data-route]').forEach((a) => {
    a.addEventListener('pointerenter', () => world.setHot(a.dataset.route));
    a.addEventListener('pointerleave', () => world.setHot(null));
  });
  themeBtn.addEventListener('click', toggleTheme);

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {}
    world.setTheme(theme);
    if (hovered === 'lamp') showLabel('lamp', labelFor('lamp'));
  }

  function render(route) {
    const cleanup = view.firstElementChild?._cleanup;
    cleanup?.();
    view.replaceChildren();
    let node;
    switch (route.name) {
      case 'works':
        node = V.worksView(content, {
          mode: worksMode,
          onMode: (m) => {
            worksMode = m;
            render(current);
          },
        });
        break;
      case 'about': node = V.aboutView(content); break;
      case 'coursework': node = V.courseworkView(content); break;
      case 'resume': node = V.resumeView(content); break;
      case 'contact': node = V.contactView(content); break;
      default: node = V.homeView();
    }
    view.appendChild(node);
    if (node._sheet) {
      const flight = paperFlight(node._sheet, world.paper, route.name);
      node._flight = flight;
      const remove = node._cleanup;
      node._cleanup = () => {
        flight.reset();
        remove();
      };
    }
    if (route.name !== 'home') view.appendChild(V.backLink());
    if (route.name === 'works' && world.mode === 'works') caption(ringIndex);
    document.body.toggleAttribute('data-wall', route.name === 'works');
    hint.textContent = HINTS[route.name] && !(route.name === 'works' && worksMode === 'index') ? HINTS[route.name] : '';
  }

  function openCard(slug) {
    const p = content.projects.find((x) => x.slug === slug);
    if (!p) return;
    if (!card) returnFocus = document.activeElement;
    closeCard(true);
    card = V.projectCard(p, { onClose: () => go('/works') });
    document.body.appendChild(card);
    const i = content.projects.indexOf(p);
    world.works.goTo(i);
    card.querySelector('.card-close').focus();
  }
  function closeCard(now = false) {
    if (!card) return;
    const c = card;
    card = null;
    if (!now && returnFocus?.isConnected && returnFocus !== document.body) returnFocus.focus({ preventScroll: true });
    else if (!now) document.querySelector('.works-caption a')?.focus({ preventScroll: true });
    c._cleanup?.();
    if (now) c.remove();
    else c._close(() => c.remove());
  }

  let seq = 0;
  async function apply(route) {
    const my = ++seq;
    const prev = current;
    current = route;
    document.body.dataset.route = route.name;
    if (prev.name && prev.name !== route.name) {
      const flight = view.firstElementChild?._flight;
      if (flight) {
        await flight.back();
        if (my !== seq) return;
      }
    }
    if (route.slug) {
      if (prev.name !== 'works') {
        render({ name: 'works' });
        setTitle('works', TITLES.works);
        await world.setRoute('works');
        if (my !== seq) return;
      }
      openCard(route.slug);
      return;
    }
    closeCard();
    if (prev.name === route.name && !prev.slug) return;
    if (prev.name === 'works' && prev.slug && route.name === 'works') return;
    setTitle(route.name, TITLES[route.name]);
    render(route);
    const node = view.firstElementChild;
    await world.setRoute(route.name);
    if (my !== seq || !node._flight) return;
    if (route.name === 'coursework') await new Promise((r) => setTimeout(r, 450));
    if (my === seq) node._flight.out();
  }

  function go(path) {
    if (location.pathname !== path) history.pushState({}, '', path);
    apply(parse(path));
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-link]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    e.preventDefault();
    go(new URL(a.href).pathname);
  });
  addEventListener('popstate', () => apply(parse(location.pathname)));
  addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !card && !e.altKey && !e.metaKey && !e.ctrlKey &&
        current.name === 'works' && worksMode === 'featured' && world.mode === 'works' &&
        !e.target.closest?.('input, textarea, select, [contenteditable]')) {
      e.preventDefault();
      world.works.step(e.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (e.key !== 'Escape') return;
    if (current.slug) go('/works');
    else if (current.name !== 'home') go('/');
  });

  const fadeIntro = await intro.done;
  apply(parse(location.pathname));
  fadeIntro?.();
}
