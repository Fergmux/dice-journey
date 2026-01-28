<script setup lang="ts">
import {
  computed,
  provide,
} from "vue";

import { useRoute } from "vue-router";

import { useLocalStorage } from "@vueuse/core";

import NavButton from "./components/NavButton.vue";

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
      <NavButton to="/" icon="pi-home" label="Home" :active="isHome" />
      <NavButton to="/builder" icon="pi-sitemap" label="Builder" :active="isBuilder" />
      <NavButton to="/roller" icon="pi-box" label="Roller" :active="isRoller" />
      <NavButton to="/history" icon="pi-history" label="History" :active="isHistory" />
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
