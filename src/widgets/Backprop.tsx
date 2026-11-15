import { useState } from 'react';
import { backward, initialNet, sgdStep, type Net } from './sim/backprop';
import { fmt, Readout, Slider, v } from './ui';

const P = { x: [[70, 80], [70, 220]], h: [[270, 80], [270, 220]], y: [470, 150] } as const;

/** A 2-2-1 network: run it forward, see each gradient from the chain rule, then take gradient-descent steps. */
export default function Backprop() {
  const [net, setNet] = useState<Net>(initialNet);
  const [x1, setX1] = useState(1), [x2, setX2] = useState(0.5), [target, setTarget] = useState(1), [lr, setLr] = useState(0.5);
  const [showGrad, setShowGrad] = useState(false), [stepsDone, setStepsDone] = useState(0);
  const g = backward(net, [x1, x2], target), f = g.f, L = 0.5 * (f.y - target) ** 2;
  const train = (k: number) => { let n = net; for (let i = 0; i < k; i++) n = sgdStep(n, [x1, x2], target, lr); setNet(n); setStepsDone(stepsDone + k); };
  const edge = (a: readonly number[], b: readonly number[], w: number, grad: number, key: string) => {
    const mx = a[0] + (b[0] - a[0]) * 0.35, my = a[1] + (b[1] - a[1]) * 0.35;
    return (
      <g key={key}>
        <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={w >= 0 ? v('cs') : v('danger')} strokeWidth={1.5 + Math.min(6, Math.abs(w) * 4)} strokeDasharray={w < 0 ? '7 4' : undefined} />
        <rect x={mx - 34} y={my - (showGrad ? 17 : 10)} width={68} height={showGrad ? 34 : 20} rx={5} fill={v('surface')} stroke={v('border')} />
        <text x={mx} y={my + (showGrad ? -3 : 4)} textAnchor="middle" fontSize="11" fontWeight="700" fill={v('fg')}>w = {fmt(w, 3)}</text>
        {showGrad && <text x={mx} y={my + 11} textAnchor="middle" fontSize="10.5" fill={v('math')}>grad {fmt(grad, 4)}</text>}
      </g>
    );
  };
  const node = (p: readonly number[], label: string, val: number, key: string) => (
    <g key={key}><circle cx={p[0]} cy={p[1]} r={30} fill={v('surface2')} stroke={v('fg')} strokeWidth={2.5} /><text x={p[0]} y={p[1] - 4} textAnchor="middle" fontSize="11" fill={v('muted')}>{label}</text><text x={p[0]} y={p[1] + 12} textAnchor="middle" fontSize="13" fontWeight="700" fill={v('fg')}>{fmt(val, 3)}</text></g>
  );
  return (
    <div className="space-y-3">
      <svg viewBox="0 0 560 300" className="w-full" role="img"
        aria-label={`Network with inputs ${fmt(x1)} and ${fmt(x2)}. Hidden values ${fmt(f.h[0], 3)} and ${fmt(f.h[1], 3)}. Output ${fmt(f.y, 3)}, target ${fmt(target)}, loss ${fmt(L, 4)}.`}>
        {[0, 1].flatMap((j) => [0, 1].map((i) => edge(P.x[i], P.h[j], net.w1[j][i], g.w1[j][i], `w1${j}${i}`)))}
        {[0, 1].map((j) => edge(P.h[j], P.y, net.w2[j], g.w2[j], `w2${j}`))}
        {node(P.x[0], 'input x₁', x1, 'x1')}{node(P.x[1], 'input x₂', x2, 'x2')}
        {node(P.h[0], 'hidden h₁', f.h[0], 'h1')}{node(P.h[1], 'hidden h₂', f.h[1], 'h2')}{node(P.y, 'output y', f.y, 'y')}
        <text x={470} y={210} textAnchor="middle" fontSize="12" fill={v('fg')}>target {fmt(target)}</text>
        <text x={470} y={228} textAnchor="middle" fontSize="12" fontWeight="700" fill={v('fg')}>loss {fmt(L, 5)}</text>
      </svg>
      <p className="text-xs text-muted">Solid lines are positive weights, dashed lines negative; thicker means larger. Each node shows its value after the sigmoid.</p>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Slider label={'Input x₁'} value={x1} min={-2} max={2} step={0.1} onChange={setX1} />
        <Slider label={'Input x₂'} value={x2} min={-2} max={2} step={0.1} onChange={setX2} />
        <Slider label="Target" value={target} min={0} max={1} step={0.05} onChange={setTarget} />
        <Slider label="Learning rate" value={lr} min={0.05} max={2} step={0.05} onChange={setLr} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" aria-pressed={showGrad} onClick={() => setShowGrad(!showGrad)}>{showGrad ? 'Hide' : 'Show'} gradients (backward pass)</button>
        <button type="button" className="btn btn-primary" onClick={() => train(1)}>Take 1 step</button>
        <button type="button" className="btn" onClick={() => train(50)}>Take 50 steps</button>
        <button type="button" className="btn" onClick={() => { setNet(initialNet()); setStepsDone(0); }}>Reset weights</button>
      </div>
      <Readout items={[['Steps taken', String(stepsDone)], ['Output', fmt(f.y, 4)], ['Loss', fmt(L, 6)], ['dLoss/dOutput', fmt(f.y - target, 4)], ['Output delta', fmt(g.dOut, 4)], ['Hidden deltas', `${fmt(g.dHidden[0], 4)}, ${fmt(g.dHidden[1], 4)}`]]} />
      <p className="text-sm text-muted">Each step changes every weight by: learning rate times its gradient, in the direction that lowers the loss. The gradient of a weight is the delta at the node it feeds, times the value that flows through it.</p>
    </div>
  );
}
