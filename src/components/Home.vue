<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();
</script>

<template>
  <div class="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-8">
    <!-- Hero section -->
    <div class="text-center max-w-2xl">
      <!-- Dice icon -->
      <div class="mb-8">
        <span class="text-8xl">🎲</span>
      </div>

      <!-- Title -->
      <h1 class="text-5xl font-bold text-white mb-4">
        Dice Journey
      </h1>

      <!-- Subtitle -->
      <p class="text-xl text-gray-400 mb-8">
        Create custom dice rolling scenarios with branching paths based on success or failure.
      </p>

      <!-- Description -->
      <div class="bg-gray-800 rounded-lg p-6 mb-8 text-left border border-gray-700">
        <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <i class="pi pi-info-circle text-blue-400"></i>
          How it works
        </h2>
        <ul class="space-y-3 text-gray-300">
          <li class="flex items-start gap-3">
            <i class="pi pi-sitemap text-green-400 mt-1"></i>
            <span><strong class="text-white">Build</strong> your dice scenarios using the visual node editor</span>
          </li>
          <li class="flex items-start gap-3">
            <i class="pi pi-link text-yellow-400 mt-1"></i>
            <span><strong class="text-white">Connect</strong> nodes to create branching paths based on roll outcomes</span>
          </li>
          <li class="flex items-start gap-3">
            <i class="pi pi-box text-blue-400 mt-1"></i>
            <span><strong class="text-white">Roll</strong> your dice and watch the journey unfold automatically</span>
          </li>
        </ul>
      </div>

      <!-- CTA Buttons -->
      <div class="flex gap-4 justify-center">
        <button
          @click="router.push('/builder')"
          class="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg transition-colors cursor-pointer flex items-center gap-2"
        >
          <i class="pi pi-sitemap"></i>
          Start Building
        </button>
        <button
          @click="router.push('/roller')"
          class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-colors cursor-pointer flex items-center gap-2"
        >
          <i class="pi pi-box"></i>
          Go to Roller
        </button>
      </div>
    </div>

    <!-- Footer hint -->
    <p class="mt-12 text-gray-500 text-sm">
      Your scenarios are automatically saved
    </p>
  </div>
</template>
