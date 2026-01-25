<script setup lang="ts">
defineProps<{
  title: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-100"
      @click="emit('close')"
    >
      <div
        class="bg-gray-800 rounded-lg shadow-2xl border border-gray-600 w-full max-w-lg mx-4"
        @click.stop
      >
        <!-- Modal header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-600">
          <h3 class="text-white font-medium">
            {{ title }}
          </h3>
          <button
            class="text-gray-400 hover:text-white transition-colors cursor-pointer"
            @click="emit('close')"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>
        <!-- Modal body -->
        <div class="p-4">
          <slot />
        </div>
        <!-- Modal footer -->
        <div
          v-if="$slots.footer"
          class="flex justify-end gap-3 px-4 py-3 border-t border-gray-600"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
