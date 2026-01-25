import {
  ref,
  type Ref,
} from "vue";

import type { Die } from "../Config";

export interface ConnectionLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: "success" | "failure";
}

interface NodeWithDice {
  id: string;
  dice?: Die[];
}

interface NodeRef {
  dice?: Die[];
  getOutputCirclePosition(
    dieId: string,
    type: "success" | "failure",
    container: HTMLElement
  ): { x: number; y: number } | null;
  getInputCirclePosition(
    container: HTMLElement
  ): { x: number; y: number } | null;
}

export function useConnectionLines(
  nodes: Ref<NodeWithDice[]>,
  nodeRefs: Ref<Record<string, NodeRef>>,
  container: Ref<HTMLElement | null>
) {
  const connectionLines = ref<ConnectionLine[]>([]);

  function updateConnectionLines() {
    const lines: ConnectionLine[] = [];
    const containerEl = container.value;
    if (!containerEl) return;

    for (const node of nodes.value) {
      const nodeRef = nodeRefs.value[node.id];
      if (!nodeRef?.dice) continue;

      for (const die of nodeRef.dice) {
        // Success connections (multiple)
        if (die.onSuccess?.rollIds) {
          for (const targetId of die.onSuccess.rollIds) {
            const targetRef = nodeRefs.value[targetId];
            if (targetRef) {
              const sourcePos = nodeRef.getOutputCirclePosition(die.id, "success", containerEl);
              const targetPos = targetRef.getInputCirclePosition(containerEl);
              if (sourcePos && targetPos) {
                lines.push({
                  id: `${node.id}-${die.id}-success-${targetId}`,
                  x1: sourcePos.x,
                  y1: sourcePos.y,
                  x2: targetPos.x,
                  y2: targetPos.y,
                  type: "success",
                });
              }
            }
          }
        }

        // Failure connections (multiple)
        if (die.onFailure?.rollIds) {
          for (const targetId of die.onFailure.rollIds) {
            const targetRef = nodeRefs.value[targetId];
            if (targetRef) {
              const sourcePos = nodeRef.getOutputCirclePosition(die.id, "failure", containerEl);
              const targetPos = targetRef.getInputCirclePosition(containerEl);
              if (sourcePos && targetPos) {
                lines.push({
                  id: `${node.id}-${die.id}-failure-${targetId}`,
                  x1: sourcePos.x,
                  y1: sourcePos.y,
                  x2: targetPos.x,
                  y2: targetPos.y,
                  type: "failure",
                });
              }
            }
          }
        }
      }
    }

    connectionLines.value = lines;
  }

  return {
    connectionLines,
    updateConnectionLines,
  };
}
