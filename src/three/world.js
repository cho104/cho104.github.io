import * as THREE from 'three';
import { gsap } from 'gsap';
import { buildDesk, setHullColor } from './desk.js';
import { buildWorks } from './works.js';

const NAV_IDS = ['coursework', 'resume', 'works', 'contact', 'about', 'lamp'];

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

  const screenRT = new THREE.WebGLRenderTarget(1024, 688, { samples: 4 });
  const screenCam = new THREE.PerspectiveCamera(46, 1024 / 688, 0.01, 200);
  screenCam.position.set(0, 0.15, 0);
  screenCam.lookAt(0, 0, -1);
  const screen = desk.objects.works.screen;
  screen.material.map = screenRT.texture;
  screen.material.toneMapped = false;
  screen.material.needsUpdate = true;
  screen.userData.live = true;
  const offTex = new THREE.DataTexture(new Uint8Array([9, 10, 12, 255]), 1, 1);
  offTex.colorSpace = THREE.SRGBColorSpace;
  offTex.needsUpdate = true;
  const power = { v: 0 };
  const showPower = () => {
    const off = power.v <= 0.001;
    screen.material.map = off ? offTex : screenRT.texture;
    screen.material.color.setScalar(off ? 1 : 0.035 + 0.965 * power.v);
  };
  showPower();
  const setPower = (on, delay = 0) =>
    gsap.to(power, { v: on ? 1 : 0, duration: on ? 0.45 : 0.6, delay, ease: 'power1.inOut', overwrite: true, onUpdate: showPower });

  setHullColor(theme === 'dark' ? '#4d8fe0' : '#004c97');

  let mode = 'desk';
  let route = 'home';
  let hot = null;
  let busy = false;

  const pos = new THREE.Vector3(...SHOTS.home[0]);
  const tgt = new THREE.Vector3(...SHOTS.home[1]);
  camera.position.copy(pos);
  camera.lookAt(tgt);

  function screenShot() {
    const s = desk.objects.works.screen;
    const root = desk.objects.works.root;
    const y = root.position.y;
    root.position.y = root.userData.baseY ?? y;
    s.updateWorldMatrix(true, false);
    const c = new THREE.Vector3().setFromMatrixPosition(s.matrixWorld);
    const n = new THREE.Vector3(0, 0, 1).transformDirection(s.matrixWorld);
    root.position.y = y;
    s.updateWorldMatrix(true, false);
    const h = s.geometry.parameters.height;
    const d = h / 2 / Math.tan(THREE.MathUtils.degToRad(36 / 2));
    return [c.clone().addScaledVector(n, d), c, 36];
  }

  function fit(shot) {
    const [p, t, fov] = shot;
    const k = Math.min(2.2, Math.max(1, 1.6 / camera.aspect));
    if (k === 1 || !Array.isArray(p)) return shot;
    const tv = new THREE.Vector3(...t);
    const pv = new THREE.Vector3(...p).sub(tv).multiplyScalar(k).add(tv);
    return [pv.toArray(), t, fov];
  }

  const tween = (target, vars) =>
    new Promise((done) => gsap.to(target, { overwrite: 'auto', ...vars, onComplete: done, onInterrupt: done }));

  function shotTween(shot, duration = 1.4, ease = 'expo.inOut') {
    const [p, t, fov] = fit(shot);
    gsap.killTweensOf([pos, tgt, camera]);
    return Promise.all([
      tween(pos, { x: p[0] ?? p.x, y: p[1] ?? p.y, z: p[2] ?? p.z, duration, ease }),
      tween(tgt, { x: t[0] ?? t.x, y: t[1] ?? t.y, z: t[2] ?? t.z, duration, ease }),
      tween(camera, { fov, duration, ease, onUpdate: () => camera.updateProjectionMatrix() }),
    ]).then((r) => (refit(), r));
  }

  function refit() {
    const shot = SHOTS[route];
    if (mode !== 'desk' || !shot || gsap.getTweensOf([pos, tgt, camera]).length) return;
    const [p, t, fov] = fit(shot);
    pos.set(...p);
    tgt.set(...t);
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  const WORKS_POS = new THREE.Vector3(0, 0.15, 0);
  const WORKS_TGT = new THREE.Vector3(0, 0, -1);
  const WORKS_FOV = 46;
  const worksCam = new THREE.PerspectiveCamera(WORKS_FOV, 1, 0.01, 200);
  worksCam.position.copy(WORKS_POS);
  worksCam.lookAt(WORKS_TGT);
  const fullRT = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
  const fadeMat = new THREE.MeshBasicMaterial({ map: fullRT.texture, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
  const fadeScene = new THREE.Scene();
  fadeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fadeMat));
  const fadeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  async function enterWorks(my) {
    if (mode === 'works') return;
    busy = true;
    setPower(true);
    const move = shotTween(screenShot(), 1.15, 'power2.inOut');
    const fade = tween(fadeMat, { opacity: 1, duration: 0.3, delay: 0.95, ease: 'power1.inOut' });
    await Promise.all([move, fade]);
    if (my !== seq) return;
    mode = 'works';
    lastIndex = -1;
    pos.copy(WORKS_POS);
    tgt.copy(WORKS_TGT);
    camera.fov = WORKS_FOV;
    camera.updateProjectionMatrix();
    fadeMat.opacity = 0;
    busy = false;
  }

  function leaveWorks() {
    if (mode !== 'works') return;
    mode = 'desk';
    const [sp, st] = screenShot();
    pos.copy(sp);
    tgt.copy(st);
    camera.fov = 36;
    camera.updateProjectionMatrix();
    fadeMat.opacity = 1;
    gsap.to(fadeMat, { opacity: 0, duration: 0.5, delay: 0.05, ease: 'power1.inOut', overwrite: true });
    setPower(false, 1.1);
  }

  let seq = 0;
  async function setRoute(next) {
    const my = ++seq;
    const prev = route;
    route = next;
    busy = false;
    settleUntil = performance.now() + 2500;
    setHot(null);
    setNote(null);
    if (prev === 'about' && next !== 'about') {
      setPhoto(-1);
      desk.objects.about.toWall();
    }
    if (prev === 'contact') desk.objects.contact.setOn(false);
    if (prev === 'coursework' && next !== 'coursework') {
      gsap.to(desk.objects.coursework.hinge.rotation, { z: 0, duration: 1, ease: 'power3.inOut', overwrite: true });
    }

    if (next === 'works') return enterWorks(my);
    if (mode === 'works') leaveWorks();
    else if (fadeMat.opacity > 0 || gsap.getTweensOf(fadeMat).length) {
      gsap.to(fadeMat, { opacity: 0, duration: 0.35, ease: 'power1.out', overwrite: true });
      setPower(false, 0.5);
    }

    if (next === 'home') return shotTween(SHOTS.home, 1.3);
    const shot = SHOTS[next];
    if (!shot) return;
    const move = shotTween(shot, 1.3);
    const later = (ms, fn) => setTimeout(() => my === seq && fn(), ms);
    if (next === 'about') later(350, () => desk.objects.about.toSphere());
    if (next === 'contact') later(600, () => desk.objects.contact.setOn(true));
    if (next === 'coursework') gsap.to(desk.objects.coursework.hinge.rotation, { z: Math.PI * 0.97, duration: 1.2, delay: 0.5, ease: 'power3.inOut', overwrite: true });
    await move;
    return my === seq;
  }

  const paperBase = new Map();
  function paperSlide(id, out, duration = 0.55) {
    const p = desk.objects[id].paper;
    const m = p.mesh;
    if (!paperBase.has(id)) paperBase.set(id, { y: m.position.y, z: m.position.z, rx: m.rotation.x });
    const b = paperBase.get(id);
    const k = out ? 1 : 0;
    m.visible = true;
    return Promise.all([
      tween(m.position, { y: b.y + p.slide.y * k, z: b.z + p.slide.z * k, duration, ease: 'power2.inOut' }),
      tween(m.rotation, { x: b.rx + p.slide.rx * k, duration, ease: 'power2.inOut' }),
    ]);
  }
  function paperReset(id) {
    const m = desk.objects[id].paper.mesh;
    const b = paperBase.get(id);
    gsap.killTweensOf([m.position, m.rotation]);
    if (b) {
      m.position.y = b.y;
      m.position.z = b.z;
      m.rotation.x = b.rx;
    }
    m.visible = true;
  }
  const _m = new THREE.Matrix4();
  function paperPose(id) {
    const p = desk.objects[id].paper;
    p.mesh.updateWorldMatrix(true, false);
    const q = new THREE.Quaternion().setFromRotationMatrix(_m.extractRotation(p.mesh.matrixWorld));
    const X = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const Y = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const Z = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const c = new THREE.Vector3(0, p.top, 0).applyMatrix4(p.mesh.matrixWorld);
    return { c, q: new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(X, Y, Z)), w: p.w, h: p.h };
  }
  function syncCamera() {
    camera.position.copy(pos);
    camera.lookAt(tgt);
    camera.updateMatrixWorld();
  }
  function viewPose(rect, h) {
    syncCamera();
    const f = innerHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = (f * h) / rect.height;
    const k = d / f;
    const q = camera.quaternion.clone();
    const X = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const Y = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const F = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const cx = rect.left + rect.width / 2 - innerWidth / 2;
    const cy = rect.top + rect.height / 2 - innerHeight / 2;
    const c = camera.position.clone().addScaledVector(F, d).addScaledVector(X, cx * k).addScaledVector(Y, -cy * k);
    return { c, q, w: rect.width * k, h };
  }
  function toScreen(v) {
    v.project(camera);
    return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight];
  }

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(9, 9);
  let pointerInside = false;
  let pointerMoved = true;
  let settleUntil = 0;
  const pickedFrom = { pos: new THREE.Vector3(Infinity, 0, 0), tgt: new THREE.Vector3() };

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
      const note = hits[0]?.object.userData.note ?? null;
      return { id: hit?.object.userData.id ?? null, photo: hit?.object.userData.photo, note };
    }
    const hits = ray.intersectObjects(works.panels.map((p) => p.mesh), false);
    const h = hits[0]?.object.userData;
    return h ? { id: 'project', slug: h.slug, index: h.index } : { id: null };
  }

  function setNote(key) {
    on.note?.(key, pointer);
  }

  let photoHot = -1;
  const pointer = { x: 0, y: 0 };
  function setPhoto(i) {
    if (!desk.objects.about.settled) i = -1;
    if (photoHot !== i) {
      const frames = desk.objects.about.frames;
      const size = (f, k) => { const v = (f.userData.size ?? 1) * k; return { x: v, y: v, z: v }; };
      if (frames[photoHot] && desk.objects.about.settled) gsap.to(frames[photoHot].scale, { ...size(frames[photoHot], 1), duration: 0.3 });
      if (frames[i]) gsap.to(frames[i].scale, { ...size(frames[i], 1.18), duration: 0.3, ease: 'back.out(2)' });
      photoHot = i;
      canvas.style.cursor = i >= 0 ? 'pointer' : 'grab';
    }
    on.photo?.(i, pointer);
  }

  let down = null;
  canvas.addEventListener('pointermove', (e) => {
    pointerInside = true;
    pointerMoved = true;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down.x = e.clientX;
      down.y = e.clientY;
      down.moved += Math.abs(dx) + Math.abs(dy);
      if (mode === 'works') works.drag(dx);
      else if (route === 'about') desk.objects.about.drag(dx, dy);
    }
  });
  canvas.addEventListener('pointerleave', () => {
    pointerInside = false;
    if (route === 'home') setHot(null);
    setNote(null);
    works.hover(-1);
  });
  const setNdc = (e) => ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  canvas.addEventListener('pointerdown', (e) => {
    setNdc(e);
    down = { x: e.clientX, y: e.clientY, moved: 0 };
  });
  window.addEventListener('pointerup', (e) => {
    if (e.target === canvas) setNdc(e);
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
        works.wheel(dy);
        return;
      }
      if (route === 'about') {
        const bio = e.target.closest?.('.about');
        if (bio && bio.scrollHeight > bio.clientHeight) return;
        desk.objects.about.drag(0, -dy * 0.35);
        return;
      }
    },
    { passive: true },
  );

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    worksCam.aspect = w / h;
    worksCam.updateProjectionMatrix();
    refit();
    fullRT.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    renderer.setRenderTarget(fullRT);
    renderer.clear();
    renderer.setRenderTarget(null);
  }
  addEventListener('resize', resize);
  resize();

  function warm() {
    works.preview();
    renderer.setRenderTarget(screenRT);
    renderer.render(works.scene, screenCam);
    renderer.setRenderTarget(fullRT);
    renderer.render(works.scene, worksCam);
    renderer.setRenderTarget(null);
    renderer.compile(works.scene, camera);
    renderer.compile(fadeScene, fadeCam);
  }
  requestAnimationFrame(() => setTimeout(warm, 0));

  const clock = new THREE.Clock();
  let lastIndex = -1;
  const v = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    camera.position.copy(pos);
    look.copy(tgt);
    camera.lookAt(look);
    const bare = mode === 'works' && !!on.ringHidden?.();
    works.showRing(!bare);

    const changed =
      pointerMoved || route === 'about' || mode === 'works' || performance.now() < settleUntil ||
      !pickedFrom.pos.equals(pos) || !pickedFrom.tgt.equals(tgt);
    if (pointerInside && !down && !busy && !bare && changed) {
      pointerMoved = false;
      pickedFrom.pos.copy(pos);
      pickedFrom.tgt.copy(tgt);
      const p = pick();
      if (mode === 'desk' && route === 'home') {
        setHot(p.id);
        setNote(p.id ? null : p.note);
      }
      if (mode === 'desk' && route === 'about') setPhoto(p.id === 'about' ? (p.photo ?? -1) : -1);
      if (mode === 'works') {
        works.hover(p.index ?? -1);
        canvas.style.cursor = p.slug ? 'pointer' : 'grab';
      }
    }

    if (mode === 'desk') {
      desk.update(dt);
      if (power.v > 0) {
        works.preview();
        renderer.setRenderTarget(screenRT);
        renderer.render(works.scene, screenCam);
        renderer.setRenderTarget(null);
      }
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

  return {
    setRoute,
    paper: { slide: paperSlide, reset: paperReset, pose: paperPose, viewPose, toScreen, sync: syncCamera, show: (id, on) => (desk.objects[id].paper.mesh.visible = on) },
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
