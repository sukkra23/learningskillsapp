import { Link, useParams } from 'react-router-dom';
import { widgetInfo } from '../widgets/registry';
import { WidgetHost } from '../widgets/WidgetHost';
import { NotFound } from './NotFound';

/** Props for widgets that need something to show when opened on their own. */
const LAB_PROPS: Record<string, Record<string, unknown>> = {
  'function-plot': { expr: 'a * sin(b * x) + c', params: [{ name: 'a', label: 'Amplitude a', min: -3, max: 3, step: 0.1, value: 2 }, { name: 'b', label: 'Frequency b', min: 0.2, max: 4, step: 0.1, value: 1 }, { name: 'c', label: 'Shift c', min: -3, max: 3, step: 0.1, value: 0 }], xRange: [-6.5, 6.5], yRange: [-5, 5], mode: 'tangent' },
  'cpu-sim': { program: ['LOADI R0, 0', 'LOAD R1, 0', 'LOADI R2, 1', 'ADD R0, R1', 'SUB R1, R2', 'JNZ 3', 'STORE R0, 1', 'HALT'], memory: { 0: 4 } },
  'force-diagram': { forces: [[10, 0], [6, 120]], mass: 2 },
  circuit: { preset: 'two-loop' },
  alu: { bits: 8 },
};

export function LabPage() {
  const { widget } = useParams();
  if (widget) {
    const info = widgetInfo[widget];
    if (!info) return <NotFound />;
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-sm text-muted"><Link to="/lab" className="underline">Lab</Link> / {info.group}</p>
        <h1 className="text-3xl">{info.title}</h1>
        <p className="text-muted">{info.blurb}</p>
        <WidgetHost widget={{ type: widget, props: LAB_PROPS[widget] ?? {} }} />
      </div>
    );
  }
  const groups = [...new Set(Object.values(widgetInfo).map((w) => w.group))];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl">Lab</h1>
        <p className="mt-1 max-w-3xl text-muted">Every interactive in Orbit, free to explore without a lesson. Nothing here is locked, and several belong to topics whose lessons are still being written.</p>
      </header>
      {groups.map((g) => (
        <section key={g} aria-label={g}>
          <h2 className="mb-2 text-xl">{g}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(widgetInfo).filter(([, w]) => w.group === g).map(([type, w]) => (
              <li key={type}><Link to={`/lab/${type}`} className="card block h-full transition hover:border-accent"><span className="text-lg font-semibold">{w.title}</span><span className="mt-1 block text-sm text-muted">{w.blurb}</span></Link></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
