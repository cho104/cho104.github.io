// Grégory-style nav: the current page's nav word grows into the huge page title, and the
// previous title shrinks back into its nav word (FLIP between the two rectangles).
import { gsap } from 'gsap';

const title = () => document.querySelector('.page-title');
const linkFor = (route) => document.querySelector(`.nav-links a[data-route="${route}"]`);

let current = null;

function flipFrom(el, fromRect, toRect, fromSize, toSize, reverse, onDone) {
  const s = fromSize / toSize;
  const dx = fromRect.left - toRect.left;
  const dy = fromRect.top - toRect.top;
  const a = { x: dx, y: dy, scale: s };
  const b = { x: 0, y: 0, scale: 1 };
  gsap.fromTo(el, reverse ? b : a, { ...(reverse ? a : b), duration: 0.9, ease: 'expo.inOut', onComplete: onDone });
}

export function setTitle(route, text) {
  const t = title();
  const prev = current;
  current = route;

  document.querySelectorAll('.nav-links a').forEach((a) => {
    if (a.dataset.route === route) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Shrink the old title back into its nav word.
  if (prev && prev !== route && t.textContent && !reduce) {
    const link = linkFor(prev);
    const clone = t.cloneNode(true);
    clone.removeAttribute('aria-live');
    document.body.appendChild(clone);
    const big = t.getBoundingClientRect();
    if (link) {
      link.style.visibility = 'hidden';
      const small = link.getBoundingClientRect();
      const fs = parseFloat(getComputedStyle(t).fontSize);
      const ls = parseFloat(getComputedStyle(link).fontSize);
      flipFrom(clone, small, big, ls, fs, true, () => {
        clone.remove();
        link.style.visibility = '';
      });
    } else {
      gsap.to(clone, { opacity: 0, duration: 0.4, onComplete: () => clone.remove() });
    }
  }

  t.textContent = text || '';
  if (!text) return;

  // Grow the new title out of its nav word.
  const link = linkFor(route);
  if (!link || reduce) return;
  const small = link.getBoundingClientRect();
  const big = t.getBoundingClientRect();
  const fs = parseFloat(getComputedStyle(t).fontSize);
  const ls = parseFloat(getComputedStyle(link).fontSize);
  flipFrom(t, small, big, ls, fs, false);
}
