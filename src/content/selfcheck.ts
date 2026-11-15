import type { Catalog } from './catalog';

/** Replaced in Phase 2 with a check that each question's stated answer passes its own grader. */
export function selfCheckContent(_catalog: Catalog): string[] {
  return [];
}
