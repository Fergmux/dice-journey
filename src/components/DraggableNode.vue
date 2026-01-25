<script setup lang="ts">
import {
  computed,
  inject,
  ref,
  type Ref,
  toRef,
  useTemplateRef,
} from "vue";

import { useDraggable } from "@vueuse/core";

import type { Die } from "../Config";

interface PendingConnection {
  sourceNodeId: string;
  dieId: string;
  type: "success" | "failure";
}

const tooltipsEnabled = inject<Ref<boolean>>("tooltipsEnabled", ref(true));

function tooltip(value: string) {
  return { value, disabled: !tooltipsEnabled.value };
}

const props = defineProps<{
  id: string;
  initialX: number;
  initialY: number;
  container: HTMLElement | null;
}>();

const dice = defineModel<Die[]>("dice", {
  default: () => [{ id: "1", count: 1, value: 6 }],
});

const emit = defineEmits<{
  (e: "update:position", id: string, x: number, y: number): void;
  (
    e: "connectionComplete",
    sourceNodeId: string,
    dieId: string,
    type: "success" | "failure",
    targetNodeId: string,
  ): void;
  (e: "connectionRemoved"): void;
  (e: "delete", id: string): void;
}>();

function deleteNode() {
  emit("delete", props.id);
}

// Inject connection state and methods from Builder
const pendingConnection =
  inject<Ref<PendingConnection | null>>("pendingConnection");
const startConnection =
  inject<
    (sourceNodeId: string, dieId: string, type: "success" | "failure") => void
  >("startConnection");
const cancelConnection = inject<() => void>("cancelConnection");

const el = useTemplateRef("node");
const inputCircle = useTemplateRef<HTMLElement>("inputCircle");
const containerRef = toRef(props, "container");

// Store refs to success/failure circles by die id
const successCircleRefs = ref<Record<string, HTMLElement | null>>({});
const failureCircleRefs = ref<Record<string, HTMLElement | null>>({});

const name = defineModel<string>({ default: "" });

const { x, y, style } = useDraggable(el, {
  initialValue: { x: props.initialX, y: props.initialY },
  containerElement: containerRef,
  onMove: () => {
    // Update position during drag so lines follow
    emit("update:position", props.id, x.value, y.value);
  },
  onEnd: () => {
    emit("update:position", props.id, x.value, y.value);
  },
});

// Check if this node can be a target (not the source node)
const canBeTarget = computed(() => {
  return (
    pendingConnection?.value &&
    pendingConnection.value.sourceNodeId !== props.id
  );
});

// Check if a specific die's circle is the active source
function isActiveSource(dieId: string, type: "success" | "failure") {
  return (
    pendingConnection?.value?.sourceNodeId === props.id &&
    pendingConnection?.value?.dieId === dieId &&
    pendingConnection?.value?.type === type
  );
}

// Remove all connections for a die
function removeAllDieConnections(dieId: string, type: "success" | "failure") {
  const die = dice.value?.find((d) => d.id === dieId);
  if (die) {
    if (type === "success" && die.onSuccess) {
      die.onSuccess.rollIds = [];
    } else if (type === "failure" && die.onFailure) {
      die.onFailure.rollIds = [];
    }
  }
}

// Check if a die has any connections
function hasConnections(dieId: string, type: "success" | "failure"): boolean {
  const die = dice.value?.find((d) => d.id === dieId);
  if (!die) return false;
  if (type === "success") {
    return (die.onSuccess?.rollIds?.length ?? 0) > 0;
  } else {
    return (die.onFailure?.rollIds?.length ?? 0) > 0;
  }
}

// Start a connection from a green/red circle, or remove all if already active
function handleCircleClick(dieId: string, type: "success" | "failure") {
  // If this circle is already the active source, remove all connections and cancel
  if (isActiveSource(dieId, type)) {
    removeAllDieConnections(dieId, type);
    if (cancelConnection) {
      cancelConnection();
    }
    emit("connectionRemoved");
    return;
  }

  if (startConnection) {
    startConnection(props.id, dieId, type);
  }
}

// Complete a connection when white circle is clicked
function handleInputClick() {
  if (pendingConnection?.value && canBeTarget.value && cancelConnection) {
    const { sourceNodeId, dieId, type } = pendingConnection.value;
    emit("connectionComplete", sourceNodeId, dieId, type, props.id);
    cancelConnection();
  }
}

