// The desk world. Every clickable object maps 1:1 to a nav item, and objects are laid out
// left → right in nav order: notebook, printout, MacBook, iPhone, wall photos, lamp.
// Decor (plant, mug) never reacts to hover or click.
//
// Units are metres; the desk top is at y = 0.75. The room is a placeholder until the
// owner's room photos arrive.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { laptopScreen, phoneScreen, photoPlaceholder } from './textures.js';
import { sphereLayout } from './sphereLayout.js';
import { duckling } from './duck.js';

const TOP = 0.75;

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });

function mesh(geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// Small details on a nav object: no hover outline of their own (the object's main body has one).
function fine(m) {
  m.traverse((o) => (o.userData.noHull = true));
  return m;
}

// A canvas texture (for grain, perforation and similar fine surface detail).
function canvasTexture(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

function tag(root, id) {
  root.traverse((o) => (o.userData.id = id));
  return root;
}

// Decor that answers a hover with a handwritten note (never clickable, no outline).
function note(root, key) {
  root.traverse((o) => (o.userData.note = key));
  return root;
}

// --- The room, after the owner's photo: cream walls, a wood-framed window onto trees
// (left half of the wall behind the desk), a tall oak bookcase in the right corner,
// a white cube shelf along the right wall, beige carpet.
const WIN = { x0: -1.35, x1: 0.02, y0: 0.98, y1: 2.15, mull: -0.654 }; // mullion sits on the photo seam
const WALL_Z = -0.42;

function room(scene) {
  const wallMat = mat('#ece5d8', { roughness: 0.95 });
  const floorMat = mat('#cbc2b3', { roughness: 1 });
  const plane = (w, h, x, y, z, ry = 0) => mesh(new THREE.PlaneGeometry(w, h), wallMat, { x, y, z, ry, cast: false });

  scene.add(mesh(new THREE.PlaneGeometry(12, 12), floorMat, { rx: -Math.PI / 2, cast: false }));
  // back wall, with an opening for the window
  const L = -4, R = 1.65, H = 3;
  scene.add(
    plane(WIN.x0 - L, H, (L + WIN.x0) / 2, H / 2, WALL_Z),
    plane(R - WIN.x1, H, (WIN.x1 + R) / 2, H / 2, WALL_Z),
    plane(WIN.x1 - WIN.x0, WIN.y0, (WIN.x0 + WIN.x1) / 2, WIN.y0 / 2, WALL_Z),
    plane(WIN.x1 - WIN.x0, H - WIN.y1, (WIN.x0 + WIN.x1) / 2, (WIN.y1 + H) / 2, WALL_Z),
  );
  // right wall
  scene.add(plane(4, H, R, H / 2, WALL_Z + 2, -Math.PI / 2));

  // window: reveal (frame boards set into the wall), mullion, sill, roller blind; a soft
  // wood grain running along each board, and a rounded front edge on the sill
  const D = 0.12, t = 0.05;
  const cx = (WIN.x0 + WIN.x1) / 2, cy = (WIN.y0 + WIN.y1) / 2, w = WIN.x1 - WIN.x0, h = WIN.y1 - WIN.y0;
  const zIn = WALL_Z - D / 2;
  const grain = (vertical) =>
    canvasTexture(vertical ? 128 : 512, vertical ? 512 : 128, (ctx, gw, gh) => {
      const along = vertical ? gh : gw, across = vertical ? gw : gh;
      ctx.fillStyle = '#93582c';
      ctx.fillRect(0, 0, gw, gh);
      let seed = vertical ? 7 : 3;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 40; i++) {
        const c = across * rnd(), amp = 1 + rnd() * 3, freq = 0.006 + rnd() * 0.01, ph = rnd() * 6;
        ctx.strokeStyle = rnd() < 0.6 ? `rgba(80, 40, 15, ${0.04 + rnd() * 0.06})` : `rgba(180, 115, 65, ${0.03 + rnd() * 0.05})`;
        ctx.lineWidth = 0.6 + rnd() * 1.6;
        ctx.beginPath();
        for (let q = 0; q <= along; q += 8) {
          const p2 = c + Math.sin(q * freq + ph) * amp;
          vertical ? ctx.lineTo(p2, q) : ctx.lineTo(q, p2);
        }
        ctx.stroke();
      }
    });
  const woodH = mat('#ffffff', { roughness: 0.55, map: grain(false) });
  const woodV = mat('#ffffff', { roughness: 0.55, map: grain(true) });
  scene.add(
    mesh(new THREE.BoxGeometry(w, t, D), woodH, { x: cx, y: WIN.y1 - t / 2, z: zIn }),
    mesh(new THREE.BoxGeometry(w, t, D), woodH, { x: cx, y: WIN.y0 + t / 2, z: zIn }),
    mesh(new THREE.BoxGeometry(t, h, D), woodV, { x: WIN.x0 + t / 2, y: cy, z: zIn }),
    mesh(new THREE.BoxGeometry(t, h, D), woodV, { x: WIN.x1 - t / 2, y: cy, z: zIn }),
    mesh(new THREE.BoxGeometry(0.07, h, 0.06), woodV, { x: WIN.mull, y: cy, z: WALL_Z - D + 0.03 }),
    // sill: ends flush with the frame, rounded along its front edge
    mesh(new THREE.BoxGeometry(w, 0.03, 0.1), woodH, { x: cx, y: WIN.y0 - 0.015, z: WALL_Z + 0.03 }),
    mesh(new THREE.CylinderGeometry(0.015, 0.015, w, 20), woodH, { x: cx, y: WIN.y0 - 0.015, z: WALL_Z + 0.08, rz: Math.PI / 2 }),
    mesh(new THREE.BoxGeometry(w - 0.1, 0.05, 0.05), mat('#4a4d52', { roughness: 0.8 }), { x: cx, y: WIN.y1 - 0.08, z: WALL_Z - 0.03 }),
  );
  // The view: the owner's own trees, a day and an evening version of the same photo, as a
  // single picture well behind the glass (so it shifts a little as the camera moves, like a
  // real view). Unlit, so it reads as daylight; cover-fitted, keeping the bottom of the photo.
  const H2 = h * 1.25, W2 = w * 1.25;
  const loader = new THREE.TextureLoader();
  // which part of each photo: z = zoom (1 = as much of the photo as fits), x / y = where the
  // crop sits in the leftover room (0 = left / top, 1 = right / bottom)
  // both are the same photo (the evening one is the day photo graded to dusk), so both show
  // the same part: the bottom left, with the neighbour's roof
  const VIEW = { z: 1.6, x: 0, y: 1 };
  const CROP = { light: VIEW, dark: VIEW };
  const shot = (src, { z, x, y }) => {
    const t = loader.load(src, () => {
      const imgAsp = t.image.width / t.image.height, planeAsp = W2 / H2;
      // the largest plane-shaped part of the photo, in UV units, then zoomed in
      const rw = (imgAsp > planeAsp ? planeAsp / imgAsp : 1) / z;
      const rh = (imgAsp > planeAsp ? 1 : imgAsp / planeAsp) / z;
      t.repeat.set(rw, rh);
      t.offset.set((1 - rw) * x, (1 - rh) * (1 - y)); // UV y runs up from the bottom
    });
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const views = { light: shot('/room/window-light.jpg', CROP.light), dark: shot('/room/window-dark.jpg', CROP.dark) };
  const viewMat = new THREE.MeshBasicMaterial({ map: views.light, toneMapped: false });
  scene.add(note(mesh(new THREE.PlaneGeometry(W2, H2), viewMat, { x: cx, y: cy, z: WALL_Z - 0.45, cast: false, receive: false }), 'outside'));
  const setView = (theme) => {
    viewMat.map = views[theme === 'dark' ? 'dark' : 'light'];
  };

  bookcase(scene);
  cubeShelf(scene);
  return { wallMat, floorMat, setView };
}

// Tall light-oak bookcase, two columns, in the right corner.
function bookcase(scene) {
  const oak = mat('#c9a679', { roughness: 0.6 });
  const g = new THREE.Group();
  g.position.set(1.24, 0, WALL_Z + 0.16);
  const W = 0.78, H = 2.0, D = 0.3, T = 0.02;
  g.add(
    mesh(new THREE.BoxGeometry(T, H, D), oak, { x: -W / 2, y: H / 2 }),
    mesh(new THREE.BoxGeometry(T, H, D), oak, { x: W / 2, y: H / 2 }),
    mesh(new THREE.BoxGeometry(T, H, D), oak, { x: 0.06, y: H / 2 }),
    mesh(new THREE.BoxGeometry(W, T, D), oak, { y: H }),
    mesh(new THREE.BoxGeometry(W, H, 0.01), oak, { y: H / 2, z: -D / 2 }),
  );
  for (const y of [0.05, 0.42, 0.8, 1.18, 1.52]) g.add(mesh(new THREE.BoxGeometry(W, T, D), oak, { y }));
  // a few books, like the photo
  const colors = ['#b8322c', '#e7e2d6', '#2b2d31', '#c98a2b', '#f0eee8', '#1d3f63'];
  let x = -W / 2 + 0.03;
  colors.forEach((c, i) => {
    const bw = 0.03 + (i % 3) * 0.008, bh = 0.2 + ((i * 37) % 7) * 0.012;
    g.add(mesh(new THREE.BoxGeometry(bw, bh, 0.2), mat(c), { x: x + bw / 2, y: 1.18 + T / 2 + bh / 2 }));
    x += bw + 0.004;
  });
  g.add(mesh(new THREE.BoxGeometry(0.26, 0.03, 0.2), mat('#2b2d31'), { x: -0.2, y: 1.52 + 0.025 }));
  scene.add(g);
}

// Low white cube shelf along the right wall.
function cubeShelf(scene) {
  const white = mat('#f2f1ed', { roughness: 0.7 });
  const g = new THREE.Group();
  g.position.set(1.47, 0, 0.75);
  g.rotation.y = -Math.PI / 2;
  const W = 1.1, H = 1.1, D = 0.34, T = 0.025;
  for (let i = 0; i <= 3; i++) g.add(mesh(new THREE.BoxGeometry(T, H, D), white, { x: -W / 2 + (i * W) / 3, y: H / 2 }));
  for (let j = 0; j <= 3; j++) g.add(mesh(new THREE.BoxGeometry(W, T, D), white, { y: (j * H) / 3 + (j === 0 ? T / 2 : 0) }));
  scene.add(g);
}

function desk(scene) {
  const g = new THREE.Group();
  const white = mat('#f3f3f1', { roughness: 0.55 });
  g.add(mesh(new RoundedBoxGeometry(1.6, 0.035, 0.75, 2, 0.006), white, { y: TOP - 0.0175 }));
  // drawer unit on the left end, like the real desk; slim legs on the right
  g.add(mesh(new THREE.BoxGeometry(0.42, TOP - 0.035, 0.7), white, { x: -0.57, y: (TOP - 0.035) / 2 }));
  for (const y of [0.5, 0.25]) g.add(mesh(new THREE.BoxGeometry(0.4, 0.006, 0.006), mat('#d0d0cc'), { x: -0.57, y, z: 0.351 }));
  for (const z of [-0.33, 0.33]) g.add(mesh(new THREE.BoxGeometry(0.03, TOP - 0.035, 0.03), white, { x: 0.76, y: (TOP - 0.035) / 2, z }));
  scene.add(g);
}

function notebook() {
  const root = new THREE.Group();
  root.position.set(-0.6, TOP, 0.06);
  root.rotation.y = 0.14;
  const w = 0.2, d = 0.27;
  root.add(mesh(new THREE.BoxGeometry(w - 0.006, 0.012, d - 0.006), mat('#fbfaf6'), { y: 0.007 }));
  root.add(mesh(new THREE.BoxGeometry(w, 0.0015, d), mat('#1d3f63'), { y: 0.0008 }));
  // cover, hinged on its left edge so it can swing open
  const hinge = new THREE.Group();
  hinge.position.set(-w / 2, 0.0145, 0);
  const cover = mesh(new THREE.BoxGeometry(w, 0.0015, d), mat('#1d3f63', { roughness: 0.8 }), { x: w / 2 });
  const band = mesh(new THREE.BoxGeometry(0.008, 0.0017, d + 0.001), mat('#111'), { x: w - 0.03 });
  hinge.add(cover, band);
  root.add(hinge);
  // pen
  const pen = new THREE.Group();
  pen.position.set(0.118, 0.0045, 0.01);
  pen.rotation.y = 0.06;
  pen.add(mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 16), mat('#1d252d', { metalness: 0.3, roughness: 0.4 }), { rx: Math.PI / 2 }));
  root.add(pen);
  // the loose top page, the one that is taken out (Coursework) and put back
  const c = document.createElement('canvas');
  c.width = 388; c.height = 528;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbfaf6';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(0, 76, 151, 0.28)';
  for (let y = 40; y < c.height; y += 22) ctx.fillRect(0, y, c.width, 1.5);
  ctx.fillStyle = 'rgba(200, 60, 60, 0.4)';
  ctx.fillRect(46, 0, 1.5, c.height);
  const pageTex = new THREE.CanvasTexture(c);
  pageTex.colorSpace = THREE.SRGBColorSpace;
  const white = mat('#fbfaf6');
  const sheet = mesh(
    new THREE.BoxGeometry(w - 0.012, 0.0004, d - 0.01),
    [white, white, new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.9 }), white, white, white],
    { x: 0.002, y: 0.0134 },
  );
  root.add(sheet);
  const paper = { mesh: sheet, w: w - 0.012, h: d - 0.01, top: 0.0002, slide: { y: 0.035, z: 0.045, rx: 0.35 } };
  return { root: tag(root, 'coursework'), hinge, paper, anchor: new THREE.Vector3(0, 0.03, -0.06) };
}

