import { redirect, type LoaderFunctionArgs } from 'react-router-dom';
import { catalog } from '../content';
import { canEnter, canTestOut, nodeState } from '../graph/graph';
import { progressLookup } from '../progress/store';

/**
 * Route guards. Lessons, problem sets and checkpoints can only be opened when
 * the node is available or mastered; typing the URL of a locked node lands on
 * its overview page, which lists the missing prerequisites.
 */
export function guardLearn({ params }: LoaderFunctionArgs) {
  const node = catalog.byId.get(params.nodeId ?? '');
  if (!node) throw new Response('Not found', { status: 404 });
  if (!canEnter(nodeState(node, progressLookup()))) return redirect(`/node/${node.id}?locked=1`);
  return null;
}

/** Test-out additionally requires that the node is not already mastered. */
export function guardTestOut({ params }: LoaderFunctionArgs) {
  const node = catalog.byId.get(params.nodeId ?? '');
  if (!node) throw new Response('Not found', { status: 404 });
  if (!canTestOut(nodeState(node, progressLookup()))) return redirect(`/node/${node.id}?locked=1`);
  return null;
}
