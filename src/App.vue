<script setup lang="ts">
// TODO: Save roll state on builder tab swap
// More responsive grid layout for roller
// Create node from connection click
// Copy node
// d100
// ranges 
// small mode/collapsible
// notes
// History

import {
  computed,
  provide,
} from "vue";

import {
  useRoute,
  useRouter,
} from "vue-router";

import { useLocalStorage } from "@vueuse/core";

const router = useRouter();
const route = useRoute();

const isHome = computed(() => route.path === "/");
const isBuilder = computed(() => route.path === "/builder");
const isRoller = computed(() => route.path === "/roller");
const isHistory = computed(() => route.path === "/history");

const tooltipsEnabled = useLocalStorage("tooltipsEnabled", true);
provide("tooltipsEnabled", tooltipsEnabled);
</script>
<template>
  <div
    class="flex justify-between items-center p-3 bg-gray-800 border-b border-gray-700 fixed top-0 w-full z-40"
  >
    <!-- Navigation buttons (left) -->
    <div class="flex items-center gap-2">
      <button
        @click="router.push('/')"
        class="px-3 py-2 font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2 cursor-pointer"
        :class="
          isHome
            ? 'bg-blue-600 text-white'
            : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
        "
      >
        <i class="pi pi-home"></i>
        Home
      </button>
      <button
        @click="router.push('/builder')"
        class="px-3 py-2 font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2 cursor-pointer"
        :class="
          isBuilder
            ? 'bg-blue-600 text-white'
            : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
        "
      >
        <i class="pi pi-sitemap"></i>
        Builder
      </button>
      <button
        @click="router.push('/roller')"
        class="px-3 py-2 font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2 cursor-pointer"
        :class="
          isRoller
            ? 'bg-blue-600 text-white'
            : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
        "
      >
        <i class="pi pi-box"></i>
        Roller
      </button>
      <button
        @click="router.push('/history')"
        class="px-3 py-2 font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2 cursor-pointer"
        :class="
          isHistory
            ? 'bg-blue-600 text-white'
            : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
        "
      >
        <i class="pi pi-history"></i>
        History
      </button>
    </div>

    <!-- Title (centered absolutely) -->
    <h1 class="absolute left-1/2 -translate-x-1/2 text-3xl font-bold text-white flex items-center gap-2 pointer-events-none">
      <span>🎲</span>
      Dice Journey
    </h1>

    <!-- Tooltips toggle (right) -->
    <div class="flex items-center gap-2">
      <label
        class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none"
      >
        <div
          @click="tooltipsEnabled = !tooltipsEnabled"
          class="relative w-10 h-5 rounded-full transition-colors cursor-pointer"
          :class="tooltipsEnabled ? 'bg-blue-600' : 'bg-gray-600'"
        >
          <div
            class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform"
            :class="tooltipsEnabled ? 'translate-x-5' : 'translate-x-0.5'"
          ></div>
        </div>
        <i class="pi pi-info-circle" v-tooltip.bottom="'Toggle tooltips on/off'"></i>
      </label>
    </div>
  </div>
  <div class="mt-18">
    <RouterView />
  </div>
</template>