function printout() {
  const root = new THREE.Group();
  root.position.set(-0.33, TOP + 0.003, 0.1); // resting on the desk mat (3 mm thick), not under it
  root.rotation.y = -0.07;
  const c = document.createElement('canvas');
  c.width = 420; c.height = 594;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 420, 594);
  ctx.fillStyle = '#1d252d';
  ctx.font = '700 30px "Instrument Sans", sans-serif';
  ctx.fillText('Resume', 36, 70);
  ctx.fillStyle = '#c9cdd0';
  for (let i = 0; i < 22; i++) ctx.fillRect(36, 110 + i * 20, i % 5 === 0 ? 150 : 250 + ((i * 37) % 90), 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  let sheet;
  for (let i = 0; i < 3; i++) {
    const m = i === 2 ? [mat('#fff'), mat('#fff'), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), mat('#fff'), mat('#fff'), mat('#fff')] : mat('#fdfdfb');
    sheet = mesh(new THREE.BoxGeometry(0.21, 0.0012, 0.297), m, { y: 0.0006 + i * 0.0013, x: (i - 1) * 0.002, ry: (i - 1) * 0.012 });
    root.add(sheet);
  }
  // binder clip holding the stack at the top edge; the top sheet is drawn out from under it
  const clip = new THREE.Group();
  clip.position.set(0, 0.0058, -0.1415);
  const black = mat('#16191c', { roughness: 0.35, metalness: 0.2 });
  const steel = mat('#b9bec4', { metalness: 0.9, roughness: 0.25 });
  clip.add(mesh(new THREE.BoxGeometry(0.05, 0.0034, 0.017), black, { z: 0.0015 }));
  clip.add(mesh(new THREE.BoxGeometry(0.05, 0.0075, 0.003), black, { y: -0.002, z: -0.0075 }));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0009, 6, 20, Math.PI), steel);
  handle.position.set(0, 0.0018, 0.009);
  handle.rotation.x = Math.PI / 2 - 0.2; // folded down toward the reader, slightly raised
  handle.castShadow = true;
  clip.add(handle);
  root.add(clip);
  const paper = { mesh: sheet, w: 0.21, h: 0.297, top: 0.0006, slide: { y: 0.004, z: 0.12, rx: 0 } };
  return { root: tag(root, 'resume'), paper, anchor: new THREE.Vector3(0, 0.02, -0.08) };
}

