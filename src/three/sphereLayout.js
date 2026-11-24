import * as THREE from 'three';

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export function sphereLayout(n, w, h, { seed = 11, minR = 0.15 } = {}) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5;
  const items = Array.from({ length: n }, (_, i) => {
    const y = THREE.MathUtils.clamp(1 - ((i + 0.5) / n) * 2 + rnd() * (0.9 / n), -0.999, 0.999);
    const th = GOLDEN * i + rnd() * 0.5;
    const r = Math.sqrt(1 - y * y);
    return {
      dir: new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r).normalize(),
      roll: rnd() * 1.4,
      scale: 1 + rnd() * 0.3,
    };
  });

  const tmp = new THREE.Object3D();
  const pose = (it, R) => {
    tmp.position.copy(it.dir).multiplyScalar(R);
    tmp.lookAt(it.dir.clone().multiplyScalar(R * 2));
    tmp.rotateZ(it.roll);
    tmp.updateMatrix();
    const hw = (w * it.scale) / 2, hh = (h * it.scale) / 2;
    return {
      p: tmp.position.clone(),
      q: tmp.quaternion.clone(),
      s: it.scale,
      corners: [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, yy]) => new THREE.Vector3(x, yy, 0).applyMatrix4(tmp.matrix)),
    };
  };

  const U = new THREE.Vector3(), V = new THREE.Vector3(), N = new THREE.Vector3();
  function overlap(a, b, gap) {
    N.copy(a.p).normalize().add(b.p.clone().normalize()).normalize();
    U.set(0, 1, 0).cross(N);
    if (U.lengthSq() < 1e-6) U.set(1, 0, 0);
    U.normalize();
    V.copy(N).cross(U);
    const P = a.corners.map((c) => [c.dot(U), c.dot(V)]);
    const Q = b.corners.map((c) => [c.dot(U), c.dot(V)]);
    for (const poly of [P, Q]) {
      for (let k = 0; k < 4; k++) {
        const [x0, y0] = poly[k], [x1, y1] = poly[(k + 1) % 4];
        const l = Math.hypot(x1 - x0, y1 - y0);
        const ax = (y1 - y0) / l, ay = (x0 - x1) / l;
        const pa = P.map(([x, y]) => x * ax + y * ay), pb = Q.map(([x, y]) => x * ax + y * ay);
        if (Math.min(...pb) - Math.max(...pa) > gap || Math.min(...pa) - Math.max(...pb) > gap) return false;
      }
    }
    return true;
  }

  const gap = Math.min(w, h) * 0.04;
  const reach = Math.hypot(w, h) * 1.15;
  const push = new THREE.Vector3();
  let R = minR;
  for (let tries = 0; tries < 60; tries++, R *= 1.02) {
    for (let round = 0; round < 25; round++) {
      const poses = items.map((it) => pose(it, R));
      let clear = true;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (poses[i].p.distanceTo(poses[j].p) > reach) continue;
          if (!overlap(poses[i], poses[j], gap)) continue;
          clear = false;
          push.subVectors(items[i].dir, items[j].dir).normalize().multiplyScalar(0.012);
          items[i].dir.add(push).normalize();
          items[j].dir.sub(push).normalize();
        }
      }
      if (clear) return { R, poses };
    }
  }
  return { R, poses: items.map((it) => pose(it, R)) };
}
