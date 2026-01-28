<script setup lang="ts">
import { useTooltip } from "../composables/useTooltip";

interface Journey {
  id: string;
  name: string;
}

const props = withDefaults(
  defineProps<{
    journeys: Journey[];
    selectedId: string | null;
    showLabel?: boolean;
    showAddButton?: boolean;
  }>(),
  {
    showLabel: false,
    showAddButton: false,
  }
);

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "add"): void;
}>();

const { tooltip } = useTooltip();
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 justify-center">
    <span v-if="showLabel" class="text-gray-400 text-sm mr-2">Scenarios:</span>
    <a
      v-for="journey in journeys"
      :key="journey.id"
      class="cursor-pointer px-3 py-1 rounded transition-colors text-sm"
      :class="
        selectedId === journey.id
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-blue-200 hover:bg-gray-600'
      "
      @click="emit('select', journey.id)"
    >
      {{ journey.name }}
    </a>
    <button
      v-if="showAddButton"
      @click="emit('add')"
      class="p-[6px] bg-gray-700 hover:bg-gray-600 text-green-400 rounded shadow-lg transition-colors text-sm flex items-center gap-1 cursor-pointer"
      v-tooltip.bottom="tooltip('Add a new scenario')"
    >
      <i class="pi pi-plus text-xs"></i>
    </button>
  </div>
</template>
