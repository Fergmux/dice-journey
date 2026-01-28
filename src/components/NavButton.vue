<script setup lang="ts">
import { useRouter } from "vue-router";

defineProps<{
  to: string;
  icon: string;
  label: string;
  active: boolean;
}>();

const router = useRouter();
</script>

<template>
  <button
    @click="router.push(to)"
    class="px-3 py-2 font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2 cursor-pointer"
    :class="
      active
        ? 'bg-blue-600 text-white'
        : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
    "
  >
    <i :class="['pi', icon]"></i>
    {{ label }}
  </button>
</template>
