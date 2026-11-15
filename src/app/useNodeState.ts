import { useMemo } from 'react';
import { catalog } from '../content';
import type { SkillNode } from '../content/schema';
import { nodeState, type NodeState } from '../graph/graph';
import { useProgress } from '../progress/store';

export function useNodeStates(): Map<string, NodeState> {
  const nodes = useProgress((s) => s.nodes);
  return useMemo(() => new Map(catalog.nodes.map((n) => [n.id, nodeState(n, (id) => nodes[id])])), [nodes]);
}
export function useNodeState(node: SkillNode): NodeState {
  const nodes = useProgress((s) => s.nodes);
  return useMemo(() => nodeState(node, (id) => nodes[id]), [node, nodes]);
}
export const STATE_LABEL: Record<NodeState['state'], string> = {
  mastered: 'Mastered', available: 'Available', locked: 'Locked', 'coming-soon': 'Coming soon',
};
