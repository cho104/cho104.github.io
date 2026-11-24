// The little white duckling figure on the window sill (from the room photo: fluffy white
// body standing upright, raised neck, round head, pale bill tipped up, thin legs).
// The body is one smooth surface: a signed-distance shape (ellipsoids blended together)
// polygonized once with marching cubes, so neck, chest and tail flow into each other.
// Units are metres; the origin is between the feet, facing +z.
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

// --- signed distance helpers -------------------------------------------------------------
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
// ellipsoid at c with radii r, pitched by `pitch` (radians, + raises its front end)
function ellipsoid(p, c, r, pitch = 0) {
  let y = p[1] - c[1], z = p[2] - c[2];
  const x = p[0] - c[0];
  if (pitch) {
    const cs = Math.cos(pitch), sn = Math.sin(pitch);
    [y, z] = [y * cs - z * sn, y * sn + z * cs];
  }
  const k0 = Math.hypot(x / r[0], y / r[1], z / r[2]);
  const k1 = Math.hypot(x / (r[0] * r[0]), y / (r[1] * r[1]), z / (r[2] * r[2]));
  return (k0 * (k0 - 1)) / k1;
}
function capsule(p, a, b, r) {
  const pa = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const h = Math.min(1, Math.max(0, (pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / (ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2)));
  return Math.hypot(pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h) - r;
}

// Polygonize sdf inside the box [min, max] (a cube is used: the longest side) into a static,
// smooth-shaded BufferGeometry.
function sdfGeometry(sdf, min, max, res = 64) {
  const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, 60000);
  const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const half = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
  mc.isolation = 0;
  const hs = mc.halfsize;
  const scale = 1 / (half * 0.0012); // field units: keep gradients well above float noise
  for (let z = 0; z < res; z++)
    for (let y = 0; y < res; y++)
      for (let x = 0; x < res; x++) {
        const p = [c[0] + ((x - hs) / hs) * half, c[1] + ((y - hs) / hs) * half, c[2] + ((z - hs) / hs) * half];
        mc.field[x + y * res + z * res * res] = -sdf(p) * scale;
      }
  mc.update();
  const n = mc.count;
  const pos = mc.positionArray.slice(0, n * 3);
  const nor = mc.normalArray.slice(0, n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = c[0] + pos[i * 3] * half;
    pos[i * 3 + 1] = c[1] + pos[i * 3 + 1] * half;
    pos[i * 3 + 2] = c[2] + pos[i * 3 + 2] * half;
    const l = Math.hypot(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]) || 1;
    nor[i * 3] /= l; nor[i * 3 + 1] /= l; nor[i * 3 + 2] /= l;
  }
  mc.geometry.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

// --- the duckling's shape --------------------------------------------------------------------
const HEAD = [0, 0.0565, 0.0105];
function bodySdf(p) {
  let d = ellipsoid(p, [0, 0.026, -0.002], [0.0155, 0.0148, 0.0205], 0.5); // body, front end raised
  d = smin(d, ellipsoid(p, [0, 0.0305, 0.009], [0.0128, 0.0135, 0.0118]), 0.008); // full chest
  d = smin(d, capsule(p, [0, 0.036, 0.007], [0, 0.05, 0.0098], 0.0078), 0.007); // short neck
  d = smin(d, ellipsoid(p, HEAD, [0.0102, 0.0104, 0.0112], 0.15), 0.005); // round head
  d = smin(d, ellipsoid(p, [0, 0.0215, -0.0205], [0.0055, 0.0038, 0.008], 0.75), 0.006); // stubby tail, up
  // little folded wings at the sides
  for (const s of [1, -1]) d = smin(d, ellipsoid(p, [s * 0.0128, 0.0285, -0.004], [0.0036, 0.0095, 0.0145], 0.55), 0.004);
  return d;
}
function billSdf(p) {
  // flat, wide at the root and rounded at the tip, tipped up like the photo
  const flat = ellipsoid(p, [0, 0.0572, 0.0252], [0.0049, 0.0016, 0.0066], 0.5);
  return smin(flat, ellipsoid(p, [0, 0.0558, 0.0203], [0.0058, 0.0032, 0.004], 0.5), 0.003); // wider root
}

let cache = null;
function shapes() {
  if (cache) return cache;
  cache = {
    body: sdfGeometry(bodySdf, [-0.022, 0.006, -0.034], [0.022, 0.072, 0.03], 54),
    bill: sdfGeometry(billSdf, [-0.008, 0.046, 0.014], [0.008, 0.066, 0.036], 28),
  };
  return cache;
}

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
function part(geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Bill, eyes, legs and webbed feet: the same on every variant.
function details(g) {
  const { bill } = shapes();
  g.add(part(bill, mat('#e9d9b4', { roughness: 0.5 })));
  // nostrils
  const dark = mat('#3b3228', { roughness: 0.6 });
  for (const s of [1, -1]) g.add(part(new THREE.SphereGeometry(0.0004, 6, 4), dark, { x: s * 0.0014, y: 0.0592, z: 0.0244 }));
  // eyes: glossy black beads set into the head
  const eye = new THREE.MeshPhysicalMaterial({ color: '#111113', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  for (const s of [1, -1]) g.add(part(new THREE.SphereGeometry(0.0015, 14, 10), eye, { x: s * 0.0089, y: 0.0592, z: 0.0164 }));
  // legs and three-toed webbed feet
  const leg = mat('#d9b98a', { roughness: 0.55 });
  const toe = new THREE.Shape();
  toe.moveTo(0, -0.0012);
  toe.quadraticCurveTo(-0.0055, 0.004, -0.0045, 0.0072);
  toe.quadraticCurveTo(-0.0022, 0.0058, 0, 0.0078);
  toe.quadraticCurveTo(0.0022, 0.0058, 0.0045, 0.0072);
  toe.quadraticCurveTo(0.0055, 0.004, 0, -0.0012);
  const footGeo = new THREE.ExtrudeGeometry(toe, { depth: 0.0006, bevelEnabled: true, bevelSize: 0.0003, bevelThickness: 0.0003, bevelSegments: 2, curveSegments: 8 });
  for (const s of [1, -1]) {
    g.add(part(new THREE.CylinderGeometry(0.0009, 0.0011, 0.014, 8), leg, { x: s * 0.0055, y: 0.0075, z: 0.001, rz: s * 0.06 }));
    g.add(part(footGeo, leg, { x: s * 0.0062, y: 0.0012, z: 0.0, rx: Math.PI / 2, rz: s * 0.15 }));
  }
}

// One smooth matte surface, like a painted figurine; a soft sheen keeps it from looking plastic.
function smooth() {
  const g = new THREE.Group();
  g.add(part(shapes().body, new THREE.MeshPhysicalMaterial({ color: '#f5f3ee', roughness: 0.75, sheen: 0.6, sheenRoughness: 0.6, sheenColor: '#ffffff' })));
  details(g);
  return g;
}

export const duckling = smooth;