// Add a connection to a die (supports multiple connections)
function setDieConnection(
  dieId: string,
  type: "success" | "failure",
  targetNodeId: string,
) {
  const die = dice.value?.find((d) => d.id === dieId);
  if (die) {
    if (type === "success") {
      if (!die.onSuccess) {
        die.onSuccess = { message: "", rollIds: [] };
      }
      if (!die.onSuccess.rollIds) {
        die.onSuccess.rollIds = [];
      }
      // Add if not already connected
      if (!die.onSuccess.rollIds.includes(targetNodeId)) {
        die.onSuccess.rollIds.push(targetNodeId);
      }
    } else {
      if (!die.onFailure) {
        die.onFailure = { message: "", rollIds: [] };
      }
      if (!die.onFailure.rollIds) {
        die.onFailure.rollIds = [];
      }
      // Add if not already connected
      if (!die.onFailure.rollIds.includes(targetNodeId)) {
        die.onFailure.rollIds.push(targetNodeId);
      }
    }
  }
}

// Generate unique die ID based on node id and timestamp
function generateDieId() {
  return `${props.id}-die-${Date.now()}`;
}

// Add a new die row
function addDie() {
  if (!dice.value) return;
  dice.value.push({
    id: generateDieId(),
    value: 6,
    count: 1,
  });
}

// Delete a die by ID
function deleteDie(dieId: string) {
  if (!dice.value) return;
  const index = dice.value.findIndex((d) => d.id === dieId);
  if (index !== -1) {
    dice.value.splice(index, 1);
    // Clean up circle refs
    delete successCircleRefs.value[dieId];
    delete failureCircleRefs.value[dieId];
  }
}

// Get the center position of a circle element relative to container
function getCircleCenter(
  el: HTMLElement | null | undefined,
  containerEl: HTMLElement | null,
): { x: number; y: number } | null {
  if (!el || !containerEl) return null;
  const rect = el.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();
  return {
    x: rect.left - containerRect.left + rect.width / 2,
    y: rect.top - containerRect.top + rect.height / 2,
  };
}

// Get position of the input (white) circle
function getInputCirclePosition(containerEl: HTMLElement | null) {
  return getCircleCenter(inputCircle.value ?? null, containerEl);
}

// Get position of a success/failure circle for a specific die
function getOutputCirclePosition(
  dieId: string,
  type: "success" | "failure",
  containerEl: HTMLElement | null,
) {
  const refs =
    type === "success" ? successCircleRefs.value : failureCircleRefs.value;
  return getCircleCenter(refs[dieId] ?? null, containerEl);
}

// Expose methods and data for parent to call/read
defineExpose({
  setDieConnection,
  dice,
  x,
  y,
  getInputCirclePosition,
  getOutputCirclePosition,
});
</script>