function macbook(theme) {
  const root = new THREE.Group();
  root.position.set(0, TOP, 0.0);
  const alu = mat('#8a8e93', { metalness: 0.6, roughness: 0.38 });
  const W = 0.312, D = 0.221, H = 0.0155;
  root.add(mesh(new RoundedBoxGeometry(W, H, D, 3, 0.005), alu, { y: H / 2 }));
  root.add(mesh(new THREE.BoxGeometry(0.27, 0.001, 0.1), mat('#1b1d20', { roughness: 0.9 }), { y: H + 0.0004, z: -0.03 }));
  root.add(mesh(new THREE.BoxGeometry(0.12, 0.0008, 0.075), mat('#7c8085', { metalness: 0.5, roughness: 0.3 }), { y: H + 0.0003, z: 0.065 }));
  const hinge = new THREE.Group();
  hinge.position.set(0, H, -D / 2);
  hinge.rotation.x = -0.32; // opened ~108°
  const lid = mesh(new RoundedBoxGeometry(W, 0.006, D, 3, 0.003), alu, { z: 0 });
  lid.rotation.x = Math.PI / 2;
  lid.position.set(0, D / 2, 0);
  const screenTex = laptopScreen(theme);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.018, D - 0.024),
    new THREE.MeshBasicMaterial({ map: screenTex }),
  );
  screen.position.set(0, D / 2 + 0.002, 0.0046);
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.004, D - 0.004), mat('#0d0e10', { roughness: 0.4 }));
  bezel.position.set(0, D / 2, 0.0038);
  screen.userData.noHull = bezel.userData.noHull = true;
  hinge.add(lid, bezel, screen);
  root.add(hinge);
  return { root: tag(root, 'works'), screen, anchor: new THREE.Vector3(0, 0.25, -0.12) };
}

