// "Inside the MacBook": a floor grid and a ring of curved project panels (Jesper-style).
// Scrolling turns the ring; panels bend with scroll speed.
import * as THREE from 'three';
import { panelTexture } from './textures.js';

const PANEL_W = 2.9;
const PANEL_H = 1.8;
const GAP = 0.32;

const panelVertex = /* glsl */ `
  uniform float uBend;
  uniform float uRadius;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    // bow the top and bottom edges with scroll speed
    float edge = (uv.y - 0.5) * 2.0;
    p.y += uBend * edge * (1.0 - pow(abs(uv.x - 0.5) * 2.0, 2.0)) * 0.22;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const panelFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHover;
  uniform float uImageAspect;
  uniform float uPanelAspect;
  varying vec2 vUv;
  void main() {
    // cover-fit the media into the panel
    vec2 uv = vUv;
    float r = uPanelAspect / uImageAspect;
    if (r > 1.0) uv.y = (uv.y - 0.5) / r + 0.5; else uv.x = (uv.x - 0.5) * r + 0.5;
    uv = (uv - 0.5) * (1.0 - uHover * 0.04) + 0.5;
    vec4 c = texture2D(uMap, uv);
    // rounded corners
    vec2 q = abs(vUv - 0.5) * vec2(uPanelAspect, 1.0);
    vec2 b = vec2(uPanelAspect, 1.0) * 0.5 - 0.035;
    float d = length(max(q - b, 0.0)) - 0.035;
    if (d > 0.0) discard;
    gl_FragColor = vec4(c.rgb, 1.0);
    #include <colorspace_fragment>
  }
`;

function grid(theme) {
  const dark = theme === 'dark';
  const g = new THREE.GridHelper(80, 80, dark ? '#3a434c' : '#c9cdd0', dark ? '#3a434c' : '#d0d3d4');
  g.position.y = -1.35;
  g.material.transparent = true;
  g.material.opacity = 0.9;
  return g;
}

export function buildWorks({ content, theme, renderer }) {
  const scene = new THREE.Scene();
  const projects = content.projects;
  const n = Math.max(projects.length, 1);
  const step = (PANEL_W + GAP);
  const radius = Math.max(5.2, (n * step) / (Math.PI * 2));
  const angle = step / radius;

  const ring = new THREE.Group();
  ring.position.y = -0.42; // sit below the huge page title
  scene.add(ring);
  let floor = grid(theme);
  scene.add(floor);

  const loader = new THREE.TextureLoader();
  const panels = projects.map((p, i) => {
    const geo = new THREE.CylinderGeometry(radius, radius, PANEL_H, 40, 24, true, -angle / 2 + (GAP / radius) / 2, angle - GAP / radius);
    // CylinderGeometry UVs run around the outside; flip so the inside reads correctly.
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, 1 - uv.getX(k));
    const uniforms = {
      uMap: { value: panelTexture(p, i, theme) },
      uBend: { value: 0 },
      uRadius: { value: radius },
      uHover: { value: 0 },
      uImageAspect: { value: 1.6 },
      uPanelAspect: { value: PANEL_W / PANEL_H },
    };
    const material = new THREE.ShaderMaterial({ vertexShader: panelVertex, fragmentShader: panelFragment, uniforms, side: THREE.BackSide });
    const m = new THREE.Mesh(geo, material);
    // CylinderGeometry's theta 0 points at +z; rotate so panel i faces the centre at angle i.
    m.rotation.y = Math.PI - i * angle;
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
        });
      }
    }
    return { mesh: m, uniforms, project: p };
  });

  // Scroll state: target / current rotation in "panel units".
  let target = 0;
  let current = 0;
  let pull = 0; // scrolling up past the first panel pulls you back out to the desk
  let hovered = -1;
  let idle = 1; // seconds since the last scroll/drag; after a pause the ring snaps to a panel

  return {
    scene,
    panels,
    count: n,
    wheel(dy) {
      idle = 0;
      const next = target + dy * 0.0016;
      if (next < 0) {
        pull += -next;
        target = 0;
      } else {
        pull = Math.max(0, pull - dy * 0.0016);
        target = Math.min(next, n - 1);
      }
      return pull > 0.55; // true → leave to the desk
    },
    drag(dx) {
      idle = 0;
      target = Math.min(Math.max(0, target - dx * 0.0022), n - 1);
    },
    resetPull() { pull = 0; },
    // On the desk the MacBook screen shows the ring standing still, exactly where it was left.
    preview() {
      ring.rotation.y = current * angle;
      for (const pn of panels) {
        pn.uniforms.uBend.value *= 0.9;
        pn.uniforms.uHover.value *= 0.9;
      }
    },
    goTo(i) { target = Math.min(Math.max(0, i), n - 1); },
    get index() { return Math.round(current); },
    hover(i) {
      hovered = i;
    },
    setTheme(t) {
      scene.background = new THREE.Color(t === 'dark' ? '#1d252d' : '#f7f7f5');
      scene.remove(floor);
      floor.geometry.dispose();
      floor = grid(t);
      scene.add(floor);
      panels.forEach((pn, i) => {
        if (!pn.project.media[0]) pn.uniforms.uMap.value = panelTexture(pn.project, i, t);
      });
    },
    update(dt) {
      idle += dt;
      if (idle > 0.16) target += (Math.round(target) - target) * Math.min(1, dt * 6);
      const prev = current;
      current += (target - current) * Math.min(1, dt * 5);
      const vel = (current - prev) / Math.max(dt, 1e-3);
      ring.rotation.y = current * angle;
      for (const pn of panels) {
        const u = pn.uniforms;
        u.uBend.value += (THREE.MathUtils.clamp(vel * 0.35, -1, 1) - u.uBend.value) * Math.min(1, dt * 8);
        u.uHover.value += ((pn.mesh.userData.index === hovered ? 1 : 0) - u.uHover.value) * Math.min(1, dt * 8);
      }
    },
  };
}
