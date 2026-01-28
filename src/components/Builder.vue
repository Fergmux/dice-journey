<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  provide,
  ref,
  useTemplateRef,
} from "vue";

import { useConnectionLines } from "../composables/useConnectionLines";
import { useJourneyStorage } from "../composables/useJourneyStorage";
import { useTooltip } from "../composables/useTooltip";
import DraggableNode from "./DraggableNode.vue";
import JourneyTabs from "./JourneyTabs.vue";

const { tooltip } = useTooltip();

const {
  currentJourney,
  journeyList,
  setCurrentJourney: setJourney,
  createJourney,
  deleteJourney,
  addRoll,
  updateRollPosition,
  deleteRoll,
} = useJourneyStorage();

function setCurrentJourney(journeyId: string) {
  setJourney(journeyId);
  // Update lines after journey switch and nodes re-render
  nextTick(() => updateConnectionLines());
}

function addJourney() {
  createJourney("New Scenario");
  // Update lines after new journey is created and nodes re-render
  nextTick(() => updateConnectionLines());
}

function confirmDeleteJourney() {
  if (!currentJourney.value) return;

  const hasNodes = currentJourney.value.rolls.length > 0;

  if (hasNodes) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${currentJourney.value.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;
  }

  deleteJourney(currentJourney.value.id);
  nextTick(() => updateConnectionLines());
}

// Computed nodes from current journey's rolls
const nodes = computed(() => currentJourney.value?.rolls ?? []);

function addNode(x = 50, y = 50) {
  const id = `roll-${Date.now()}`;
  const newRoll = {
    id,
    name: "",
    x,
    y,
    dice: [{ id: `${id}-die-1`, value: 6, count: 1 }],
  };
  addRoll(newRoll);
  return id;
}

const container = useTemplateRef<HTMLElement>("container");

// Template refs for node components
const nodeRefs = ref<Record<string, InstanceType<typeof DraggableNode>>>({});

// Connection lines
const { connectionLines, updateConnectionLines } = useConnectionLines(
  nodes,
  nodeRefs,
  container,
);

// Draw lines on mount after nodes are rendered
onMounted(() => {
  nextTick(() => updateConnectionLines());
});

function setNodeRef(id: string, el: InstanceType<typeof DraggableNode> | null) {
  if (el) {
    nodeRefs.value[id] = el;
  } else {
    delete nodeRefs.value[id];
  }
}

// Connection state management
export interface PendingConnection {
  sourceNodeId: string;
  dieId: string;
  type: "success" | "failure" | "range";
  rangeId?: string;
}

const pendingConnection = ref<PendingConnection | null>(null);

function startConnection(
  sourceNodeId: string,
  dieId: string,
  type: "success" | "failure" | "range",
  rangeId?: string,
) {
  pendingConnection.value = { sourceNodeId, dieId, type, rangeId };
}

function cancelConnection() {
  pendingConnection.value = null;
}

// Check if there's a path from startNodeId to endNodeId through existing connections
function canReach(startNodeId: string, endNodeId: string, visited: Set<string> = new Set()): boolean {
  if (startNodeId === endNodeId) return true;
  if (visited.has(startNodeId)) return false;

  visited.add(startNodeId);

  const node = nodes.value.find(n => n.id === startNodeId);
  if (!node?.dice) return false;

  for (const die of node.dice) {
    // Check success connections
    if (die.onSuccess?.rollIds) {
      for (const connectedId of die.onSuccess.rollIds) {
        if (canReach(connectedId, endNodeId, visited)) return true;
      }
    }
    // Check failure connections
    if (die.onFailure?.rollIds) {
      for (const connectedId of die.onFailure.rollIds) {
        if (canReach(connectedId, endNodeId, visited)) return true;
      }
    }
    // Check range connections
    if (die.ranges) {
      for (const range of die.ranges) {
        if (range.rollIds) {
          for (const connectedId of range.rollIds) {
            if (canReach(connectedId, endNodeId, visited)) return true;
          }
        }
      }
    }
  }

  return false;
}

// Check if a node is a valid connection target and return reason if not
function getConnectionTargetValidity(targetNodeId: string): { valid: boolean; reason?: string } {
  if (!pendingConnection.value) {
    return { valid: false, reason: "No connection in progress" };
  }

  const sourceNodeId = pendingConnection.value.sourceNodeId;

  // Can't connect to self
  if (targetNodeId === sourceNodeId) {
    return { valid: false, reason: "Cannot connect a node to itself" };
  }

  // Check if this would create a circular dependency
  // If the target can reach the source through existing connections, connecting source → target creates a cycle
  if (canReach(targetNodeId, sourceNodeId)) {
    return { valid: false, reason: "Would create a circular dependency" };
  }

  return { valid: true };
}

// Provide connection state and methods to child components
provide("pendingConnection", pendingConnection);
provide("startConnection", startConnection);
provide("cancelConnection", cancelConnection);
provide("getConnectionTargetValidity", getConnectionTargetValidity);

function updateNodePosition(id: string, x: number, y: number) {
  updateRollPosition(id, x, y);
  // Update lines after position change
  updateConnectionLines();
}

function deleteNode(id: string) {
  deleteRoll(id);
  delete nodeRefs.value[id];
  updateConnectionLines();
}

function copyNode(nodeData: { name: string; x: number; y: number; dice: import("../Config").Die[]; notes?: string }) {
  const newRoll = {
    id: `roll-${Date.now()}`,
    name: nodeData.name,
    x: nodeData.x,
    y: nodeData.y,
    dice: nodeData.dice,
    notes: nodeData.notes,
  };
  addRoll(newRoll);
  nextTick(() => updateConnectionLines());
}

