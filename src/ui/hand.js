// Hand-drawn strokes (Erik-style). Every path uses pathLength="1" so CSS/GSAP can draw it
// by animating stroke-dashoffset from 1 to 0.

const ARROW_RIGHT =
  '<path pathLength="1" d="M2 11 C 14 9.5, 28 12.5, 42 10.6 C 46 10.1, 49 10.4, 52 10.8"/>' +
  '<path pathLength="1" d="M44.5 4.2 C 47.5 6.6, 50.5 9, 53.2 10.9 C 50.4 12.8, 47.6 15.2, 45.2 17.8"/>';

const ARROW_DOWN =
  '<path pathLength="1" d="M6 2 C 14 4, 30 6, 46 14 C 52 17, 56 21, 58 26"/>' +
  '<path pathLength="1" d="M51.5 22.5 C 54 24, 56.3 25.4, 58.3 26.6 C 59 24.2, 59.6 21.6, 60.6 19"/>';

export function arrowSVG(kind = 'right') {
  const vb = kind === 'right' ? '0 0 56 22' : '0 0 64 28';
  return `<svg class="draw" viewBox="${vb}" aria-hidden="true">${kind === 'right' ? ARROW_RIGHT : ARROW_DOWN}</svg>`;
}

// <a class="hand-link"> with a drawn arrow; draws itself in shortly after it appears.
export function handLink({ href, text, attrs = '' }) {
  return `<a class="hand-link" href="${href}" ${attrs}>${arrowSVG('right')}<span>${text}</span></a>`;
}

export function drawIn(root = document) {
  requestAnimationFrame(() => {
    root.querySelectorAll('.hand-link:not(.is-drawn)').forEach((a, i) => {
      setTimeout(() => a.classList.add('is-drawn'), 200 + i * 140);
    });
  });
}
