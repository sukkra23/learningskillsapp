import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { Compartment, EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, basicSetup } from 'codemirror';
import { useEffect, useRef } from 'react';
import type { Lang } from '../content/schema';
import { useTheme } from '../app/theme';

const langExt = (l: Lang) => ({ python: python(), javascript: javascript(), java: java(), cpp: cpp(), c: cpp(), rust: rust() })[l];
const light = EditorView.theme({ '&': { backgroundColor: 'rgb(var(--surface))', color: 'rgb(var(--fg))' }, '.cm-gutters': { backgroundColor: 'rgb(var(--surface2))', color: 'rgb(var(--muted))', border: 'none' } });

export function CodeEditor({ value, onChange, language, readOnly = false, label }: { value: string; onChange?(v: string): void; language: Lang; readOnly?: boolean; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const themeC = useRef(new Compartment());
  const dark = useTheme((s) => s.resolved === 'dark');
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup, langExt(language), themeC.current.of(dark ? oneDark : light),
          EditorState.readOnly.of(readOnly), EditorView.contentAttributes.of({ 'aria-label': label }),
          EditorView.updateListener.of((u) => { if (u.docChanged) cb.current?.(u.state.doc.toString()); }),
          EditorView.theme({ '&': { fontSize: '14px', borderRadius: '12px', overflow: 'hidden' }, '.cm-scroller': { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', minHeight: '9rem', maxHeight: '24rem' } }),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // Recreate only when the language changes; value is pushed in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly]);

  useEffect(() => { view.current?.dispatch({ effects: themeC.current.reconfigure(dark ? oneDark : light) }); }, [dark]);
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} className="rounded-xl border border-strong" />;
}