function roundedRect(w, h, r) {
  const sh = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  sh.moveTo(x + r, y);
  sh.lineTo(x + w - r, y);
  sh.quadraticCurveTo(x + w, y, x + w, y + r);
  sh.lineTo(x + w, y + h - r);
  sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  sh.lineTo(x + r, y + h);
  sh.quadraticCurveTo(x, y + h, x, y + h - r);
  sh.lineTo(x, y + r);
  sh.quadraticCurveTo(x, y, x + r, y);
  return sh;
}

// Flat rounded-rectangle surface lying face-up, UVs 0..1 across it (for screen textures).
function flatRounded(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 12);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + w / 2) / w, (uv.getY(i) + h / 2) / h);
  g.rotateX(-Math.PI / 2);
  return g;
}

// iPhone lying face up: rounded titanium body, black glass, rounded screen with Dynamic Island.
function iphone(contact) {
  const root = new THREE.Group();
  root.position.set(0.27, TOP, 0.13);
  root.rotation.y = -0.28;
  const W = 0.0716, H = 0.1476, R = 0.0105;
  const bodyGeo = new THREE.ExtrudeGeometry(roundedRect(W - 0.002, H - 0.002, R), {
    depth: 0.0055, bevelEnabled: true, bevelThickness: 0.0014, bevelSize: 0.001, bevelSegments: 5, curveSegments: 20,
  });
  bodyGeo.rotateX(-Math.PI / 2);
  bodyGeo.center();
  root.add(mesh(bodyGeo, mat('#5b5f64', { metalness: 0.75, roughness: 0.3 }), { y: 0.00415 }));
  // side buttons
  const btn = mat('#54585d', { metalness: 0.75, roughness: 0.3 });
  root.add(mesh(new THREE.BoxGeometry(0.0012, 0.0024, 0.016), btn, { x: W / 2 + 0.0002, y: 0.0042, z: -0.022 }));
  root.add(mesh(new THREE.BoxGeometry(0.0012, 0.0024, 0.01), btn, { x: -W / 2 - 0.0002, y: 0.0042, z: -0.03 }));
  root.add(mesh(new THREE.BoxGeometry(0.0012, 0.0024, 0.01), btn, { x: -W / 2 - 0.0002, y: 0.0042, z: -0.017 }));
  // black glass front, then the screen inset with rounded corners
  const glass = mesh(flatRounded(W - 0.0016, H - 0.0016, R - 0.0008), new THREE.MeshStandardMaterial({ color: '#050607', roughness: 0.12, metalness: 0.2 }), { y: 0.00835, cast: false });
  const off = phoneScreen(false, contact);
  const on = { light: phoneScreen(true, contact, 'light'), dark: phoneScreen(true, contact, 'dark') };
  let lit = false, theme = 'light';
  const show = () => {
    screen.material.map = lit ? on[theme] : off;
    screen.material.needsUpdate = true;
  };
  const screen = mesh(flatRounded(W - 0.0062, H - 0.0062, R - 0.003), new THREE.MeshBasicMaterial({ map: off, toneMapped: false }), { y: 0.00845, cast: false });
  glass.userData.noHull = screen.userData.noHull = true;
  root.add(glass, screen);
  return {
    root: tag(root, 'contact'),
    anchor: new THREE.Vector3(0, 0.02, -0.04),
    setOn(v) {
      lit = v;
      show();
    },
    setTheme(t) {
      theme = t;
      show();
    },
  };
}

