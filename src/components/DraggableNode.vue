<script setup lang="ts">
import {
  computed,
  inject,
  ref,
  type Ref,
  toRef,
  useTemplateRef,
} from "vue";

import {
  onClickOutside,
  useDraggable,
} from "@vueuse/core";

import type { Die } from "../Config";

interface PendingConnection {
  sourceNodeId: string;
  dieId: string;
  type: "success" | "failure" | "range";
  rangeId?: string; // For range connections
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

const notes = defineModel<string>("notes", { default: "" });

const emit = defineEmits<{
  (e: "update:position", id: string, x: number, y: number): void;
  (
    e: "connectionComplete",
    sourceNodeId: string,
    dieId: string,
    type: "success" | "failure" | "range",
    targetNodeId: string,
    rangeId?: string,
  ): void;
  (e: "connectionRemoved"): void;
  (e: "delete", id: string): void;
  (e: "copy", nodeData: { name: string; x: number; y: number; dice: Die[]; notes?: string }): void;
}>();

function deleteNode() {
  emit("delete", props.id);
}

// Menu state
const menuOpen = ref(false);
const menuContainer = useTemplateRef<HTMLElement>("menuContainer");

// Collapse state
const collapsed = ref(false);

// Notes modal state
const notesModalOpen = ref(false);

// Close menu when clicking outside
onClickOutside(menuContainer, () => {
  if (menuOpen.value) {
    menuOpen.value = false;
  }
});

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function closeMenu() {
  menuOpen.value = false;
}

function handleDelete() {
  closeMenu();
  deleteNode();
}

function handleCopy() {
  closeMenu();
  
  // Generate a new base ID for the copied node
  const newNodeId = `roll-${Date.now()}`;
  
  // Deep clone dice with new IDs and cleared connections
  const clonedDice: Die[] = (dice.value ?? []).map((die, dieIndex) => {
    const newDieId = `${newNodeId}-die-${dieIndex + 1}`;
    
    const clonedDie: Die = {
      id: newDieId,
      name: die.name,
      value: die.value,
      count: die.count,
      mode: die.mode,
      success: die.success,
    };
    
    // Clone onSuccess without rollIds (no connections)
    if (die.onSuccess) {
      clonedDie.onSuccess = {
        message: die.onSuccess.message,
        rollIds: [], // Clear connections
      };
    }
    
    // Clone onFailure without rollIds (no connections)
    if (die.onFailure) {
      clonedDie.onFailure = {
        message: die.onFailure.message,
        rollIds: [], // Clear connections
      };
    }
    
    // Clone ranges with new IDs and cleared connections
    if (die.ranges) {
      clonedDie.ranges = die.ranges.map((range, rangeIndex) => ({
        id: `${newDieId}-range-${rangeIndex + 1}`,
        min: range.min,
        max: range.max,
        label: range.label,
        message: range.message,
        rollIds: [], // Clear connections
      }));
    }
    
    return clonedDie;
  });
  
  // Emit with offset position so the copy doesn't overlap exactly
  emit("copy", {
    name: name.value ? `${name.value} (copy)` : "",
    x: x.value + 30,
    y: y.value + 30,
    dice: clonedDice,
    notes: notes.value,
  });
}

function handleNotes() {
  closeMenu();
  notesModalOpen.value = true;
}

function closeNotesModal() {
  notesModalOpen.value = false;
}

function handleCollapse() {
  closeMenu();
  collapsed.value = !collapsed.value;
  // Emit to update connection lines after collapse/expand
  emit("connectionRemoved");
}

// Inject connection state and methods from Builder
const pendingConnection =
  inject<Ref<PendingConnection | null>>("pendingConnection");
const startConnection =
  inject<
    (sourceNodeId: string, dieId: string, type: "success" | "failure" | "range", rangeId?: string) => void
  >("startConnection");
const cancelConnection = inject<() => void>("cancelConnection");
const getConnectionTargetValidity =
  inject<(targetNodeId: string) => { valid: boolean; reason?: string }>("getConnectionTargetValidity");

const el = useTemplateRef("node");
const inputCircle = useTemplateRef<HTMLElement>("inputCircle");
const containerRef = toRef(props, "container");

// Store refs to success/failure circles by die id
const successCircleRefs = ref<Record<string, HTMLElement | null>>({});
const failureCircleRefs = ref<Record<string, HTMLElement | null>>({});
// Store refs to range circles by "dieId-rangeId"
const rangeCircleRefs = ref<Record<string, HTMLElement | null>>({});

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

// Check if this node can be a valid connection target
const connectionTargetValidity = computed(() => {
  if (!pendingConnection?.value) {
    return { valid: false, reason: "No connection in progress" };
  }
  if (getConnectionTargetValidity) {
    return getConnectionTargetValidity(props.id);
  }
  // Fallback if function not provided
  return { valid: pendingConnection.value.sourceNodeId !== props.id };
});

// Check if this node can be a target (valid connection)
const canBeTarget = computed(() => {
  return pendingConnection?.value && connectionTargetValidity.value.valid;
});

// Check if there's a pending connection but this node is an invalid target
const isInvalidTarget = computed(() => {
  return pendingConnection?.value && !connectionTargetValidity.value.valid;
});

// Check if a specific die's circle is the active source
function isActiveSource(dieId: string, type: "success" | "failure" | "range", rangeId?: string) {
  if (type === "range") {
    return (
      pendingConnection?.value?.sourceNodeId === props.id &&
      pendingConnection?.value?.dieId === dieId &&
      pendingConnection?.value?.type === type &&
      pendingConnection?.value?.rangeId === rangeId
    );
  }
  return (
    pendingConnection?.value?.sourceNodeId === props.id &&
    pendingConnection?.value?.dieId === dieId &&
    pendingConnection?.value?.type === type
  );
}

// Remove all connections for a die
function removeAllDieConnections(dieId: string, type: "success" | "failure" | "range", rangeId?: string) {
  const die = dice.value?.find((d) => d.id === dieId);
  if (die) {
    if (type === "success" && die.onSuccess) {
      die.onSuccess.rollIds = [];
    } else if (type === "failure" && die.onFailure) {
      die.onFailure.rollIds = [];
    } else if (type === "range" && rangeId && die.ranges) {
      const range = die.ranges.find((r) => r.id === rangeId);
      if (range) {
        range.rollIds = [];
      }
    }
  }
}

// Check if a die has any connections
function hasConnections(dieId: string, type: "success" | "failure" | "range", rangeId?: string): boolean {
  const die = dice.value?.find((d) => d.id === dieId);
  if (!die) return false;
  if (type === "success") {
    return (die.onSuccess?.rollIds?.length ?? 0) > 0;
  } else if (type === "failure") {
    return (die.onFailure?.rollIds?.length ?? 0) > 0;
  } else if (type === "range" && rangeId && die.ranges) {
    const range = die.ranges.find((r) => r.id === rangeId);
    return (range?.rollIds?.length ?? 0) > 0;
  }
  return false;
}

// Get connection count for a range
function getRangeConnectionCount(dieId: string, rangeId: string): number {
  const die = dice.value?.find((d) => d.id === dieId);
  if (!die?.ranges) return 0;
  const range = die.ranges.find((r) => r.id === rangeId);
  return range?.rollIds?.length ?? 0;
}

// Start a connection from a green/red/range circle, or remove all if already active
function handleCircleClick(dieId: string, type: "success" | "failure" | "range", rangeId?: string) {
  // If this circle is already the active source, remove all connections and cancel
  if (isActiveSource(dieId, type, rangeId)) {
    removeAllDieConnections(dieId, type, rangeId);
    if (cancelConnection) {
      cancelConnection();
    }
    emit("connectionRemoved");
    return;
  }

  if (startConnection) {
    startConnection(props.id, dieId, type, rangeId);
  }
}

// Complete a connection when white circle is clicked
function handleInputClick() {
  if (pendingConnection?.value && canBeTarget.value && cancelConnection) {
    const { sourceNodeId, dieId, type, rangeId } = pendingConnection.value;
    emit("connectionComplete", sourceNodeId, dieId, type, props.id, rangeId);
    cancelConnection();
  }
}

// Add a connection to a die (supports multiple connections)
function setDieConnection(
  dieId: string,
  type: "success" | "failure" | "range",
  targetNodeId: string,
  rangeId?: string,
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
    } else if (type === "failure") {
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
    } else if (type === "range" && rangeId) {
      if (!die.ranges) {
        die.ranges = [];
      }
      const range = die.ranges.find((r) => r.id === rangeId);
      if (range) {
        if (!range.rollIds) {
          range.rollIds = [];
        }
        // Add if not already connected
        if (!range.rollIds.includes(targetNodeId)) {
          range.rollIds.push(targetNodeId);
        }
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
  const die = dice.value.find((d) => d.id === dieId);
  const index = dice.value.findIndex((d) => d.id === dieId);
  if (index !== -1) {
    // Clean up range circle refs first
    if (die?.ranges) {
      for (const range of die.ranges) {
        delete rangeCircleRefs.value[`${dieId}-${range.id}`];
      }
    }
    dice.value.splice(index, 1);
    // Clean up circle refs
    delete successCircleRefs.value[dieId];
    delete failureCircleRefs.value[dieId];
  }
}

// Toggle die mode between threshold and range
function toggleDieMode(dieId: string) {
  const die = dice.value?.find((d) => d.id === dieId);
  if (die) {
    if (die.mode === "range") {
      die.mode = "threshold";
    } else {
      die.mode = "range";
      // Initialize ranges if empty
      if (!die.ranges || die.ranges.length === 0) {
        die.ranges = [
          { id: `${dieId}-range-${Date.now()}`, min: 1, max: die.value, label: "", message: "" }
        ];
      }
    }
    // Trigger connection lines to re-render since circles change
    emit("connectionRemoved");
  }
}

// Add a range to a die
function addRange(dieId: string) {
  const die = dice.value?.find((d) => d.id === dieId);
  if (die) {
    if (!die.ranges) {
      die.ranges = [];
    }
    die.ranges.push({
      id: `${dieId}-range-${Date.now()}`,
      min: 1,
      max: die.value,
      label: "",
      message: "",
    });
    // Trigger connection lines to re-render for new circle
    emit("connectionRemoved");
  }
}

// Delete a range from a die
function deleteRange(dieId: string, rangeId: string) {
  const die = dice.value?.find((d) => d.id === dieId);
  if (die?.ranges) {
    const index = die.ranges.findIndex((r) => r.id === rangeId);
    if (index !== -1) {
      die.ranges.splice(index, 1);
      // Clean up circle ref
      delete rangeCircleRefs.value[`${dieId}-${rangeId}`];
      // Trigger connection lines to re-render
      emit("connectionRemoved");
    }
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

// Get position of a success/failure/range circle for a specific die
function getOutputCirclePosition(
  dieId: string,
  type: "success" | "failure" | "range",
  containerEl: HTMLElement | null,
  rangeId?: string,
) {
  if (type === "range" && rangeId) {
    return getCircleCenter(rangeCircleRefs.value[`${dieId}-${rangeId}`] ?? null, containerEl);
  }
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
      class="flex items-center justify-between bg-gray-700 rounded-t-lg gap-2"
      :class="[
        collapsed ? 'px-2 py-1.5' : 'px-3 py-2',
        collapsed && (!dice || dice.length === 0) ? 'rounded-b-lg' : 'border-b border-gray-600'
      ]"
    >
      <!-- Input circle (white) - click to complete a connection -->
      <div
        ref="inputCircle"
        class="rounded-full transition-all border-2 shrink-0 cursor-pointer"
        :class="[
          collapsed ? 'w-4 h-4' : 'w-5 h-5',
          canBeTarget
            ? 'bg-yellow-400 border-yellow-300 ring-2 ring-yellow-200 animate-pulse'
            : isInvalidTarget
              ? 'bg-gray-500 border-gray-400 opacity-50'
              : 'bg-white hover:bg-gray-200 border-gray-400',
        ]"
        @click.stop="handleInputClick"
        v-tooltip.bottom="tooltip(
          isInvalidTarget
            ? connectionTargetValidity.reason ?? 'Invalid connection target'
            : 'Drop connection here'
        )"
      ></div>

      <!-- Node name input (expanded) -->
      <input
        v-if="!collapsed"
        type="text"
        v-model="name"
        class="flex-1 mx-2 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm font-medium focus:border-blue-500 focus:outline-none"
        placeholder="Node name"
      />
      <!-- Node name text (collapsed) -->
      <span
        v-else
        class="flex-1 text-white text-xs font-medium truncate"
      >
        {{ name || 'Unnamed' }}
      </span>

      <!-- Add die button (only when expanded) -->
      <button
        v-if="!collapsed"
        class="py-2 px-3 text-white bg-gray-600 hover:text-green-500 hover:bg-green-900/50 rounded shadow-lg transition-colors cursor-pointer"
        @click.stop="addDie"
        v-tooltip.bottom="tooltip('Add die')"
      >
        <i class="pi pi-plus"></i>
      </button>

      <!-- Menu button -->
      <div ref="menuContainer" class="relative">
        <button
          class="text-gray-300 bg-gray-600 hover:text-white hover:bg-gray-500 rounded shadow-lg transition-colors cursor-pointer"
          :class="collapsed ? 'py-1 px-2 text-xs' : 'py-2 px-3'"
          @click.stop="toggleMenu"
          v-tooltip.bottom="tooltip('Options')"
        >
          <i class="pi pi-ellipsis-v"></i>
        </button>

        <!-- Dropdown menu -->
        <div
          v-if="menuOpen"
          class="absolute right-0 top-full mt-1 w-36 bg-gray-700 rounded-lg shadow-xl border border-gray-600 z-50 overflow-hidden"
        >
          <button
            class="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2 transition-colors cursor-pointer"
            @click.stop="handleCopy"
          >
            <i class="pi pi-copy text-xs"></i>
            Copy
          </button>
          <button
            class="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2 transition-colors cursor-pointer"
            @click.stop="handleNotes"
          >
            <i class="pi pi-file-edit text-xs"></i>
            Notes
          </button>
          <button
            class="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2 transition-colors cursor-pointer"
            @click.stop="handleCollapse"
          >
            <i :class="collapsed ? 'pi pi-plus' : 'pi pi-minus'" class="text-xs"></i>
            {{ collapsed ? 'Expand' : 'Collapse' }}
          </button>
          <div class="border-t border-gray-600"></div>
          <button
            class="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-900/50 flex items-center gap-2 transition-colors cursor-pointer"
            @click.stop="handleDelete"
          >
            <i class="pi pi-trash text-xs"></i>
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Collapsed view -->
    <div v-if="collapsed" class="px-2 py-1">
      <div
        v-for="die in dice"
        :key="die.id"
        class="flex items-center gap-2 py-0.5 not-first:border-t border-gray-600 py-1"
      >
        <!-- Die name -->
        <div class="text-[10px] text-gray-400 font-medium w-24 truncate shrink-0 text-left">
          {{ die.name || `${die.count}d${die.value}` }}
        </div>
        
        <!-- Messages and circles -->
        <div class="flex-1 flex flex-col gap-px min-w-0">
          <!-- Threshold mode: success/failure rows -->
          <template v-if="die.mode !== 'range'">
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-green-400 truncate flex-1 text-right min-h-4 leading-4">
                {{ die.onSuccess?.message }}
              </span>
              <div
                :ref="(el) => (successCircleRefs[die.id] = el as HTMLElement)"
                class="w-2.5 h-2.5 bg-green-600 rounded-full cursor-pointer transition-all hover:scale-125 hover:bg-green-500 shrink-0"
                :class="{
                  'ring-2 ring-green-300 scale-125': isActiveSource(die.id, 'success'),
                  'ring-1 ring-green-300': hasConnections(die.id, 'success'),
                }"
                @click.stop="handleCircleClick(die.id, 'success')"
              ></div>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-red-400 truncate flex-1 text-right min-h-4 leading-4">
                {{ die.onFailure?.message }}
              </span>
              <div
                :ref="(el) => (failureCircleRefs[die.id] = el as HTMLElement)"
                class="w-2.5 h-2.5 bg-red-600 rounded-full cursor-pointer transition-all hover:scale-125 hover:bg-red-500 shrink-0"
                :class="{
                  'ring-2 ring-red-300 scale-125': isActiveSource(die.id, 'failure'),
                  'ring-1 ring-red-300': hasConnections(die.id, 'failure'),
                }"
                @click.stop="handleCircleClick(die.id, 'failure')"
              ></div>
            </div>
          </template>
          <!-- Range mode: one row per range -->
          <template v-else>
            <div
              v-for="range in die.ranges"
              :key="range.id"
              class="flex items-center gap-1"
            >
              <span class="text-[10px] text-purple-400 truncate flex-1 text-right min-h-4 leading-4">
                {{ range.message }}
              </span>
              <div
                :ref="(el) => (rangeCircleRefs[`${die.id}-${range.id}`] = el as HTMLElement)"
                class="w-2.5 h-2.5 bg-purple-600 rounded-full cursor-pointer transition-all hover:scale-125 hover:bg-purple-500 shrink-0"
                :class="{
                  'ring-2 ring-purple-300 scale-125': isActiveSource(die.id, 'range', range.id),
                  'ring-1 ring-purple-300': hasConnections(die.id, 'range', range.id),
                }"
                @click.stop="handleCircleClick(die.id, 'range', range.id)"
              ></div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Dice table (expanded view) -->
    <div v-else class="p-2">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-gray-400 text-xs uppercase">
            <th class="w-4"></th>
            <th class="text-left px-1">Name</th>
            <th class="text-center px-1">Dice</th>
            <th class="text-center px-1">Mode</th>
            <th class="text-center px-1">Condition</th>
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
            <td class="py-2 align-middle">
              <i
                class="pi p-2 pi-times text-[10px] text-gray-500 hover:text-red-400 cursor-pointer transition-colors"
                @click.stop="deleteDie(die.id)"
                v-tooltip.bottom="tooltip('Delete die')"
              ></i>
            </td>

            <!-- Die name -->
            <td class="py-2 px-1 align-middle">
              <input
                type="text"
                v-model="die.name"
                class="w-20 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-xs focus:border-blue-500 focus:outline-none"
                placeholder="Name"
              />
            </td>

            <!-- Dice notation (count + d + sides) -->
            <td class="py-2 px-1 align-middle">
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  v-model="die.count"
                  class="w-8 px-1 py-1 bg-gray-900 border border-gray-600 rounded text-white text-xs text-center focus:border-blue-500 focus:outline-none"
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
                  <option value="100">100</option>
                </select>
              </div>
            </td>

            <!-- Mode toggle -->
            <td class="py-2 px-1 align-middle">
              <button
                @click.stop="toggleDieMode(die.id)"
                class="px-2 py-1 text-xs rounded transition-colors cursor-pointer"
                :class="die.mode === 'range' 
                  ? 'bg-purple-600 hover:bg-purple-500 text-white' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white'"
                v-tooltip.bottom="tooltip(die.mode === 'range' ? 'Switch to threshold mode' : 'Switch to range mode')"
              >
                {{ die.mode === 'range' ? 'Range' : 'Win' }}
              </button>
            </td>

            <!-- Condition column (threshold value or range min-max) -->
            <td class="py-2 px-1" :class="die.mode !== 'range' ? 'align-middle' : 'align-top'">
              <!-- Threshold mode: just the threshold value, vertically centered -->
              <div v-if="die.mode !== 'range'" class="flex items-center gap-1">
                <span class="text-gray-400 text-xs">≥</span>
                <input
                  type="number"
                  v-model="die.success"
                  class="w-10 px-1 py-0.5 bg-gray-900 border border-gray-600 rounded text-white text-[10px] text-center focus:border-blue-500 focus:outline-none"
                  placeholder="—"
                  min="0"
                />
              </div>

              <!-- Range mode: range values stacked -->
              <div v-else class="flex flex-col gap-px">
                <div 
                  v-for="(range, index) in die.ranges" 
                  :key="range.id" 
                  class="h-[22px] flex items-center gap-1"
                >
                  <!-- Delete button for all except last, Add button for last -->
                  <i
                    v-if="index < (die.ranges?.length ?? 1) - 1"
                    class="pi pi-times text-[8px] text-gray-500 hover:text-red-400 cursor-pointer transition-colors w-3"
                    @click.stop="deleteRange(die.id, range.id)"
                    v-tooltip.bottom="tooltip('Delete range')"
                  ></i>
                  <i
                    v-else
                    class="pi pi-plus text-[8px] text-purple-400 hover:text-purple-300 cursor-pointer transition-colors w-3"
                    @click.stop="addRange(die.id)"
                    v-tooltip.bottom="tooltip('Add range')"
                  ></i>
                  <input
                    type="number"
                    v-model.number="range.min"
                    class="w-8 px-1 py-0.5 bg-gray-900 border border-gray-600 rounded text-white text-[10px] text-center focus:border-purple-500 focus:outline-none"
                    :min="1"
                    :max="die.value * die.count"
                    placeholder="min"
                  />
                  <span class="text-gray-500 text-[10px]">-</span>
                  <input
                    type="number"
                    v-model.number="range.max"
                    class="w-8 px-1 py-0.5 bg-gray-900 border border-gray-600 rounded text-white text-[10px] text-center focus:border-purple-500 focus:outline-none"
                    :min="1"
                    :max="die.value * die.count"
                    placeholder="max"
                  />
                </div>
              </div>
            </td>

            <!-- Messages column -->
            <td class="py-2 px-1" :class="die.mode !== 'range' ? 'align-middle' : 'align-top'">
              <!-- Threshold mode: success/failure messages -->
              <div v-if="die.mode !== 'range'" class="flex flex-col gap-px">
                <div class="h-[22px] flex items-center">
                  <input
                    type="text"
                    :value="die.onSuccess?.message ?? ''"
                    @input="
                      (e) => {
                        if (!die.onSuccess)
                          die.onSuccess = { message: '', rollIds: [] };
                        die.onSuccess!.message = (
                          e.target as HTMLInputElement
                        ).value;
                      }
                    "
                    class="w-20 px-2 py-0.5 bg-green-900/30 border border-green-700/50 rounded text-green-300 text-[10px] focus:border-green-500 focus:outline-none"
                    placeholder="Success"
                  />
                </div>
                <div class="h-[22px] flex items-center">
                  <input
                    type="text"
                    :value="die.onFailure?.message ?? ''"
                    @input="
                      (e) => {
                        if (!die.onFailure)
                          die.onFailure = { message: '', rollIds: [] };
                        die.onFailure!.message = (
                          e.target as HTMLInputElement
                        ).value;
                      }
                    "
                    class="w-20 px-2 py-0.5 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-[10px] focus:border-red-500 focus:outline-none"
                    placeholder="Failure"
                  />
                </div>
              </div>

              <!-- Range mode: message for each range -->
              <div v-else class="flex flex-col gap-px">
                <div
                  v-for="range in die.ranges"
                  :key="range.id"
                  class="h-[22px] flex items-center"
                >
                  <input
                    type="text"
                    v-model="range.message"
                    class="w-20 px-1 py-0.5 bg-purple-900/30 border border-purple-700/50 rounded text-purple-300 text-[10px] focus:border-purple-500 focus:outline-none"
                    :placeholder="`${range.min}-${range.max}`"
                  />
                </div>
              </div>
            </td>

            <!-- Connection circles -->
            <td class="py-2" :class="die.mode !== 'range' ? 'align-middle' : 'align-top'">
              <!-- Threshold mode circles -->
              <div v-if="die.mode !== 'range'" class="flex flex-col items-center gap-1">
                <!-- Success (green) circle - wrapper matches input height -->
                <div class="h-[22px] flex items-center">
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
                          ? isActiveSource(die.id, 'success') ? 'Click to remove all connections': 'Click to add more connections or remove them all'
                          : 'Click to connect success',
                      )
                    "
                    @click.stop="handleCircleClick(die.id, 'success')"
                  ></div>
                </div>
                <!-- Failure (red) circle - wrapper matches input height -->
                <div class="h-[22px] flex items-center">
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
                          ? isActiveSource(die.id, 'failure') ? 'Click to remove all connections': 'Click to add more connections or remove them all'
                          : 'Click to connect failure',
                      )
                    "
                    @click.stop="handleCircleClick(die.id, 'failure')"
                  ></div>
                </div>
              </div>

              <!-- Range mode circles -->
              <div v-else class="flex flex-col items-center gap-px">
                <div
                  v-for="range in die.ranges"
                  :key="range.id"
                  class="h-[22px] flex items-center"
                >
                  <div
                    :ref="(el) => (rangeCircleRefs[`${die.id}-${range.id}`] = el as HTMLElement)"
                    class="w-4 h-4 bg-purple-600 rounded-full cursor-pointer transition-all hover:scale-110 hover:bg-purple-500"
                    :class="{
                      'ring-2 ring-purple-300 scale-125': isActiveSource(die.id, 'range', range.id),
                      'ring-1 ring-purple-300': hasConnections(die.id, 'range', range.id),
                    }"
                    v-tooltip.bottom="
                      tooltip(
                        hasConnections(die.id, 'range', range.id)
                          ? isActiveSource(die.id, 'range', range.id) ? 'Click to remove all connections': 'Click to add more connections or remove them all'
                          : `Connect range ${range.min}-${range.max}`,
                      )
                    "
                    @click.stop="handleCircleClick(die.id, 'range', range.id)"
                  ></div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Notes Modal -->
    <Teleport to="body">
      <div
        v-if="notesModalOpen"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
        @click="closeNotesModal"
      >
        <div
          class="bg-gray-800 rounded-lg shadow-2xl border border-gray-600 w-full max-w-lg mx-4"
          @click.stop
        >
          <!-- Modal header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-600">
            <h3 class="text-white font-medium">
              Notes for {{ name || 'Unnamed Node' }}
            </h3>
            <button
              class="text-gray-400 hover:text-white transition-colors cursor-pointer"
              @click="closeNotesModal"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>
          <!-- Modal body -->
          <div class="p-4">
            <textarea
              v-model="notes"
              class="w-full h-48 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none resize-none"
              placeholder="Enter notes for this node..."
            ></textarea>
          </div>
          <!-- Modal footer -->
          <div class="flex justify-end px-4 py-3 border-t border-gray-600">
            <button
              class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
              @click="closeNotesModal"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
