<script setup lang="ts">
interface MatchedRange {
  id: string;
  message?: string;
  matched: boolean;
}

withDefaults(
  defineProps<{
    results: number[];
    total: number;
    isSuccess: boolean;
    mode: "threshold" | "range";
    message?: string;
    matchedRanges?: MatchedRange[];
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);
</script>

<template>
  <div :class="compact ? 'space-y-1' : 'space-y-2'">
    <!-- Individual rolls -->
    <div class="flex flex-wrap gap-1">
      <span
        v-for="(result, index) in results"
        :key="index"
        class="inline-flex items-center justify-center rounded bg-gray-700 text-white font-bold"
        :class="compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'"
      >
        {{ result }}
      </span>
    </div>

    <!-- Total -->
    <div
      class="flex items-center justify-between border-t border-gray-700"
      :class="compact ? 'pt-1' : 'pt-2'"
    >
      <span :class="compact ? 'text-gray-400 text-xs' : 'text-gray-400 text-sm'">Total:</span>
      <span
        class="font-bold"
        :class="[
          compact ? 'text-sm' : 'text-lg',
          mode === 'range'
            ? (isSuccess ? 'text-purple-400' : 'text-gray-400')
            : (isSuccess ? 'text-green-400' : 'text-red-400'),
        ]"
      >
        {{ total }}
      </span>
    </div>

    <!-- Result message - Threshold mode -->
    <template v-if="mode !== 'range'">
      <div
        v-if="message"
        :class="[
          compact ? 'mt-1 p-1 rounded text-xs' : 'mt-2 p-2 border rounded text-sm',
          isSuccess
            ? (compact ? 'bg-green-900/50 text-green-300' : 'bg-green-900/50 border-green-700 text-green-300')
            : (compact ? 'bg-red-900/50 text-red-300' : 'bg-red-900/50 border-red-700 text-red-300'),
        ]"
      >
        {{ message }}
      </div>
    </template>

    <!-- Result messages - Range mode -->
    <template v-else-if="matchedRanges">
      <template
        v-for="range in matchedRanges.filter((r) => r.matched)"
        :key="range.id"
      >
        <div
          v-if="range.message"
          :class="[
            compact ? 'mt-1 p-1 rounded text-xs' : 'mt-2 p-2 border rounded text-sm',
            compact ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-900/50 border-purple-700 text-purple-300',
          ]"
        >
          {{ range.message }}
        </div>
      </template>
    </template>
  </div>
</template>