// Desk lamp: the cone-shade design in orange (the owner's lamp colour). A weighted, turned
// base with a push switch; two arms with knuckle joints and screw heads; a double-walled
// shade (orange outside, cream inside) with a rolled rim and a bulb socket; and a cord that
// runs to the back of the desk through an inline switch, then drops behind it.
function lamp() {
  const root = new THREE.Group();
  root.position.set(0.72, TOP, -0.22);
  root.rotation.y = -0.5;
  const orange = new THREE.MeshPhysicalMaterial({ color: '#e4602a', roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 });
  const steel = mat('#c9ccd0', { metalness: 0.9, roughness: 0.28 });
  const dark = mat('#2a2b2e', { metalness: 0.5, roughness: 0.4 });

  // base: a turned disc with a chamfered edge, a felt pad under it
  const prof = [[0, 0], [0.064, 0], [0.0655, 0.0025], [0.0645, 0.0095], [0.06, 0.0135], [0.016, 0.015], [0, 0.015]].map(([x, y]) => new THREE.Vector2(x, y));
  root.add(mesh(new THREE.LatheGeometry(prof, 64), orange, { y: 0.0006 }));
  root.add(fine(mesh(new THREE.CylinderGeometry(0.061, 0.061, 0.0008, 48), mat('#3b3530', { roughness: 1 }), { y: 0.0003, cast: false })));
  // push switch near the front of the base
  root.add(fine(mesh(new THREE.CylinderGeometry(0.0075, 0.008, 0.003, 28), steel, { y: 0.0165, z: 0.038 })));
  root.add(fine(mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.0035, 28), mat('#f1ede4', { roughness: 0.4 }), { y: 0.0185, z: 0.038 })));

  // arms between explicit joints
  const B = new THREE.Vector3(0, 0.026, -0.008), E = new THREE.Vector3(0, 0.34, 0.045);
  const head = new THREE.Group();
  head.position.set(0, 0.44, 0.26);
  head.rotation.x = -0.55; // opening toward the desk, the same way the light falls
  const apex = new THREE.Vector3(0, 0.062, 0).applyEuler(head.rotation).add(head.position);
  const up = new THREE.Vector3(0, 1, 0);
  const rod = (a, b2, r) => {
    const d = new THREE.Vector3().subVectors(b2, a);
    const m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 16), orange);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(up, d.normalize());
    return m;
  };
  root.add(rod(B, E, 0.0052), rod(E, apex, 0.0048));
  // collar where the arm meets the base
  root.add(mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.012, 28), orange, { y: 0.02, z: -0.008 }));
  // knuckles (hinge across x) with screw heads at both ends
  const knuckle = (at, r, len) => {
    const k = new THREE.Group();
    k.position.copy(at);
    k.add(mesh(new THREE.CylinderGeometry(r, r, len, 20), orange, { rz: Math.PI / 2 }));
    for (const sx of [1, -1]) {
      k.add(fine(mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.0016, 16), steel, { x: sx * (len / 2 + 0.0008), rz: Math.PI / 2 })));
      k.add(fine(mesh(new THREE.BoxGeometry(0.0004, r * 0.9, 0.0007), dark, { x: sx * (len / 2 + 0.0017) })));
    }
    return k;
  };
  root.add(knuckle(B, 0.0075, 0.018), knuckle(E, 0.0072, 0.017), knuckle(apex, 0.0066, 0.016));

  // shade: outer orange, inner cream, rolled rim, cap at the top, socket and bulb inside
  head.add(mesh(new THREE.ConeGeometry(0.06, 0.1, 48, 1, true), orange));
  const inner = new THREE.ConeGeometry(0.0582, 0.097, 48, 1, true);
  inner.translate(0, 0.0015, 0);
  head.add(fine(mesh(inner, mat('#f3ede2', { roughness: 0.6, side: THREE.BackSide }), { cast: false })));
  head.add(fine(mesh(new THREE.TorusGeometry(0.0592, 0.0014, 10, 64), orange, { y: -0.0496, rx: Math.PI / 2 })));
  head.add(mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.014, 24), orange, { y: 0.054 }));
  head.add(fine(mesh(new THREE.CylinderGeometry(0.0115, 0.0105, 0.026, 24), mat('#efe9df', { roughness: 0.5 }), { y: 0.012, cast: false })));
  head.add(fine(mesh(new THREE.TorusGeometry(0.0112, 0.0009, 6, 24), steel, { y: -0.001, rx: Math.PI / 2, cast: false })));
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff4dc', emissive: '#ffd9a0', emissiveIntensity: 0 });
  head.add(fine(mesh(new THREE.SphereGeometry(0.022, 24, 16), bulbMat, { y: -0.03, cast: false })));
  root.add(head);

  // cord: out of the back of the base, across the desk through an inline switch, over the edge
  root.updateMatrixWorld(true);
  const local = (x, y, z) => root.worldToLocal(new THREE.Vector3(x, y, z));
  const cordPts = [
    new THREE.Vector3(0, 0.004, -0.064),
    new THREE.Vector3(0, 0.0025, -0.085),
    local(0.758, TOP + 0.0025, -0.31),
    local(0.752, TOP + 0.0025, -0.35),
    local(0.748, TOP + 0.001, -0.373),
    local(0.746, TOP - 0.012, -0.384),
    local(0.744, TOP - 0.06, -0.39),
    local(0.742, TOP - 0.4, -0.392),
  ];
  const curve = new THREE.CatmullRomCurve3(cordPts, false, 'centripetal');
  const cordMat = mat('#efebe4', { roughness: 0.7 });
  root.add(fine(mesh(new THREE.TubeGeometry(curve, 120, 0.0022, 8), cordMat)));
  const swAt = curve.getPointAt(0.3), swDir = curve.getTangentAt(0.3);
  const sw = mesh(new RoundedBoxGeometry(0.014, 0.008, 0.032, 2, 0.003), cordMat);
  sw.position.copy(swAt).add(new THREE.Vector3(0, 0.0015, 0));
  sw.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(swDir.x, 0, swDir.z).normalize());
  sw.add(mesh(new THREE.BoxGeometry(0.007, 0.002, 0.009), mat('#d8d2c7', { roughness: 0.5 }), { y: 0.0045 }));
  root.add(fine(sw));

  const light = new THREE.SpotLight('#ffd9a8', 0, 3.2, 0.75, 0.6, 1.6);
  light.position.set(0, 0.42, 0.27);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.0005;
  const target = new THREE.Object3D();
  target.position.set(-0.25, -0.2, 0.55);
  root.add(light, target);
  light.target = target;
  return { root: tag(root, 'lamp'), light, bulbMat, anchor: new THREE.Vector3(0, 0.52, 0.2) };
}

