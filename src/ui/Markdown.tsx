import katex from 'katex';
import 'katex/dist/katex.min.css';
import { marked } from 'marked';
import { memo, useMemo } from 'react';

const tex = (src: string, displayMode: boolean) =>
  katex.renderToString(src, { displayMode, throwOnError: false, output: 'htmlAndMathml' });

/**
 * Renders Markdown with $inline$ and $$display$$ math. Math is pulled out
 * before Markdown parsing so underscores and backslashes survive untouched.
 * Content is authored in this repository, never user-supplied.
 */
export function renderMarkdown(src: string, inline = false): string {
  const math: string[] = [];
  const stash = (html: string) => `\u0000${math.push(html) - 1}\u0000`;
  let text = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => stash(tex(m.trim(), true)));
  text = text.replace(/(?<![\\$\w])\$([^$\n]+?)\$(?!\d)/g, (_, m) => stash(tex(m, false)));
  text = text.replace(/\\\$/g, '$');
  const html = inline ? (marked.parseInline(text) as string) : (marked.parse(text) as string);
  // eslint-disable-next-line no-control-regex
  return html.replace(/\u0000(\d+)\u0000/g, (_, i) => math[+i]);
}

export const Markdown = memo(function Markdown({ children, inline = false, className = '' }: { children: string; inline?: boolean; className?: string }) {
  const html = useMemo(() => renderMarkdown(children, inline), [children, inline]);
  const Tag = inline ? 'span' : 'div';
  return <Tag className={`${inline ? '' : 'prose-orbit'} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
});
