import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = LazyExoticComponent<ComponentType<any>>;

/** Widget components, loaded on demand. Keys must match ./schemas.ts (checked by a unit test). */
export const widgets: Record<string, W> = {};
export const widgetInfo: Record<string, { title: string; blurb: string; group: string }> = {};

export function register(type: string, title: string, group: string, blurb: string, load: () => Promise<{ default: ComponentType<never> }>) {
  widgets[type] = lazy(load as () => Promise<{ default: ComponentType<unknown> }>);
  widgetInfo[type] = { title, blurb, group };
}
