import { gsap } from 'gsap';
import { arrowSVG } from './hand.js';

const layer = () => document.getElementById('labels');
let el = null;
let shownId = null;
let shownText = null;

export function showLabel(id, text) {
  if (shownId === id) {
    if (text !== shownText && el) {
      shownText = text;
      const span = el.querySelector('span');
      span.textContent = text;
      gsap.fromTo(span, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'power2.out' });
    }
    return;
  }
  hideLabel();
  if (!id) return;
  shownId = id;
  shownText = text;
  el = document.createElement('div');
  el.className = 'label';
  el.innerHTML = `<span>${text}</span>${arrowSVG('down')}`;
  layer().appendChild(el);
  const paths = el.querySelectorAll('path');
  gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 });
  gsap.to(paths, { strokeDashoffset: 0, duration: 0.45, stagger: 0.18, ease: 'power2.out' });
  gsap.fromTo(el.querySelector('span'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'power2.out' });
}

export function hideLabel() {
  if (!el) return;
  const old = el;
  el = null;
  shownId = null;
  shownText = null;
  gsap.to(old, { opacity: 0, duration: 0.2, onComplete: () => old.remove() });
}

export function placeLabel(pos) {
  if (!el || !pos) return;
  const half = el.offsetWidth / 2;
  const x = Math.min(innerWidth - half - 12, Math.max(half + 12, pos.x - 30));
  el.style.left = `${x}px`;
  el.style.top = `${Math.max(el.offsetHeight + 60, pos.y - 6)}px`;
}
