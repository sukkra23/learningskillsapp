import { useRef, useState } from 'react';
import { useTheme, type ThemeChoice } from '../app/theme';
import { exportFile, importFile } from '../progress/persistence';
import { snapshot, useProgress } from '../progress/store';

export function Settings() {
  const { choice, set } = useTheme();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const doExport = () => {
    const url = URL.createObjectURL(new Blob([exportFile(snapshot())], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `orbit-backup-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
    setMsg({ ok: true, text: 'Backup downloaded.' });
  };
  const doImport = async (f: File | undefined) => {
    if (!f) return;
    const r = importFile(await f.text());
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    if (!window.confirm('Replace all progress on this device with the contents of this backup?')) return;
    useProgress.getState().replaceAll(r.data);
    setMsg({ ok: true, text: 'Backup restored.' });
    if (file.current) file.current.value = '';
  };
  const doReset = () => {
    if (!window.confirm('Erase all progress, notes and bookmarks on this device? This cannot be undone.')) return;
    useProgress.getState().reset();
    setMsg({ ok: true, text: 'Progress erased.' });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-3xl">Settings</h1>
      <section className="card">
        <h2 className="text-lg">Appearance</h2>
        <fieldset className="mt-3">
          <legend className="text-sm text-muted">Theme</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['system', 'light', 'dark'] as ThemeChoice[]).map((c) => (
              <label key={c} className={`btn cursor-pointer ${choice === c ? 'btn-primary' : ''}`}>
                <input type="radio" name="theme" className="sr-only" checked={choice === c} onChange={() => set(c)} />
                {c === 'system' ? 'Match system' : c === 'light' ? 'Light' : 'Dark'}
              </label>
            ))}
          </div>
        </fieldset>
      </section>
      <section className="card">
        <h2 className="text-lg">Backup</h2>
        <p className="mt-1 text-sm text-muted">Progress is stored only in this browser. Export a file to keep a copy or move to another device.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={doExport}>Export progress</button>
          <label className="btn cursor-pointer">Import progress<input ref={file} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void doImport(e.target.files?.[0])} /></label>
          <button type="button" className="btn border-danger text-danger" onClick={doReset}>Erase all progress</button>
        </div>
        <p role="status" className={`mt-3 text-sm ${msg?.ok === false ? 'text-danger' : 'text-success'}`}>{msg?.text}</p>
      </section>
    </div>
  );
}
