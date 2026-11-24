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
    await frame();
  })();
  const done = started.then(async () => {
    if (!wipe) return;
    await wipe.finished.catch(() => {});
    return () => {
      intro.classList.add('out');
      intro.addEventListener('transitionend', () => intro.remove(), { once: true });
      setTimeout(() => intro.remove(), 1200);
    };
  });
  return { started, done };
}
