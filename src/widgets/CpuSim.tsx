import { useEffect, useState } from 'react';
import { reset, step, type Cpu, type Phase } from './sim/cpu';

const PHASES: Phase[] = ['fetch', 'decode', 'execute'];
const Cell = ({ label, value, hot }: { label: string; value: string | number; hot?: boolean }) => (
  <div className={`rounded-lg border-2 px-2 py-1 text-center ${hot ? 'border-accent bg-accent-soft' : 'border-border'}`}>
    <div className="text-xs text-muted">{label}</div><div className="font-mono font-semibold">{value}</div>
  </div>
);

export default function CpuSim({ program, memory }: { program: string[]; memory: Record<string, number> }) {
  const [cpu, setCpu] = useState<Cpu>(() => reset(memory));
  const [prev, setPrev] = useState<Cpu>(cpu);
  const [running, setRunning] = useState(false);
  const advance = () => setCpu((c) => { setPrev(c); return step(c, program); });
  useEffect(() => {
    if (!running) return;
    if (cpu.halted) { setRunning(false); return; }
    const t = setTimeout(advance, 450);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, cpu]);
  // The instruction being worked on: after fetch the PC has already moved on.
  const active = cpu.phase === 'fetch' ? cpu.pc : cpu.pc - 1;
  const jumped = cpu.phase === 'fetch' && cpu.cycles > 0 && cpu.pc !== prev.pc;

  return (
    <div className="space-y-3">
      <ol className="flex gap-1" aria-label="Cycle phase">
        {PHASES.map((p) => (
          <li key={p} aria-current={!cpu.halted && cpu.phase === p ? 'step' : undefined}
            className={`flex-1 rounded-lg border-2 px-2 py-1 text-center text-sm font-semibold capitalize ${!cpu.halted && cpu.phase === p ? 'border-accent bg-accent text-accent-fg' : 'border-border text-muted'}`}>{p}</li>
        ))}
      </ol>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h4 className="mb-1 text-sm font-semibold">Program</h4>
          <ol className="rounded-xl bg-surface2 py-1 font-mono text-sm">
            {program.map((line, i) => (
              <li key={i} aria-current={i === cpu.pc && !cpu.halted ? 'true' : undefined} className={`flex gap-3 px-3 py-0.5 ${i === active && cpu.phase !== 'fetch' ? 'bg-accent-soft font-bold' : ''}`}>
                <span className="w-5 text-right text-muted">{i}</span><span className="flex-1">{line}</span>
                {i === cpu.pc && !cpu.halted && <span className="text-xs font-semibold text-accent">&larr; PC</span>}
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Registers</h4>
          <div className="grid grid-cols-4 gap-1.5">
            {cpu.reg.map((r, i) => <Cell key={i} label={`R${i}`} value={r} hot={r !== prev.reg[i]} />)}
            <Cell label="PC" value={cpu.pc} hot={cpu.pc !== prev.pc} /><Cell label="Zero flag" value={cpu.zero ? 1 : 0} hot={cpu.zero !== prev.zero} />
            <div className="col-span-2"><Cell label="Instruction register" value={cpu.ir || '(empty)'} hot={cpu.ir !== prev.ir} /></div>
          </div>
          <h4 className="text-sm font-semibold">Data memory</h4>
          <div className="grid grid-cols-8 gap-1">{cpu.mem.map((m, i) => <Cell key={i} label={`${i}`} value={m} hot={m !== prev.mem[i]} />)}</div>
        </div>
      </div>
      <p className="min-h-[3rem] rounded-xl bg-surface2 px-3 py-2 text-sm" aria-live="polite">{cpu.note}{jumped && ' The program counter changed, so the next fetch comes from a different place.'}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={advance} disabled={cpu.halted || running}>Step</button>
        <button type="button" className="btn" onClick={() => setRunning(!running)} disabled={cpu.halted}>{running ? 'Pause' : 'Run'}</button>
        <button type="button" className="btn" onClick={() => { setRunning(false); const c = reset(memory); setCpu(c); setPrev(c); }}>Reset</button>
        <span className="text-sm text-muted">{cpu.cycles} instruction{cpu.cycles === 1 ? '' : 's'} executed{cpu.halted ? '. Halted.' : ''}</span>
      </div>
    </div>
  );
}
