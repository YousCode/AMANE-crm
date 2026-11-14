/**
 * Scène WebGL plein écran, fond transparent :
 * - le A à serrure d'Amane en volume, extrudé depuis les tracés du logo, or poli, serrure laquée bordeaux ;
 * - une poussière d'or qui dérive lentement ;
 * - un halo chaud derrière le A.
 * La place du A est pilotée par le défilement (setPose), son orientation par le pointeur.
 */
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MARK_PARTS, MARK_VIEWBOX } from '../logo';

export interface Pose {
  /** position horizontale, en fraction de la largeur visible (-0.5 … 0.5) */
  x: number;
  /** position verticale, en fraction de la hauteur visible (-0.5 … 0.5, positif vers le haut) */
  y: number;
  /** hauteur du A, en fraction de la hauteur visible (0 = absent) */
  s: number;
  /** rotation de base autour de l'axe vertical (radians) */
  r: number;
}
export interface AmaneScene {
  setPose(p: Pose): void;
  /** fond sombre ou clair : règle le halo et la poussière */
  setTone(dark: boolean): void;
  /** vitesse de défilement (px / image), pour l'élan de rotation */
  kick(v: number): void;
  dispose(): void;
}

const FOV = 30, DIST = 10;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function extrude(paths: readonly string[], depth: number, bevel: number): THREE.BufferGeometry[] {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}">${paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
  const out: THREE.BufferGeometry[] = [];
  for (const p of new SVGLoader().parse(svg).paths) {
    for (const shape of SVGLoader.createShapes(p)) {
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 4, curveSegments: 28 });
      g.translate(0, 0, -depth / 2);
      out.push(g);
    }
  }
  return out;
}

function haloTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(217,185,138,.55)'); g.addColorStop(0.35, 'rgba(184,149,92,.18)'); g.addColorStop(1, 'rgba(184,149,92,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createScene(canvas: HTMLCanvasElement, opts: { mobile: boolean; reduced: boolean }): AmaneScene | null {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch { return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60); camera.position.z = DIST;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Le A : chaque partie a sa propre épaisseur, pour qu'aucune face ne se superpose à une autre.
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xc8a468, metalness: 1, roughness: 0.26, clearcoat: 0.7, clearcoatRoughness: 0.22, envMapIntensity: 1.25 });
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x5b1622, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.1 });
  const mark = new THREE.Group();
  const add = (geos: THREE.BufferGeometry[], m: THREE.Material) => geos.forEach((g) => mark.add(new THREE.Mesh(g, m)));
  add(extrude(MARK_PARTS.legs, 150, 9), gold);
  add(extrude(MARK_PARTS.bar, 110, 5), gold);
  add(extrude(MARK_PARTS.keyhole, 170, 6), lacquer);
  // Centré, hauteur ramenée à 1, axe Y vers le haut (le SVG l'a vers le bas).
  const box = new THREE.Box3().setFromObject(mark); const size = new THREE.Vector3(); const center = new THREE.Vector3(); box.getSize(size); box.getCenter(center);
  mark.children.forEach((c) => (c as THREE.Mesh).geometry.translate(-center.x, -center.y, 0));
  const k = 1 / size.y; mark.scale.set(k, -k, k);
  const pivot = new THREE.Group(); pivot.add(mark); scene.add(pivot);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), transparent: true, depthWrite: false, opacity: 0.9 }));
  scene.add(halo); // hors du pivot : le halo suit le A sans tourner avec lui

  scene.add(new THREE.AmbientLight(0xfff1dc, 0.5));
  const keyLight = new THREE.DirectionalLight(0xffe2b8, 2.4); keyLight.position.set(3, 4, 6); scene.add(keyLight);
  const rim = new THREE.DirectionalLight(0x9fb4ff, 0.9); rim.position.set(-5, 1, -3); scene.add(rim);

  // Poussière d'or
  const N = opts.mobile ? 110 : 240;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 16; pos[i * 3 + 1] = (Math.random() - 0.5) * 10; pos[i * 3 + 2] = -6 + Math.random() * 9; seed[i] = Math.random() * 6.28; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xd9b98a, size: 0.035, transparent: true, opacity: 0.7, depthWrite: false, sizeAttenuation: true });
  const dust = new THREE.Points(dustGeo, dustMat); scene.add(dust);

  let vw = 1, vh = 1; // dimensions visibles au plan z = 0
  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    vh = 2 * Math.tan((FOV * Math.PI) / 360) * DIST; vw = vh * camera.aspect;
  };
  resize(); window.addEventListener('resize', resize, { passive: true });

  const target: Pose = { x: 0, y: 0, s: 0, r: 0 }, cur: Pose = { x: 0, y: 0, s: 0, r: 0 };
  let px = 0, py = 0, tx = 0, ty = 0, spin = 0, haloTo = 0.9, dustTo = 0.7, first = true;
  const onMove = (e: PointerEvent) => { tx = (e.clientX / window.innerWidth) * 2 - 1; ty = (e.clientY / window.innerHeight) * 2 - 1; };
  if (!opts.mobile) window.addEventListener('pointermove', onMove, { passive: true });

  const clock = new THREE.Clock(); let raf = 0, running = true;
  const frame = () => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const t = clock.getElapsedTime(), f = opts.reduced || first ? 1 : 0.055; first = false;
    cur.x = lerp(cur.x, target.x, f); cur.y = lerp(cur.y, target.y, f); cur.s = lerp(cur.s, target.s, f); cur.r = lerp(cur.r, target.r, f);
    px = lerp(px, tx, 0.05); py = lerp(py, ty, 0.05); spin *= 0.94;
    pivot.visible = cur.s > 0.012;
    if (pivot.visible) {
      pivot.position.set(cur.x * vw, cur.y * vh + (opts.reduced ? 0 : Math.sin(t * 0.7) * 0.05), 0);
      pivot.scale.setScalar(cur.s * vh);
      pivot.rotation.y = cur.r + px * 0.5 + spin + (opts.reduced ? 0.35 : Math.sin(t * 0.35) * 0.32);
      pivot.rotation.x = py * 0.18;
    }
    halo.visible = pivot.visible; halo.position.set(pivot.position.x, pivot.position.y, -1.6); halo.scale.setScalar(cur.s * vh * 2.5);
    (halo.material as THREE.SpriteMaterial).opacity = lerp((halo.material as THREE.SpriteMaterial).opacity, haloTo, 0.05);
    dustMat.opacity = lerp(dustMat.opacity, dustTo, 0.05);
    if (!opts.reduced) {
      const p = dustGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N; i++) { let y = p.getY(i) + 0.0016 + Math.sin(t * 0.4 + seed[i]) * 0.0007; if (y > 5) y = -5; p.setY(i, y); }
      p.needsUpdate = true; dust.rotation.y = px * 0.05;
    }
    renderer.render(scene, camera);
  };
  const onVis = () => { running = !document.hidden; if (running) { clock.getDelta(); frame(); } else cancelAnimationFrame(raf); };
  document.addEventListener('visibilitychange', onVis);
  frame();

  return {
    setPose(p) {
      // Absent de l'écran : il réapparaît directement à sa nouvelle place, sans traverser la page.
      if (cur.s < 0.02 && p.s > 0) { cur.x = p.x; cur.y = p.y; cur.r = p.r - 1.2; }
      target.x = p.x; target.y = p.y; target.s = p.s; target.r = p.r;
    },
    setTone(dark) { haloTo = dark ? 0.9 : 0.28; dustTo = dark ? 0.7 : 0.38; dustMat.color.set(dark ? 0xd9b98a : 0x9a7a45); },
    kick(v) { spin = Math.max(-0.9, Math.min(0.9, spin + v * 0.0009)); },
    dispose() { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis); pmrem.dispose(); renderer.dispose(); },
  };
}
