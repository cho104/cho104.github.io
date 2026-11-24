import * as THREE from 'three';
import { panelTexture } from './textures.js';

const PANEL_W = 2.9;
const PANEL_H = 1.8;
const GAP = 0.32;

const panelVertex = `
  uniform float uBend;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float edge = (uv.y - 0.5) * 2.0;
    p.y += uBend * edge * (1.0 - pow(abs(uv.x - 0.5) * 2.0, 2.0)) * 0.22;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const panelFragment = `
  uniform sampler2D uMap;
  uniform float uHover;
  uniform float uImageAspect;
  uniform float uPanelAspect;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    float r = uPanelAspect / uImageAspect;
    if (r > 1.0) uv.y = (uv.y - 0.5) / r + 0.5; else uv.x = (uv.x - 0.5) * r + 0.5;
    uv = (uv - 0.5) * (1.0 - uHover * 0.04) + 0.5;
    vec4 c = texture2D(uMap, uv);
    vec2 q = abs(vUv - 0.5) * vec2(uPanelAspect, 1.0);
    vec2 b = vec2(uPanelAspect, 1.0) * 0.5 - 0.035;
    float d = length(max(q - b, 0.0)) - 0.035;
    if (d > 0.0) discard;
    gl_FragColor = vec4(c.rgb, 1.0);
    #include <colorspace_fragment>
  }
`;

const backVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;
const backFragment = `
  uniform sampler2D uSky;
  uniform sampler2D uHill;
  uniform float uAspect;
  uniform float uSkyAspect;
  uniform float uHillAspect;
  uniform float uShift;
  uniform float uNight;
  varying vec2 vUv;
  vec2 cover(vec2 uv, float outer, float inner) {
    return (uv - 0.5) * vec2(min(outer / inner, 1.0), min(inner / outer, 1.0)) + 0.5;
  }
  const float FRAME = 1.6;
  const float CREST = 0.4;
  const float TOP = 0.72;
  void main() {
    vec2 w = cover(vUv, uAspect, FRAME);
    vec2 su = cover(w, FRAME, uSkyAspect);
    su.x += uShift * 0.02;
    float hh = FRAME / uHillAspect;
    vec2 hu = vec2(w.x + uShift * 0.05, (w.y + TOP * hh - CREST) / hh);
    vec4 hill = texture2D(uHill, hu);
    vec3 c = mix(texture2D(uSky, su).rgb, hill.rgb, hill.a);
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 night = mix(vec3(l), c, 0.55) * vec3(0.16, 0.2, 0.32) + vec3(0.012, 0.016, 0.03);
    gl_FragColor = vec4(mix(c, night, uNight), 1.0);
    #include <colorspace_fragment>
  }
