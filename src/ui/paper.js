import * as THREE from 'three';
import { gsap } from 'gsap';

const UP = new THREE.Vector3(0, 1, 0);
const CORNERS = [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]];

function quadMatrix(w, h, q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, k = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    k = (dx1 * dy3 - dx3 * dy1) / det;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + k * y3, f = y0;
  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${k / h},0,0,1,0,${c},${f},0,1)`;
}

export function paperFlight(el, paper, id) {
  const st = { t: 0 };
  let token = 0;
  const c = new THREE.Vector3(), q = new THREE.Quaternion(), v = new THREE.Vector3();

  function layoutRect() {
    const tr = el.style.transform;
    el.style.transform = 'none';
    const r = el.getBoundingClientRect();
    el.style.transform = tr;
    return r;
  }

  function frame() {
    const t = st.t;
    el.style.opacity = String(Math.min(1, t / 0.1));
    paper.show(id, t < 0.12);
    if (t >= 1) {
      el.style.transform = 'none';
      return;
    }
    const r = layoutRect();
    const a = paper.pose(id);
    const b = paper.viewPose(r, a.h);
    c.lerpVectors(a.c, b.c, t).addScaledVector(UP, 0.05 * Math.sin(Math.PI * t));
    q.slerpQuaternions(a.q, b.q, t);
    const w = a.w + (b.w - a.w) * t, h = a.h + (b.h - a.h) * t;
    const X = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const Y = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const quad = CORNERS.map(([u, vv]) => {
      v.copy(c).addScaledVector(X, u * w).addScaledVector(Y, vv * h);
      const [sx, sy] = paper.toScreen(v);
      return [sx - r.left, sy - r.top];
    });
    el.style.transform = quadMatrix(r.width, r.height, quad);
  }

  const fly = (to, duration, ease) =>
    new Promise((done) => {
      gsap.killTweensOf(st);
      gsap.to(st, { t: to, duration, ease, onUpdate: frame, onComplete: done, onInterrupt: done });
    });

  el.style.transformOrigin = '0 0';
  el.style.visibility = 'hidden';

  return {
    async out() {
      const my = ++token;
      if (st.t === 0) {
        await paper.slide(id, true);
        if (my !== token) return;
      }
      paper.sync();
      el.style.visibility = 'visible';
      frame();
      await fly(1, 1.15, 'power3.inOut');
    },
    async back() {
      const my = ++token;
      if (st.t > 0) {
        await fly(0, 0.85, 'power2.inOut');
        if (my !== token) return;
      }
      el.style.visibility = 'hidden';
      paper.show(id, true);
      await paper.slide(id, false, 0.45);
    },
    reset() {
      ++token;
      gsap.killTweensOf(st);
      paper.reset(id);
    },
  };
}