// --- Photos on the wall ↔ About sphere ------------------------------------------------------
function photos(items) {
  const urls = items.map((p) => p.thumb || p.src);
  const wall = new THREE.Group();
  wall.position.set(0.44, 1.15, -0.415);
  const list = urls.length ? urls : Array.from({ length: 18 }, () => null);
  const n = list.length;
  // a wide salon-style cluster: ~2:1, at most 0.66 m wide and 0.36 m tall
  const cols = Math.ceil(Math.sqrt(n * 2));
  const rows = Math.ceil(n / cols);
  const cell = Math.min(0.66 / cols, 0.36 / (rows * 1.3));
  const loader = new THREE.TextureLoader();
  const frames = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;

  list.forEach((url, i) => {
    const frame = new THREE.Group();
    const w = cell * 0.82, h = w * 1.25;
    const border = mesh(new THREE.PlaneGeometry(w + 0.012, h + 0.012), mat('#ffffff', { roughness: 0.8, side: THREE.DoubleSide }), { cast: false });
    const picMat = new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide, map: url ? null : photoPlaceholder(i) });
    const pic = mesh(new THREE.PlaneGeometry(w, h), picMat, { z: 0.0008, cast: false });
    pic.userData.noHull = true;
    if (url) {
      loader.load('/' + url.replace(/^\.?\//, ''), (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        picMat.map = t;
        picMat.needsUpdate = true;
        const a = t.image.width / t.image.height; // keep the photo's own aspect ratio
        pic.scale.set(Math.min(1, a / 0.8), Math.min(1, 0.8 / a), 1);
        border.scale.copy(pic.scale);
      });
    }
    border.userData.photo = pic.userData.photo = i;
    frame.add(border, pic);
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? n - r * cols : cols; // centre a short last row
    const c = i % cols;
    frame.position.set((c - (inRow - 1) / 2) * cell + rnd() * cell * 0.15, ((rows - 1) / 2 - r) * cell * 1.3 + rnd() * cell * 0.15, 0.002);
    frame.rotation.z = rnd() * 0.08;
    frame.userData.wall = { p: frame.position.clone(), q: frame.quaternion.clone() };
    wall.add(frame);
    frames.push(frame);
  });

  const sphere = new THREE.Group();
  sphere.position.set(0.28, 1.2, -0.04); // in front of the wall, clear of the lamp
  // scattered at random angles and sizes, never overlapping (see sphereLayout.js); the prints
  // are a quarter bigger on the sphere than on the wall, so it reads dense like a ball of photos
  const BIG = 1.25;
  const { poses } = sphereLayout(n, (cell * 0.82 + 0.012) * BIG, (cell * 0.82 * 1.25 + 0.012) * BIG);

  let open = false;
  let settled = false; // every print has arrived on the sphere (hover is off until then)
  let moveId = 0;
  let spin = 0.15, tilt = 0; // yaw / pitch speed (rad/s); yaw settles back to a slow idle spin
  const qa = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);

  function tween(frame, toP, toQ, toS, delay, onComplete) {
    frame.userData.tw?.kill(); // a move the other way that hasn't finished
    gsap.killTweensOf(frame.scale); // a hover pop
    frame.userData.size = toS; // its resting size, for the hover pop to grow from
    const fromP = frame.position.clone();
    const fromQ = frame.quaternion.clone();
    const fromS = frame.scale.x;
    const o = { t: 0 };
    frame.userData.tw = gsap.to(o, {
      t: 1, duration: 1.4, delay, ease: 'expo.inOut', onComplete,
      onUpdate() {
        frame.position.lerpVectors(fromP, toP, o.t);
        frame.quaternion.slerpQuaternions(fromQ, toQ, o.t);
        frame.scale.setScalar(fromS + (toS - fromS) * o.t);
      },
    });
  }

  return {
    wall, sphere, frames,
    root: tag(wall, 'about'),
    anchor: new THREE.Vector3(0, 0.26, 0.02),
    toSphere() {
      if (open) return;
      open = true;
      settled = false;
      const my = ++moveId;
      sphere.rotation.set(0, 0, 0);
      frames.forEach((f, i) => {
        sphere.attach(f);
        const last = i === frames.length - 1; // it starts last, so it lands last
        tween(f, poses[i].p, poses[i].q, poses[i].s * BIG, i * 0.03, last ? () => (settled = my === moveId) : undefined);
      });
    },
    toWall() {
      if (!open) return;
      open = false;
      settled = false;
      ++moveId;
      frames.forEach((f, i) => {
        wall.attach(f);
        tween(f, f.userData.wall.p, f.userData.wall.q, 1, i * 0.02);
      });
    },
    get settled() {
      return settled;
    },
    // drag sideways spins it, drag (or scroll) up and down tumbles it over
    drag(dx, dy = 0) {
      spin += dx * 0.004;
      tilt += dy * 0.004;
    },
    update(dt) {
      if (!open) return;
      spin += (0.15 - spin) * Math.min(1, dt * 1.5);
      tilt -= tilt * Math.min(1, dt * 1.5);
      // about the world axes, so "up" is always up on screen however it has turned
      sphere.quaternion.premultiply(qa.setFromAxisAngle(AY, spin * dt));
      sphere.quaternion.premultiply(qa.setFromAxisAngle(AX, tilt * dt));
    },
  };
}

