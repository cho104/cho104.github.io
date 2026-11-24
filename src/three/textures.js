import * as THREE from 'three';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function wrap(ctx, text, x, y, maxW, lineH, maxLines = 4) {
  const words = text.split(/\s+/);
  let line = '';
  let n = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + n * lineH);
      line = w;
      if (++n >= maxLines) return n;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y + n * lineH);
  return n + 1;
}

export function panelTexture(project, index, theme) {
  const dark = theme === 'dark';
  return canvasTex(1600, 1000, (ctx, w, h) => {
    ctx.fillStyle = dark ? '#26303a' : '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = dark ? '#ededea' : '#1d252d';
    ctx.font = '600 30px "Instrument Sans", sans-serif';
    ctx.fillText(String(index + 1).padStart(2, '0'), 80, 110);
    ctx.textAlign = 'right';
    ctx.fillStyle = dark ? '#9aa2a9' : '#6b737a';
    ctx.fillText([project.org, project.year].filter(Boolean).join(' · ').toUpperCase().slice(0, 60), w - 80, 110);
    ctx.textAlign = 'left';
    ctx.fillStyle = dark ? '#ededea' : '#1d252d';
    ctx.font = '700 118px "Instrument Sans", sans-serif';
    const lines = wrap(ctx, project.title, 80, 420, w - 160, 112, 3);
    ctx.fillStyle = dark ? '#9aa2a9' : '#6b737a';
    ctx.font = '400 34px "Instrument Sans", sans-serif';
    wrap(ctx, project.description, 80, 420 + lines * 112 + 30, w - 520, 46, 3);
    ctx.fillStyle = dark ? '#4d8fe0' : '#004c97';
    ctx.fillRect(80, h - 110, 120, 8);
  });
}

const PHOTO_TONES = ['#d9d4c7', '#c9d1d6', '#d6cfc9', '#cfd6c8', '#dcd8d0', '#c8ccd4', '#e0dad2', '#cfc9c1'];
export function photoPlaceholder(i) {
  return canvasTex(400, 500, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, PHOTO_TONES[i % PHOTO_TONES.length]);
    g.addColorStop(1, PHOTO_TONES[(i + 3) % PHOTO_TONES.length]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(29,37,45,0.45)';
    ctx.font = '400 70px "Reenie Beanie", cursive';
    ctx.textAlign = 'center';
    ctx.fillText('photo', w / 2, h / 2 + 20);
  });
}

export function phoneScreen(on, contact, theme = 'light') {
  const dark = theme === 'dark';
  return canvasTex(390, 844, (ctx, w, h) => {
    ctx.fillStyle = !on ? '#0b0d0f' : dark ? '#121417' : '#f7f7f5';
    ctx.fillRect(0, 0, w, h);
    if (!on) return;
    const ink = dark ? '#ededea' : '#1d252d';
    ctx.fillStyle = ink;
    ctx.font = '600 22px "Instrument Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('9:41', 48, 52);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 62, 18, 124, 36, 18);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.font = '400 92px "Reenie Beanie", cursive';
    ctx.fillText('say hi', w / 2, 330);
    ctx.fillStyle = dark ? '#4d8fe0' : '#004c97';
    ctx.font = '500 21px "Instrument Sans", sans-serif';
    ctx.fillText(contact.email || '', w / 2, 420);
    ctx.fillText(contact.github || '', w / 2, 460);
  });
}
