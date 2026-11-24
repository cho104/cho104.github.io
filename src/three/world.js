// One renderer and camera for the whole site. Two scenes: the desk, and the space inside the
// MacBook (works ring). Routes move the camera between "shots".
import * as THREE from 'three';
import { gsap } from 'gsap';
import { buildDesk, setHullColor } from './desk.js';
import { buildWorks } from './works.js';

const NAV_IDS = ['coursework', 'resume', 'works', 'contact', 'about', 'lamp'];

// Camera shots: [position, look-at target, fov]
const SHOTS = {
  home: [[0, 1.34, 1.36], [0, 1.0, -0.12], 36],
  coursework: [[-0.48, 1.3, 0.56], [-0.6, 0.76, 0.0], 34],
  resume: [[-0.3, 1.18, 0.55], [-0.33, 0.76, 0.06], 34],
  contact: [[0.1, 1.16, 0.66], [0.26, 0.77, 0.1], 32],
  about: [[0.02, 1.24, 0.82], [0.17, 1.19, -0.04], 34],
};

export function createWorld({ canvas, content, theme, on }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 200);
  const look = new THREE.Vector3();

  const desk = buildDesk({ theme, content });
  const works = buildWorks({ content, theme, renderer });
  works.setTheme(theme);

  // Live MacBook screen: the works ring rendered from inside, every frame.
  const screenRT = new THREE.WebGLRenderTarget(1024, 688, { samples: 4 });
  const screenCam = new THREE.PerspectiveCamera(46, 1024 / 688, 0.01, 200);
  screenCam.position.set(0, 0.15, 0);
  screenCam.lookAt(0, 0, -1);
  const screen = desk.objects.works.screen;
  screen.material.map = screenRT.texture;
  screen.material.needsUpdate = true;
  screen.userData.live = true;

  setHullColor(theme === 'dark' ? '#4d8fe0' : '#004c97');

  let mode = 'desk'; // 'desk' | 'works'
  let route = 'home';
  let hot = null; // hovered nav object id
  let travel = 0; // 0 = home shot, 1 = camera at the MacBook screen (scroll-driven)
  let scrollDriven = false; // the camera follows `travel` only while the user is scrolling on the desk
  let busy = false;

  // --- camera helpers -----------------------------------------------------------------------
  const pos = new THREE.Vector3(...SHOTS.home[0]);
  const tgt = new THREE.Vector3(...SHOTS.home[1]);
  camera.position.copy(pos);
  camera.lookAt(tgt);

  function screenShot() {
    const s = desk.objects.works.screen;
    s.updateWorldMatrix(true, false);
    const c = new THREE.Vector3().setFromMatrixPosition(s.matrixWorld);
    const n = new THREE.Vector3(0, 0, 1).transformDirection(s.matrixWorld);
    // close enough that the screen's height exactly fills the view
    const h = s.geometry.parameters.height;
    const d = h / 2 / Math.tan(THREE.MathUtils.degToRad(36 / 2));
    return [c.clone().addScaledVector(n, d), c, 36];
  }

  // Shots are framed for a 16:10 window; narrower windows pull the camera back so the
  // same things stay in view.
  function fit(shot) {
    const [p, t, fov] = shot;
    const k = Math.min(2.2, Math.max(1, 1.6 / camera.aspect));
    if (k === 1 || !Array.isArray(p)) return shot;
    const tv = new THREE.Vector3(...t);
    const pv = new THREE.Vector3(...p).sub(tv).multiplyScalar(k).add(tv);
    return [pv.toArray(), t, fov];
  }

  function shotTween(shot, duration = 1.4, ease = 'expo.inOut') {
    const [p, t, fov] = fit(shot);
    scrollDriven = false;
    gsap.killTweensOf([pos, tgt, camera]);
    return Promise.all([
      gsap.to(pos, { x: p[0] ?? p.x, y: p[1] ?? p.y, z: p[2] ?? p.z, duration, ease }),
      gsap.to(tgt, { x: t[0] ?? t.x, y: t[1] ?? t.y, z: t[2] ?? t.z, duration, ease }),
      gsap.to(camera, { fov, duration, ease, onUpdate: () => camera.updateProjectionMatrix() }),
    ]);
  }

  // Home ↔ screen interpolation driven by scroll (travel 0..1).
  function applyTravel() {
    const [hp, ht] = fit(SHOTS.home);
    const [sp, st] = screenShot();
    const e = travel * travel * (3 - 2 * travel);
    pos.set(...hp).lerp(sp, e);
    tgt.set(...ht).lerp(st, e);
  }

  // --- entering / leaving the MacBook ---------------------------------------------------------
  // Into / out of the MacBook. The screen shows the works ring from the very camera used
  // inside, so when the screen fills the view the two images line up; the desk around it
  // dissolves (works rendered to a texture and faded over the desk), then the scenes swap.
  const WORKS_POS = new THREE.Vector3(0, 0.15, 0);
  const WORKS_TGT = new THREE.Vector3(0, 0, -1);
  const WORKS_FOV = 46;
  const worksCam = new THREE.PerspectiveCamera(WORKS_FOV, 1, 0.01, 200);
  worksCam.position.copy(WORKS_POS);
  worksCam.lookAt(WORKS_TGT);
  const fullRT = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
  const fadeMat = new THREE.MeshBasicMaterial({ map: fullRT.texture, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  const fadeScene = new THREE.Scene();
  fadeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fadeMat));
  const fadeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  async function enterWorks() {
    if (mode === 'works') return;
    busy = true;
    await shotTween(screenShot(), 1.15, 'power2.inOut');
    await gsap.to(fadeMat, { opacity: 1, duration: 0.4, ease: 'power1.inOut' });
    mode = 'works';
    travel = 0;
    lastIndex = -1;
    works.resetPull();
    pos.copy(WORKS_POS);
    tgt.copy(WORKS_TGT);
    camera.fov = WORKS_FOV;
    camera.updateProjectionMatrix();
    fadeMat.opacity = 0;
    busy = false;
  }

  // Reverse: start at the screen with the works view on top, dissolve it, and the camera
  // pulls back from the MacBook (the caller tweens to the next shot right away).
  function leaveWorks() {
    if (mode !== 'works') return;
    mode = 'desk';
    const [sp, st] = screenShot();
    pos.copy(sp);
    tgt.copy(st);
    camera.fov = 36;
    camera.updateProjectionMatrix();
    fadeMat.opacity = 1;
    gsap.to(fadeMat, { opacity: 0, duration: 0.5, delay: 0.05, ease: 'power1.inOut' });
  }

  // --- routes ---------------------------------------------------------------------------------
  async function setRoute(next) {
    const prev = route;
    route = next;
    setHot(null);
    if (prev === 'about' && next !== 'about') {
      setPhoto(-1);
      desk.objects.about.toWall();
    }
    if (prev === 'contact') desk.objects.contact.setOn(false);
    if (prev === 'coursework') gsap.to(desk.objects.coursework.hinge.rotation, { z: 0, duration: 1, ease: 'power3.inOut' });
    if (prev === 'resume') gsap.to(desk.objects.resume.root.position, { y: 0.75, duration: 0.9, ease: 'power3.inOut' });

    if (next === 'works') return enterWorks();
    if (mode === 'works') leaveWorks();

    if (next === 'home') {
      travel = 0;
      return shotTween(SHOTS.home, 1.3);
    }
    const shot = SHOTS[next];
    if (!shot) return;
    const move = shotTween(shot, 1.3);
    if (next === 'about') setTimeout(() => desk.objects.about.toSphere(), 350);
    if (next === 'contact') setTimeout(() => desk.objects.contact.setOn(true), 600);
    if (next === 'coursework') gsap.to(desk.objects.coursework.hinge.rotation, { z: Math.PI * 0.97, duration: 1.2, delay: 0.5, ease: 'power3.inOut' });
    if (next === 'resume') gsap.to(desk.objects.resume.root.position, { y: 0.86, duration: 1.1, delay: 0.2, ease: 'power3.inOut' });
    return move;
  }

  // --- hover / picking -------------------------------------------------------------------------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(9, 9);
  let pointerInside = false;

  // Hover: outline (hull) + a small lift. Only the objects whose state changes are touched,
  // so this never fights route animations (e.g. the resume printout lifting).
  function setHot(id) {
    if (hot === id) return;
    const prev = hot;
    hot = id;
    for (const k of NAV_IDS) for (const h of desk.objects[k].hulls) h.visible = k === id;
    const lift = (k, up) => {
      if (!k || k === 'about') return;
      const r = desk.objects[k].root;
      r.userData.baseY ??= r.position.y;
      gsap.to(r.position, { y: r.userData.baseY + (up ? 0.012 : 0), duration: 0.35, ease: 'power2.out' });
    };
    lift(prev, false);
    lift(id, true);
    canvas.style.cursor = id ? 'pointer' : '';
    on.hover?.(id);
  }

  function pick() {
    ray.setFromCamera(ndc, camera);
    if (mode === 'desk') {
      const hits = ray.intersectObjects(desk.scene.children, true);
      const hit = hits.find((h) => NAV_IDS.includes(h.object.userData.id));
      return { id: hit?.object.userData.id ?? null, photo: hit?.object.userData.photo };
    }
    const hits = ray.intersectObjects(works.panels.map((p) => p.mesh), false);
    const h = hits[0]?.object.userData;
    return h ? { id: 'project', slug: h.slug, index: h.index } : { id: null };
  }

  // About: hovering a photo on the sphere enlarges it and shows its caption.
  let photoHot = -1;
  const pointer = { x: 0, y: 0 };
  function setPhoto(i) {
    if (photoHot !== i) {
      const frames = desk.objects.about.frames;
      if (frames[photoHot]) gsap.to(frames[photoHot].scale, { x: 1, y: 1, z: 1, duration: 0.3 });
      if (frames[i]) gsap.to(frames[i].scale, { x: 1.18, y: 1.18, z: 1.18, duration: 0.3, ease: 'back.out(2)' });
      photoHot = i;
      canvas.style.cursor = i >= 0 ? 'pointer' : 'grab';
    }
    on.photo?.(i, pointer);
  }

  let down = null;
  canvas.addEventListener('pointermove', (e) => {
    pointerInside = true;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (down) {
      const dx = e.clientX - down.x;
      down.x = e.clientX;
      down.moved += Math.abs(dx);
      if (mode === 'works') works.drag(dx);
      else if (route === 'about') desk.objects.about.drag(dx);
    }
  });
  canvas.addEventListener('pointerleave', () => {
    pointerInside = false;
    if (route === 'home') setHot(null);
    works.hover(-1);
  });
  const setNdc = (e) => ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  canvas.addEventListener('pointerdown', (e) => {
    setNdc(e);
    down = { x: e.clientX, moved: 0 };
  });
  window.addEventListener('pointerup', (e) => {
    if (e.target === canvas) setNdc(e); // pick exactly where the click happened
    const wasClick = down && down.moved < 6;
    down = null;
    if (!wasClick || busy) return;
    const p = pick();
    if (mode === 'desk' && p.id) on.pick?.(p.id);
    if (mode === 'works' && p.slug) on.project?.(p.slug);
  });

  window.addEventListener(
    'wheel',
    (e) => {
      if (busy || on.wheelBlocked?.()) return;
      const dy = Math.max(-120, Math.min(120, e.deltaY));
      if (mode === 'works' && route === 'works') {
        if (works.wheel(dy)) on.navigate?.('/');
        return;
      }
      if (route !== 'home') return;
      travel = THREE.MathUtils.clamp(travel + dy * 0.0012, 0, 1);
      scrollDriven = true;
      on.travel?.(travel);
      if (travel >= 1) on.navigate?.('/works');
    },
    { passive: true },
  );

  // --- loop -----------------------------------------------------------------------------------
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    worksCam.aspect = w / h;
    worksCam.updateProjectionMatrix();
    fullRT.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  }
  addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  let lastIndex = -1;
  const v = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (mode === 'desk' && route === 'home' && scrollDriven) applyTravel();
    camera.position.copy(pos);
    look.copy(tgt);
    camera.lookAt(look);

    if (pointerInside && !down && !busy) {
      const p = pick();
      if (mode === 'desk' && route === 'home') setHot(p.id);
      if (mode === 'desk' && route === 'about') setPhoto(p.id === 'about' ? (p.photo ?? -1) : -1);
      if (mode === 'works') {
        works.hover(p.index ?? -1);
        canvas.style.cursor = p.slug ? 'pointer' : 'grab';
      }
    }

    if (mode === 'desk') {
      desk.update(dt);
      works.preview();
      renderer.setRenderTarget(screenRT);
      renderer.render(works.scene, screenCam);
      renderer.setRenderTarget(null);
      renderer.render(desk.scene, camera);
      if (fadeMat.opacity > 0) {
        renderer.setRenderTarget(fullRT);
        renderer.render(works.scene, worksCam);
        renderer.setRenderTarget(null);
        renderer.autoClear = false;
        renderer.render(fadeScene, fadeCam);
        renderer.autoClear = true;
      }
      if (hot && on.labelAt) {
        const o = desk.objects[hot];
        v.copy(o.anchor);
        o.root.localToWorld(v);
        v.project(camera);
        on.labelAt({ x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight });
      }
    } else {
      works.update(dt);
      if (works.index !== lastIndex) {
        lastIndex = works.index;
        on.worksIndex?.(((lastIndex % works.count) + works.count) % works.count);
      }
      renderer.render(works.scene, camera);
    }
  });

  // Screen-space bounding box of a desk object (for DOM elements that "come out" of it).
  const box = new THREE.Box3();
  function screenRect(id) {
    const o = desk.objects[id];
    if (!o) return null;
    camera.position.copy(pos);
    camera.lookAt(tgt);
    camera.updateMatrixWorld();
    box.setFromObject(o.root);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
      const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  }

  return {
    screenRect,
    setRoute,
    setHot: (id) => {
      if (mode === 'desk' && route === 'home') setHot(id);
    },
    setTheme(t) {
      desk.setTheme(t);
      works.setTheme(t);
      setHullColor(t === 'dark' ? '#4d8fe0' : '#004c97');
    },
    works,
    get mode() { return mode; },
  };
}