// A black wireless mouse: a sculpted shell (higher at the back, narrower at the front),
// split buttons, a scroll wheel, and a thin grey base.
function computerMouse() {
  const g = new THREE.Group();
  g.position.set(0.3, TOP + 0.003, -0.08);
  g.rotation.y = 0.12;
  const geo = new THREE.SphereGeometry(1, 56, 32, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = -z; // +1 at the front (away from the user), -1 at the palm end
    const width = 1 - 0.2 * Math.max(0, f) + 0.04 * Math.max(0, -f);
    const height = 1 - 0.42 * Math.pow(Math.max(0, f), 1.4) - 0.12 * Math.pow(Math.max(0, -f), 2);
    p.setXYZ(i, x * width, y * height, z);
  }
  geo.computeVertexNormals();
  const shell = mesh(geo, mat('#1b1d20', { roughness: 0.5, metalness: 0.05 }), { y: 0.0018 });
  shell.scale.set(0.031, 0.025, 0.058);
  const base = mesh(new THREE.CylinderGeometry(1, 1, 1, 48), mat('#4a4d52', { roughness: 0.6 }), { y: 0.001 });
  base.scale.set(0.0305, 0.002, 0.0572);
  // seam between the buttons, following the slope of the shell, and the wheel in it
  const seam = mesh(new THREE.BoxGeometry(0.0009, 0.0012, 0.03), mat('#050506'), { y: 0.0175, z: -0.034, rx: -0.33 });
  const wheel = mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.0032, 24), mat('#6b6f75', { roughness: 0.45, metalness: 0.4 }), { y: 0.0195, z: -0.028, rz: Math.PI / 2 });
  g.add(base, shell, seam, wheel);
  return g;
}

// Stickerless 3x3 speed cube (solved): 27 cubies in coloured plastic, tiny gaps between them.
function speedCube() {
  const g = new THREE.Group();
  const s = 0.0185, gap = 0.0006;
  const col = { px: '#2f6fd6', nx: '#2fa04f', py: '#e03a2d', ny: '#f07b22', pz: '#f6cc1f', nz: '#f4f3ef' };
  const inner = mat('#3a3a3a', { roughness: 0.6 });
  const face = {};
  for (const [k, c] of Object.entries(col)) face[k] = mat(c, { roughness: 0.32 });
  const geo = new RoundedBoxGeometry(s - gap, s - gap, s - gap, 2, 0.0022);
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        // BoxGeometry material order: +x, -x, +y, -y, +z, -z
        const m = [i === 1 ? face.px : inner, i === -1 ? face.nx : inner, j === 1 ? face.py : inner, j === -1 ? face.ny : inner, k === 1 ? face.pz : inner, k === -1 ? face.nz : inner];
        g.add(mesh(geo, m, { x: i * s, y: s * 1.5 + j * s, z: k * s }));
      }
  return g;
}

