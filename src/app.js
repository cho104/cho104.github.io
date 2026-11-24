// Desktop app: routes ↔ 3D world ↔ nav ↔ DOM views.
import { createWorld } from './three/world.js';
import { setTitle } from './ui/title.js';
import { showLabel, hideLabel, placeLabel } from './ui/labels.js';
import { playIntro } from './ui/intro.js';
import * as V from './ui/views.js';

const TITLES = { home: '', works: 'Works,', about: 'About,', coursework: 'Coursework,', resume: 'Resume,', contact: 'Contact,' };
const HINTS = {
  home: 'Scroll to open the MacBook · or click something on the desk',
  works: 'Scroll or drag to look around · click a project',
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

  const photoCaption = document.createElement('p');
  photoCaption.className = 'photo-caption';
  photoCaption.setAttribute('aria-hidden', 'true');
  document.body.appendChild(photoCaption);

  let ringIndex = 0;
  const esc = (t = '') => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Name of the project currently facing the camera on the ring.
  function caption(i) {
    const cap = document.querySelector('.works-caption');
    const p = content.projects[i];
    if (!cap || !p) return;
    cap.innerHTML = `<span class="num">${String(i + 1).padStart(2, '0')}</span> <a href="/works/${p.slug}" data-link>${esc(p.title)}</a> <span class="org">${esc(p.org)}</span>`;
    cap.classList.remove('fade-in');
    void cap.offsetWidth;
    cap.classList.add('fade-in');
  }

  const introDone = playIntro(name);
  // Canvas textures (project panels, phone screen) draw text, so fonts must be ready first.
  await Promise.all(
    ['400 20px "Instrument Sans"', '600 20px "Instrument Sans"', '700 40px "Instrument Sans"', '40px "Reenie Beanie"'].map((f) =>
      document.fonts.load(f).catch(() => {}),
    ),
  );

  const world = createWorld({
    canvas: document.getElementById('gl'),
    content,
    theme,
    on: {
      navigate: (to) => go(to),
      pick: (id) => (id === 'lamp' ? toggleTheme() : go(id === 'home' ? '/' : `/${id}`)),
      project: (slug) => go(`/works/${slug}`),
      hover: (id) => {
        document.querySelectorAll('[data-route]').forEach((a) => a.classList.toggle('is-hot', a.dataset.route === id));
        if (id) showLabel(id, id === 'lamp' ? (theme === 'light' ? 'lights off' : 'lights on') : LABELS[id]);
        else hideLabel();
      },
      labelAt: placeLabel,
      photo: (i, at) => {
        const alt = content.about.photos[i]?.alt;
        photoCaption.textContent = alt || '';
        photoCaption.classList.toggle('on', !!alt);
        if (alt) photoCaption.style.transform = `translate(${at.x + 18}px, ${at.y - 34}px) rotate(-2deg)`;
      },
      worksIndex: (i) => caption((ringIndex = i)),
      travel: (t) => (hint.style.opacity = String(1 - t * 2)),
      wheelBlocked: () => !!card || (current.name === 'works' && worksMode === 'index'),
    },
  });

  // Nav hover ↔ desk object highlight (both directions).
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
    if (route.name === 'works') caption(ringIndex);
    hint.textContent = HINTS[route.name] && !(route.name === 'works' && worksMode === 'index') ? HINTS[route.name] : '';
    hint.style.opacity = '1';
  }

  function openCard(slug) {
    const p = content.projects.find((x) => x.slug === slug);
    if (!p) return;
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
    c._cleanup?.();
    if (now) c.remove();
    else c._close(() => c.remove());
  }

  async function apply(route) {
    const prev = current;
    current = route;
    if (route.slug) {
      if (prev.name !== 'works') {
        render({ name: 'works' });
        setTitle('works', TITLES.works);
        await world.setRoute('works');
      }
      openCard(route.slug);
      return;
    }
    closeCard();
    if (prev.name === route.name && !prev.slug) return;
    if (prev.name === 'works' && prev.slug && route.name === 'works') return;
    setTitle(route.name, TITLES[route.name]);
    render(route);
    await world.setRoute(route.name);
    if (route.name === 'coursework' && current === route) {
      // wait for the cover to swing open, then the page comes out of the notebook
      await new Promise((r) => setTimeout(r, 450));
      if (current === route) view.querySelector('.notebook')?._emerge(world.screenRect('coursework'));
    }
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
    if (e.key !== 'Escape') return;
    if (current.slug) go('/works');
    else if (current.name !== 'home') go('/');
  });

  const fadeIntro = await introDone;
  apply(parse(location.pathname));
  fadeIntro?.();
}
