// Opening: the name in the handwriting font is uncovered left to right, then the desk
// fades up beneath it. Both steps are CSS transform/opacity animations, which run on the
// compositor, so they stay smooth while the main thread is busy building the 3D world.
//
// Returns { started, done }: `started` resolves once the wipe is running (build the heavy
// world after it, or the wipe waits for the build before it can begin); `done` resolves
// with a function that fades the intro away.
const frame = () => new Promise((r) => requestAnimationFrame(r));

export function playIntro(name) {
  const intro = document.getElementById('intro');
  intro.querySelector('.intro-name span').textContent = name;
  let wipe;
  const started = (async () => {
    try {
      await document.fonts.load('170px "Reenie Beanie"', name);
    } catch {}
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return intro.remove();
    intro.classList.add('go');
    wipe = intro.querySelector('.intro-wipe').getAnimations()[0];
    await wipe?.ready;
    await frame(); // committed to the compositor
  })();
  const done = started.then(async () => {
    if (!wipe) return;
    await wipe.finished.catch(() => {});
    return () => {
      intro.classList.add('out');
      intro.addEventListener('transitionend', () => intro.remove(), { once: true });
      setTimeout(() => intro.remove(), 1200); // in case transitionend never fires
    };
  });
  return { started, done };
}