// Handle connection completion
function handleConnectionComplete(
  sourceNodeId: string,
  dieId: string,
  type: "success" | "failure" | "range",
  targetNodeId: string,
  rangeId?: string,
) {
  const sourceNode = nodeRefs.value[sourceNodeId];
  if (sourceNode) {
    sourceNode.setDieConnection(dieId, type, targetNodeId, rangeId);
    console.log(
      `Connected: Node ${sourceNodeId}, Die ${dieId} -> ${type}${rangeId ? ` (range: ${rangeId})` : ''} -> Node ${targetNodeId}`,
    );
    // Update lines after connection is made
    nextTick(() => updateConnectionLines());
  }
}

// Handle clicking on empty space in the canvas
function handleContainerClick(event: MouseEvent) {
  // Only handle clicks directly on the container, not on nodes
  if (event.target !== container.value) return;

  // Get click position relative to container
  const containerRect = container.value?.getBoundingClientRect();
  if (!containerRect) return;

  const x = event.clientX - containerRect.left;
  const y = event.clientY - containerRect.top;

  if (pendingConnection.value) {
    // Create a new node at the click position and connect to it
    const { sourceNodeId, dieId, type, rangeId } = pendingConnection.value;
    const newNodeId = addNode(x, y);

    // Wait for the node to be rendered, then complete the connection
    nextTick(() => {
      handleConnectionComplete(sourceNodeId, dieId, type, newNodeId, rangeId);
      cancelConnection();
    });
  } else {
    // Just create a new node at the click position
    addNode(x, y);
    nextTick(() => updateConnectionLines());
  }
}
</script>

<template>
  <div class="p-4">
    <!-- Header toolbar -->
    <div
      class="bg-gray-800 rounded-lg p-4 mb-4 shadow-lg border border-gray-700 w-max m-auto max-w-[600px]"
    >
      <!-- Journey selector row -->
      <JourneyTabs
        :journeys="journeyList"
        :selected-id="currentJourney?.id ?? null"
        show-label
        show-add-button
        class="mb-4"
        @select="setCurrentJourney"
        @add="addJourney"
      />

      <!-- Current scenario name and add node -->
      <div class="flex items-center gap-2">
        <input
          v-if="currentJourney"
          type="text"
          v-model="currentJourney.name"
          class="flex-1 text-xl font-bold bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none transition-colors"
          placeholder="Scenario name"
        />
        <button
          @click="addNode()"
          class="p-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg transition-colors flex items-center cursor-pointer"
          v-tooltip.bottom="tooltip('Add a new node')"
        >
          <i class="pi pi-plus"></i>
        </button>
        <button
          @click="confirmDeleteJourney"
          class="p-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-lg transition-colors flex items-center cursor-pointer"
          v-tooltip.bottom="tooltip('Delete this scenario')"
        >
          <i class="pi pi-trash"></i>
        </button>
      </div>
    </div>

    <!-- Connection pending banner -->
    <div
      v-if="pendingConnection"
      class="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-center py-3 z-50 font-medium shadow-lg"
    >
      <i class="pi pi-link mr-2"></i>
      Connecting
      <span
        :class="[
          pendingConnection.type === 'success' ? 'text-green-800' : '',
          pendingConnection.type === 'failure' ? 'text-red-800' : '',
          pendingConnection.type === 'range' ? 'text-purple-800' : '',
        ]"
        class="font-bold"
      >
        {{ pendingConnection.type }}
      </span>
      — Click a white circle on another node to connect, or click elsewhere to
      cancel, click the coloured circle again to remove existing connections.
    </div>

    <!-- Canvas container -->
    <div
      ref="container"
      class="w-[calc(100vw-40px)] h-screen relative bg-gray-900 rounded-lg border border-gray-700 overflow-hidden"
      @click="handleContainerClick"
    >
      <!-- SVG layer for connection lines -->
      <svg class="absolute inset-0 w-full h-full pointer-events-none z-10">
        <defs>
          <!-- Arrow marker for line ends -->
          <marker
            id="arrow-success"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#00a63e" />
          </marker>
          <marker
            id="arrow-failure"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#e7000b" />
          </marker>
          <marker
            id="arrow-range"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#9333ea" />
          </marker>
        </defs>

        <!-- Connection lines -->
        <line
          v-for="line in connectionLines"
          :key="line.id"
          :x1="line.x1"
          :y1="line.y1"
          :x2="line.x2"
          :y2="line.y2"
          :stroke="line.type === 'success' ? '#00a63e' : line.type === 'failure' ? '#e7000b' : '#9333ea'"
          stroke-width="2"
          :marker-end="`url(#arrow-${line.type})`"
        />
      </svg>

      <DraggableNode
        v-for="node in nodes"
        :key="node.id"
        :ref="
          (el) => setNodeRef(node.id, el as InstanceType<typeof DraggableNode>)
        "
        v-model="node.name"
        v-model:dice="node.dice"
        v-model:notes="node.notes"
        :id="node.id"
        :initial-x="node.x"
        :initial-y="node.y"
        :container="container"
        @update:position="updateNodePosition"
        @connection-complete="handleConnectionComplete"
        @connection-removed="() => nextTick(() => updateConnectionLines())"
        @delete="deleteNode"
        @copy="copyNode"
      />
    </div>
  </div>
</template>

<style scoped></style>