function decor(scene) {
  // Things from the real room. No id → never hover or click.
  const add = (...m) => scene.add(...m);
  // desk mat
  add(mesh(new RoundedBoxGeometry(0.62, 0.003, 0.32, 2, 0.0015), mat('#2a2d31', { roughness: 0.95 }), { x: 0.06, y: TOP + 0.0015, z: -0.02, cast: false }));
  add(note(computerMouse(), 'mouse'));
  // window sill: the speed cube with the little white duckling standing on it
  const sill = new THREE.Group();
  sill.position.set(-0.2, WIN.y0 + 0.001, WALL_Z + 0.03);
  sill.rotation.y = -0.5; // yellow face to the front, blue on the right, like the photo
  const cube = speedCube();
  const duck = duckling();
  duck.position.set(-0.1, 0, 0.05); // beside the cube with some space; z keeps it on the sill (the group is turned)
  duck.rotation.y = -1.0; // in profile, facing left: bill, chest and tail read as a duck
  sill.add(note(cube, 'cube'), note(duck, 'duck'));
  add(sill);
}

// Hover outline: an "inverted hull" behind every mesh of a nav object: a copy grown by a
// constant thickness, drawn back-faces only in PNU Blue. Depth-correct and solid on light
// backgrounds. Flat planes get a slightly larger plane just behind them instead.
const hullMat = new THREE.MeshBasicMaterial({ color: '#004c97', side: THREE.BackSide });
const hullPlaneMat = new THREE.MeshBasicMaterial({ color: '#004c97', side: THREE.DoubleSide });
function addHulls(root, t = 0.0024) {
  const hulls = [];
  const meshes = [];
  root.traverse((o) => o.isMesh && !o.userData.hull && !o.userData.noHull && meshes.push(o));
  for (const m of meshes) {
    m.geometry.computeBoundingBox();
    const s = new THREE.Vector3();
    m.geometry.boundingBox.getSize(s);
    const flat = Math.min(s.x, s.y, s.z) < 1e-5;
    const h = new THREE.Mesh(m.geometry, flat ? hullPlaneMat : hullMat);
    h.userData.hull = true;
    h.raycast = () => {};
    h.visible = false;
    if (flat) {
      h.scale.set(1 + (2 * t) / Math.max(s.x, 1e-3), 1 + (2 * t) / Math.max(s.y, 1e-3), 1);
      h.position.z = -0.0007;
    } else {
      h.scale.set(1 + (2 * t) / s.x, 1 + (2 * t) / s.y, 1 + (2 * t) / s.z);
    }
    m.add(h);
    hulls.push(h);
  }
  return hulls;
}

export function setHullColor(c) {
  hullMat.color.set(c);
  hullPlaneMat.color.set(c);
}

export function buildDesk({ theme, content }) {
  const scene = new THREE.Scene();
  const { wallMat, floorMat, setView } = room(scene);
  desk(scene);
  decor(scene);

  const objects = {
    coursework: notebook(),
    resume: printout(),
    works: macbook(theme),
    contact: iphone(content.contact),
    about: photos(content.about.photos),
    lamp: lamp(),
  };
  for (const o of Object.values(objects)) {
    scene.add(o.root);
    o.hulls = addHulls(o.root);
  }
  scene.add(objects.about.sphere);

  const hemi = new THREE.HemisphereLight('#ffffff', '#cfc7bb', 1.2);
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(-1.6, 3.2, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1.2; sun.shadow.camera.right = 1.2;
  sun.shadow.camera.top = 1.2; sun.shadow.camera.bottom = -1.2;
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0004;
  scene.add(hemi, sun);

  function setTheme(t, animate = true) {
    const dark = t === 'dark';
    const d = animate ? 0.9 : 0;
    gsap.to(hemi, { intensity: dark ? 0.16 : 1.2, duration: d });
    gsap.to(sun, { intensity: dark ? 0.12 : 2.2, duration: d });
    gsap.to(objects.lamp.light, { intensity: dark ? 7 : 0, duration: d });
    gsap.to(objects.lamp.bulbMat, { emissiveIntensity: dark ? 3 : 0, duration: d });
    objects.contact.setTheme(t);
    if (!objects.works.screen.userData.live) {
      objects.works.screen.material.map = laptopScreen(t);
      objects.works.screen.material.needsUpdate = true;
    }
    const bg = new THREE.Color(dark ? '#1d252d' : '#f7f7f5');
    scene.background = bg;
    wallMat.color.set(dark ? '#c9c1b3' : '#ece5d8');
    floorMat.color.set(dark ? '#b8ae9e' : '#cbc2b3');
    setView(t); // the evening photo after dark
  }
  setTheme(theme, false);

  return { scene, objects, setTheme, update: (dt) => objects.about.update(dt) };
}