`;

function backdrop(theme, renderer) {
  const loader = new THREE.TextureLoader();
  const tex = (src, aspect) => {
    const t = loader.load(src, () => {
      u[aspect].value = t.image.width / t.image.height;
      renderer.initTexture(t);
    });
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.MirroredRepeatWrapping;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  };
  const u = {
    uSky: { value: null },
    uHill: { value: null },
    uAspect: { value: 1.6 },
    uSkyAspect: { value: 1920 / 921 },
    uHillAspect: { value: 2560 / 1350 },
    uShift: { value: 0 },
    uNight: { value: theme === 'dark' ? 1 : 0 },
  };
  u.uSky.value = tex('/works/sky.jpg', 'uSkyAspect');
  u.uHill.value = tex('/works/hill.webp', 'uHillAspect');
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: backVertex, fragmentShader: backFragment, uniforms: u, depthTest: false, depthWrite: false }),
  );
  m.frustumCulled = false;
  m.renderOrder = -1;
  m.onBeforeRender = (_r, _s, camera) => (u.uAspect.value = camera.aspect ?? 1.6);
  return { mesh: m, uniforms: u };
}

export function buildWorks({ content, theme, renderer }) {
  const scene = new THREE.Scene();
  const projects = content.projects;
  const n = Math.max(projects.length, 1);
  const step = (PANEL_W + GAP);
  const copies = Math.max(1, Math.ceil((2 * Math.PI * 5.2) / (n * step)));
  const slots = projects.length ? n * copies : 0;
  const radius = (slots * step || 2 * Math.PI * 5.2) / (Math.PI * 2);
  const angle = step / radius;
  const order = Array.from({ length: slots }, (_, k) => k % n);

  const ring = new THREE.Group();
  ring.position.y = -0.42;
  scene.add(ring);
  const back = backdrop(theme, renderer);
  scene.add(back.mesh);
  let night = theme === 'dark' ? 1 : 0;

  const loader = new THREE.TextureLoader();
  const panels = order.map((i, slot) => {
    const p = projects[i];
    const geo = new THREE.CylinderGeometry(radius, radius, PANEL_H, 40, 24, true, -angle / 2 + (GAP / radius) / 2, angle - GAP / radius);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, 1 - uv.getX(k));
    const uniforms = {
      uMap: { value: panelTexture(p, i, theme) },
      uBend: { value: 0 },
      uHover: { value: 0 },
      uImageAspect: { value: 1.6 },
      uPanelAspect: { value: PANEL_W / PANEL_H },
    };
    const material = new THREE.ShaderMaterial({ vertexShader: panelVertex, fragmentShader: panelFragment, uniforms, side: THREE.BackSide });
    const m = new THREE.Mesh(geo, material);
    m.rotation.y = Math.PI - slot * angle;
    m.userData = { id: 'project', slug: p.slug, index: i };
    ring.add(m);

    const first = p.media[0];
    if (first) {
      const src = '/' + first.src.replace(/^\.?\//, '');
      if (first.kind === 'video') {
        const v = document.createElement('video');
        Object.assign(v, { src, muted: true, loop: true, playsInline: true, autoplay: true, crossOrigin: 'anonymous' });
        v.addEventListener('loadeddata', () => {
          const t = new THREE.VideoTexture(v);
          t.colorSpace = THREE.SRGBColorSpace;
          uniforms.uMap.value = t;
          uniforms.uImageAspect.value = v.videoWidth / v.videoHeight;
        });
        v.play().catch(() => {});
      } else {
        loader.load(src, (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = renderer.capabilities.getMaxAnisotropy();
          uniforms.uMap.value = t;
          uniforms.uImageAspect.value = t.image.width / t.image.height;
          renderer.initTexture(t);
        });
      }
    }
    return { mesh: m, uniforms, project: p };
  });

  let target = 0;
  let current = 0;
  let hovered = -1;
  let idle = 1;

  return {
    scene,
    showRing(v) { ring.visible = v; },
    panels,
    count: n,
    wheel(dy) {
      idle = 0;
      target += dy * 0.0016;
    },
    drag(dx) {
      idle = 0;
      target -= dx * 0.0022;
    },
    preview() {
      ring.rotation.y = current * angle;
      back.uniforms.uShift.value = current;
      back.uniforms.uNight.value += (night - back.uniforms.uNight.value) * 0.08;
      for (const pn of panels) {
        pn.uniforms.uBend.value *= 0.9;
        pn.uniforms.uHover.value *= 0.9;
      }
    },
    step(d) {
      idle = 0;
      target = Math.round(target) + d;
    },
    goTo(i) {
      const d = (((i - Math.round(target)) % n) + n) % n;
      target = Math.round(target) + (d > n / 2 ? d - n : d);
    },
    get index() { return ((Math.round(current) % n) + n) % n; },
    hover(i) {
      hovered = i;
    },
    setTheme(t) {
      scene.background = new THREE.Color(t === 'dark' ? '#1d252d' : '#f7f7f5');
      night = t === 'dark' ? 1 : 0;
      panels.forEach((pn) => {
        if (!pn.project.media[0]) pn.uniforms.uMap.value = panelTexture(pn.project, pn.mesh.userData.index, t);
      });
    },
    update(dt) {
      idle += dt;
      if (idle > 0.16) target += (Math.round(target) - target) * Math.min(1, dt * 6);
      const prev = current;
      current += (target - current) * Math.min(1, dt * 5);
      const vel = (current - prev) / Math.max(dt, 1e-3);
      ring.rotation.y = current * angle;
      const bu = back.uniforms;
      bu.uShift.value = current;
      bu.uNight.value += (night - bu.uNight.value) * Math.min(1, dt * 4);
      for (const pn of panels) {
        const u = pn.uniforms;
        u.uBend.value += (THREE.MathUtils.clamp(vel * 0.35, -1, 1) - u.uBend.value) * Math.min(1, dt * 8);
        u.uHover.value += ((pn.mesh.userData.index === hovered ? 1 : 0) - u.uHover.value) * Math.min(1, dt * 8);
      }
    },
  };
}
