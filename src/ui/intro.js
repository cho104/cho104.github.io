// Opening: the name is written out stroke by stroke in the handwriting font, then the desk
// fades up beneath it.
import { gsap } from 'gsap';

export async function playIntro(name) {
  const intro = document.getElementById('intro');
  const text = intro.querySelector('text');
  text.textContent = name;
  try {
    await document.fonts.load('170px "Reenie Beanie"', name);
  } catch {}
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    intro.remove();
    return;
  }
  const tl = gsap.timeline();
  tl.to(text, { strokeDashoffset: 0, duration: 2.2, ease: 'power1.inOut' })
    .to(text, { fill: getComputedStyle(document.body).color, duration: 0.5 }, '-=0.5')
    .to(text, { strokeWidth: 0, duration: 0.3 }, '<');
  await tl;
  return () =>
    gsap.to(intro, {
      opacity: 0,
      duration: 0.9,
      ease: 'power2.inOut',
      onComplete: () => intro.remove(),
    });
}
