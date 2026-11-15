import { Component, Suspense, type ReactNode } from 'react';
import type { WidgetRef } from '../content/schema';
import { widgets } from './registry';
import './all';
import { widgetSchemas } from './schemas';

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p role="alert" className="text-sm text-danger">This interactive could not be shown. The rest of the lesson still works.</p> : this.props.children; }
}

/** Renders a widget by type, applying schema defaults to its props. */
export function WidgetHost({ widget }: { widget: WidgetRef }) {
  const W = widgets[widget.type];
  const parsed = widgetSchemas[widget.type]?.safeParse(widget.props);
  if (!W || !parsed?.success) return <p className="text-sm text-muted">Interactive "{widget.type}" is not available.</p>;
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 sm:p-4">
      <Boundary><Suspense fallback={<p className="p-6 text-center text-muted">Loading interactive…</p>}><W {...(parsed.data as object)} /></Suspense></Boundary>
    </div>
  );
}
