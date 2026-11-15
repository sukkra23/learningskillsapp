export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
      <span className="text-sm tabular-nums text-muted">{value} / {max}</span>
    </div>
  );
}