<template>
  <div
    ref="node"
    class="bg-gray-800 absolute cursor-move rounded-lg select-none shadow-xl border border-gray-600"
    :style
  >
    <!-- Header with input circle and controls -->
    <div
      class="flex items-center justify-between px-3 py-2 bg-gray-700 rounded-t-lg border-b border-gray-600 gap-2"
    >
      <!-- Input circle (white) - click to complete a connection -->
      <div
        ref="inputCircle"
        class="w-5 h-5 rounded-full cursor-pointer transition-all border-2 border-gray-400"
        :class="[
          canBeTarget
            ? 'bg-yellow-400 border-yellow-300 ring-2 ring-yellow-200 animate-pulse'
            : 'bg-white hover:bg-gray-200',
        ]"
        @click.stop="handleInputClick"
        v-tooltip.bottom="tooltip('Drop connection here')"
      ></div>

      <!-- Node name input -->
      <input
        type="text"
        v-model="name"
        class="flex-1 mx-2 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm font-medium focus:border-blue-500 focus:outline-none"
        placeholder="Node name"
      />

      <!-- Add die button -->
      <button
        class="py-2 px-3 text-white bg-gray-600 hover:text-green-500 hover:bg-green-900/50 rounded shadow-lg transition-colors cursor-pointer"
        @click.stop="addDie"
        v-tooltip.bottom="tooltip('Add die')"
      >
        <i class="pi pi-plus"></i>
      </button>

      <!-- Delete button -->
      <button
        class="py-2 px-3 text-gray-300 bg-gray-600 hover:text-red-400 hover:bg-red-900/50 rounded shadow-lg transition-colors cursor-pointer"
        @click.stop="deleteNode"
        v-tooltip.bottom="tooltip('Delete node')"
      >
        <i class="pi pi-trash"></i>
      </button>
    </div>

    <!-- Dice table -->
    <div class="p-2">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-gray-400 text-xs uppercase">
            <th class="w-4"></th>
            <th class="text-left px-1">Name</th>
            <th class="text-center px-1 w-12">Dice</th>
            <th class="text-center px-1 w-12">Win</th>
            <th class="text-left px-1">Messages</th>
            <th class="w-10"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="die in dice"
            :key="die.id"
            class="border-t border-gray-700"
          >
            <!-- Delete die -->
            <td>
              <i
                class="pi p-2 pi-times text-[10px] text-gray-500 hover:text-red-400 cursor-pointer transition-colors"
                @click.stop="deleteDie(die.id)"
                v-tooltip.bottom="tooltip('Delete die')"
              ></i>
            </td>

            <!-- Die name -->
            <td class="py-2 px-1">
              <input
                type="text"
                v-model="die.name"
                class="w-24 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-xs focus:border-blue-500 focus:outline-none"
                placeholder="Name"
              />
            </td>

            <!-- Dice notation (count + d + sides) -->
            <td class="py-2 px-1">
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  v-model="die.count"
                  class="w-10 px-1 py-1 bg-gray-900 border border-gray-600 rounded text-white text-xs text-center focus:border-blue-500 focus:outline-none"
                  min="1"
                />
                <span class="text-gray-400 text-xs">d</span>
                <select
                  v-model="die.value"
                  class="w-12 px-1 py-1 bg-gray-900 border border-gray-600 rounded text-white text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="4">4</option>
                  <option value="6">6</option>
                  <option value="8">8</option>
                  <option value="10">10</option>
                  <option value="12">12</option>
                  <option value="20">20</option>
                </select>
              </div>
            </td>

            <!-- Success threshold -->
            <td class="py-2 px-1">
              <input
                type="number"
                v-model="die.success"
                class="w-10 px-1 py-1 bg-gray-900 border border-gray-600 rounded text-white text-xs text-center focus:border-blue-500 focus:outline-none"
                placeholder="—"
                min="0"
              />
            </td>

            <!-- Success/Failure messages -->
            <td class="py-2 px-1">
              <div class="flex flex-col gap-1">
                <input
                  type="text"
                  :value="die.onSuccess?.message ?? ''"
                  @input="
                    (e) => {
                      if (!die.onSuccess)
                        die.onSuccess = { message: '', rollId: '' };
                      die.onSuccess.message = (
                        e.target as HTMLInputElement
                      ).value;
                    }
                  "
                  class="w-24 px-2 py-0.5 bg-green-900/30 border border-green-700/50 rounded text-green-300 text-xs focus:border-green-500 focus:outline-none"
                />
                <input
                  type="text"
                  :value="die.onFailure?.message ?? ''"
                  @input="
                    (e) => {
                      if (!die.onFailure)
                        die.onFailure = { message: '', rollId: '' };
                      die.onFailure.message = (
                        e.target as HTMLInputElement
                      ).value;
                    }
                  "
                  class="w-24 px-2 py-0.5 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-xs focus:border-red-500 focus:outline-none"
                />
              </div>
            </td>

            <!-- Connection circles -->
            <td class="py-2">
              <div class="flex flex-col items-center gap-2">
                <!-- Success (green) circle -->
                <div
                  :ref="(el) => (successCircleRefs[die.id] = el as HTMLElement)"
                  class="w-4 h-4 bg-green-600 rounded-full cursor-pointer transition-all hover:scale-110 hover:bg-green-500"
                  :class="{
                    'ring-2 ring-green-300 scale-125': isActiveSource(
                      die.id,
                      'success',
                    ),
                    'ring-1 ring-green-300': hasConnections(die.id, 'success'),
                  }"
                  v-tooltip.bottom="
                    tooltip(
                      hasConnections(die.id, 'success')
                        ? `${die.onSuccess?.rollIds?.length} connection(s) - click to add more or remove all`
                        : 'Click to connect success',
                    )
                  "
                  @click.stop="handleCircleClick(die.id, 'success')"
                ></div>
                <!-- Failure (red) circle -->
                <div
                  :ref="(el) => (failureCircleRefs[die.id] = el as HTMLElement)"
                  class="w-4 h-4 bg-red-600 rounded-full cursor-pointer transition-all hover:scale-110 hover:bg-red-500"
                  :class="{
                    'ring-2 ring-red-300 scale-125': isActiveSource(
                      die.id,
                      'failure',
                    ),
                    'ring-1 ring-red-300': hasConnections(die.id, 'failure'),
                  }"
                  v-tooltip.bottom="
                    tooltip(
                      hasConnections(die.id, 'failure')
                        ? `${die.onFailure?.rollIds?.length} connection(s) - click to add more or remove all`
                        : 'Click to connect failure',
                    )
                  "
                  @click.stop="handleCircleClick(die.id, 'failure')"
                ></div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
