import { useMemo, useState } from 'react';
import { v } from './ui';

export interface SortStep { arr: number[]; hot: number[]; done: number[]; note: string; lo?: number; hi?: number }
type Algo = 'bubble' | 'insertion' | 'selection' | 'binary-search';

/** Pre-computes every step of the algorithm so that stepping backwards is free. */
export function steps(algo: Algo, data: number[], target?: number): SortStep[] {
  const a = [...data], out: SortStep[] = [], n = a.length;
  const push = (hot: number[], done: number[], note: string, extra: Partial<SortStep> = {}) => out.push({ arr: [...a], hot, done, note, ...extra });
  const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
  if (algo === 'bubble') {
    push([], [], 'Bubble sort: compare neighbours and swap them if they are out of order.');
    for (let end = n - 1; end > 0; end--) {
      let swapped = false;
      for (let i = 0; i < end; i++) {
        if (a[i] > a[i + 1]) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; swapped = true; push([i, i + 1], range(end + 1, n), `${a[i + 1]} > ${a[i]}, so swap them.`); }
        else push([i, i + 1], range(end + 1, n), `${a[i]} ≤ ${a[i + 1]}, so leave them.`);
      }
      if (!swapped) { push([], range(0, n), 'A full pass made no swaps, so the list is sorted.'); return out; }
    }
    push([], range(0, n), 'Sorted.');
  } else if (algo === 'insertion') {
    push([], [0], 'Insertion sort: grow a sorted section on the left, one item at a time.');
    for (let i = 1; i < n; i++) {
      let j = i;
      push([j], range(0, i), `Take ${a[j]} and slide it left into place.`);
      while (j > 0 && a[j - 1] > a[j]) { [a[j - 1], a[j]] = [a[j], a[j - 1]]; j--; push([j], range(0, i + 1), `${a[j + 1]} is bigger, so it moves right.`); }
    }
    push([], range(0, n), 'Sorted.');
  } else if (algo === 'selection') {
    push([], [], 'Selection sort: find the smallest remaining item and put it next.');
    for (let i = 0; i < n - 1; i++) {
      let m = i;
      for (let j = i + 1; j < n; j++) { if (a[j] < a[m]) m = j; push([m, j], range(0, i), `Smallest so far is ${a[m]}.`); }
      [a[i], a[m]] = [a[m], a[i]];
      push([i], range(0, i + 1), `Put ${a[i]} in position ${i}.`);
    }
    push([], range(0, n), 'Sorted.');
  } else {
    a.sort((x, y) => x - y);
    const t = target ?? a[Math.floor(n / 3)];
    let lo = 0, hi = n - 1;
    push([], [], `Binary search for ${t} in a sorted list: check the middle, then discard half.`, { lo, hi });
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (a[mid] === t) { push([mid], [mid], `Middle is ${a[mid]}: found it at position ${mid}.`, { lo, hi }); return out; }
      if (a[mid] < t) { push([mid], [], `Middle is ${a[mid]}, too small. Discard the left half.`, { lo, hi }); lo = mid + 1; }
      else { push([mid], [], `Middle is ${a[mid]}, too big. Discard the right half.`, { lo, hi }); hi = mid - 1; }
    }
    push([], [], `${t} is not in the list.`, { lo, hi });
  }
  return out;
}

const NAMES: Record<Algo, string> = { bubble: 'Bubble sort', insertion: 'Insertion sort', selection: 'Selection sort', 'binary-search': 'Binary search' };

export default function SortVisualizer({ algorithm, data, target }: { algorithm: Algo; data: number[]; target?: number }) {
  const [algo, setAlgo] = useState<Algo>(algorithm);
  const all = useMemo(() => steps(algo, data, target), [algo, data, target]);
  const [i, setI] = useState(0);
  const s = all[Math.min(i, all.length - 1)];
  const max = Math.max(...data), bw = Math.min(56, 520 / data.length);
  return (
    <div className="space-y-3">
      <div role="group" aria-label="Algorithm" className="flex flex-wrap gap-1">
        {(Object.keys(NAMES) as Algo[]).map((k) => <button key={k} type="button" aria-pressed={k === algo} className={`btn px-3 py-1 ${k === algo ? 'btn-primary' : ''}`} onClick={() => { setAlgo(k); setI(0); }}>{NAMES[k]}</button>)}
      </div>
      <svg viewBox="0 0 560 210" className="w-full" role="img" aria-label={`List: ${s.arr.join(', ')}. ${s.note}`}>
        {s.arr.map((val, k) => {
          const h = 30 + (val / max) * 120, x = 20 + k * bw, hot = s.hot.includes(k), done = s.done.includes(k);
          const out = s.lo !== undefined && (k < s.lo! || k > s.hi!);
          return (
            <g key={k} opacity={out ? 0.3 : 1}>
              <rect x={x + 3} y={180 - h} width={bw - 6} height={h} rx={5} fill={hot ? v('accent') : done ? v('success') : v('surface2')} stroke={hot ? v('fg') : v('border-strong')} strokeWidth={hot ? 3 : 1.5} />
              <text x={x + bw / 2} y={172} textAnchor="middle" fontSize="14" fontWeight="700" fill={hot ? v('accent-fg') : done ? v('surface') : v('fg')}>{val}</text>
              <text x={x + bw / 2} y={198} textAnchor="middle" fontSize="10" fill={v('muted')}>{k}</text>
              {hot && <path d={`M${x + bw / 2 - 6},${170 - h} h12 l-6,8 z`} fill={v('fg')} />}
            </g>
          );
        })}
      </svg>
      <p className="min-h-[1.5rem] text-sm" aria-live="polite">{s.note}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
        <button type="button" className="btn btn-primary" disabled={i >= all.length - 1} onClick={() => setI(i + 1)}>Step</button>
        <button type="button" className="btn" onClick={() => setI(0)}>Restart</button>
        <span className="text-sm text-muted">Step {i + 1} of {all.length}. Pointed bars are being compared; green bars are in their final place.</span>
      </div>
    </div>
  );
}
