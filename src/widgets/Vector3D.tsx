import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useTheme } from '../app/theme';
import { cssColor, fmt } from './ui';

type V3 = [number, number, number];
const NAMES = ['cs', 'engineering', 'math'];

/** 3D vectors and their sum, drawn tip to tail. Drag to rotate; the arrow keys also rotate the view. */
export default function Vector3D({ vectors: initial }: { vectors: V3[] }) {
  const [vectors, setVectors] = useState<V3[]>(initial);
  const host = useRef<HTMLDivElement>(null);
  const three = useRef<{ scene: THREE.Scene; group: THREE.Group; render(): void; controls: OrbitControls } | null>(null);
  const theme = useTheme((s) => s.resolved);
  const sum = vectors.reduce<V3>((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(4.2, 3.4, 5.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.listenToKeyEvents(el);
    controls.keyRotateSpeed = 12;
    const group = new THREE.Group();
    scene.add(group);
    const render = () => renderer.render(scene, camera);
    controls.addEventListener('change', render);
    const resize = () => { const w = el.clientWidth, h = Math.min(380, Math.max(240, w * 0.6)); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); render(); };
    el.appendChild(renderer.domElement);
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    three.current = { scene, group, render, controls };
    return () => { ro.disconnect(); controls.dispose(); renderer.dispose(); renderer.domElement.remove(); three.current = null; };
  }, []);

  useEffect(() => {
    const t = three.current;
    if (!t) return;
    t.group.clear();
    const grid = new THREE.GridHelper(8, 8, cssColor('border-strong'), cssColor('border'));
    t.group.add(grid);
    const axes: [V3, string][] = [[[1, 0, 0], 'x'], [[0, 1, 0], 'y'], [[0, 0, 1], 'z']];
    for (const [d] of axes) t.group.add(new THREE.ArrowHelper(new THREE.Vector3(...d), new THREE.Vector3(0, 0, 0), 4, cssColor('muted'), 0.2, 0.12));
    const arrow = (from: V3, vec: V3, color: string) => {
      const dir = new THREE.Vector3(...vec), len = dir.length();
      if (len < 1e-6) return;
      const a = new THREE.ArrowHelper(dir.clone().normalize(), new THREE.Vector3(...from), len, color, Math.min(0.5, len * 0.25), Math.min(0.28, len * 0.14));
      t.group.add(a);
    };
    let tail: V3 = [0, 0, 0];
    // Scene axes: three.js y is up, so physics (x, y, z) is drawn as (x, z, y) to keep z vertical.
    const map = ([x, y, z]: V3): V3 => [x, z, y];
    vectors.forEach((vec, i) => { arrow(map(tail), map(vec), cssColor(NAMES[i])); tail = [tail[0] + vec[0], tail[1] + vec[1], tail[2] + vec[2]]; });
    if (vectors.length > 1) arrow([0, 0, 0], map(sum), cssColor('danger'));
    t.render();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vectors, theme]);

  const set = (i: number, k: number, val: number) => setVectors(vectors.map((vec, j) => (j === i ? (vec.map((c, m) => (m === k ? val : c)) as V3) : vec)));
  return (
    <div className="space-y-3">
      <div ref={host} tabIndex={0} className="w-full overflow-hidden rounded-xl border border-border" role="img"
        aria-label={`3D view of ${vectors.length} vectors drawn tip to tail: ${vectors.map((x) => `(${x.join(', ')})`).join(' and ')}. Their sum is (${sum.map((c) => fmt(c)).join(', ')}). Drag or use the arrow keys to rotate.`} />
      <p className="text-xs text-muted">Drag to rotate, scroll to zoom. With the view focused, the arrow keys rotate it. The vertical axis is z.</p>
      <div className="space-y-1.5">
        {vectors.map((vec, i) => (
          <fieldset key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <legend className="float-left mr-2 w-16 font-mono font-bold" style={{ color: `rgb(var(--${NAMES[i]}))` }}>F{i + 1}</legend>
            {['x', 'y', 'z'].map((axis, k) => <label key={axis} className="flex items-center gap-1">{axis}<input type="number" step={0.5} min={-5} max={5} value={vec[k]} onChange={(e) => set(i, k, +e.target.value)} className="input w-20 py-1" /></label>)}
            <span className="font-mono text-muted">size {fmt(Math.hypot(...vec))}</span>
          </fieldset>
        ))}
        <p className="font-mono text-sm" aria-live="polite"><span className="font-bold text-danger">Sum</span> = ({sum.map((c) => fmt(c)).join(', ')}), size {fmt(Math.hypot(...sum))}</p>
      </div>
    </div>
  );
}
