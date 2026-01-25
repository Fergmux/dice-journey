<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";

import { useJourneyStorage } from "../composables/useJourneyStorage";
import {
  type HistorySession,
  useRollHistory,
} from "../composables/useRollHistory";

const { journeyList, currentJourney, setCurrentJourney } = useJourneyStorage();
const {
  getJourneyHistory,
  removeHistorySession,
  clearJourneyHistory,
  clearAllHistory,
  totalHistoryCount,
} = useRollHistory();

// Local selection for history view (can be different from builder/roller current journey)
const selectedJourneyId = ref<string | null>(currentJourney.value?.id ?? null);

// Get history for selected journey
const currentHistory = computed(() => {
  if (!selectedJourneyId.value) return [];
  return getJourneyHistory(selectedJourneyId.value);
});

// Get journey name by ID
const getJourneyName = (journeyId: string) => {
  const journey = journeyList.value.find((j) => j.id === journeyId);
  return journey?.name ?? "Unknown Scenario";
};

// Format timestamp
const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

// Format relative time
const formatRelativeTime = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
};

// Confirmation state for clear actions
const showClearConfirm = ref(false);
const clearMode = ref<"journey" | "all">("journey");

const requestClear = (mode: "journey" | "all") => {
  clearMode.value = mode;
  showClearConfirm.value = true;
};

const confirmClear = () => {
  if (clearMode.value === "all") {
    clearAllHistory();
  } else if (selectedJourneyId.value) {
    clearJourneyHistory(selectedJourneyId.value);
  }
  showClearConfirm.value = false;
};

const changeJourney = (id: string) => {
  selectedJourneyId.value = id;
  setCurrentJourney(id);
};

// Group history sessions by date
const groupedHistory = computed(() => {
  const groups: { date: string; sessions: HistorySession[] }[] = [];
  const dateMap = new Map<string, HistorySession[]>();

  for (const session of currentHistory.value) {
    const date = new Date(session.timestamp).toLocaleDateString();
    if (!dateMap.has(date)) {
      dateMap.set(date, []);
    }
    dateMap.get(date)!.push(session);
  }

  dateMap.forEach((sessions, date) => {
    groups.push({ date, sessions });
  });

  return groups;
});

// Get session summary (roll names)
const getSessionSummary = (session: HistorySession) => {
  if (session.rolls.length === 1 && session.rolls[0]) {
    return session.rolls[0].rollName || "Unnamed Roll";
  }
  return `${session.rolls.length} rolls`;
};
</script>

<template>
  <div class="p-4">
    <!-- Journey selector -->
    <div class="flex flex-wrap gap-2 mb-4 justify-center">
      <a
        v-for="journey in journeyList"
        :key="journey.id"
        class="cursor-pointer px-3 py-1 rounded transition-colors"
        :class="
          selectedJourneyId === journey.id
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-blue-200 hover:bg-gray-600'
        "
        @click="changeJourney(journey.id)"
      >
        {{ journey.name }}
      </a>
    </div>

    <!-- Header with clear buttons -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-4">
        <h2 class="text-xl font-bold text-white">
          Roll History
          <span v-if="selectedJourneyId" class="text-gray-400 font-normal">
            - {{ getJourneyName(selectedJourneyId) }}
          </span>
        </h2>
        <span class="text-sm text-gray-400">
          {{ currentHistory.length }} sessions
          <span v-if="totalHistoryCount > currentHistory.length">
            ({{ totalHistoryCount }} total)
          </span>
        </span>
      </div>

      <div class="flex gap-2">
        <button
          v-if="currentHistory.length > 0"
          @click="requestClear('journey')"
          class="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded shadow transition-colors cursor-pointer"
        >
          Clear Scenario History
        </button>
        <button
          v-if="totalHistoryCount > 0"
          @click="requestClear('all')"
          class="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded shadow transition-colors cursor-pointer"
        >
          Clear All History
        </button>
      </div>
    </div>

    <!-- Confirmation modal -->
    <div
      v-if="showClearConfirm"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showClearConfirm = false"
    >
      <div class="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-600 max-w-md">
        <h3 class="text-lg font-bold text-white mb-4">Confirm Clear History</h3>
        <p class="text-gray-300 mb-6">
          <template v-if="clearMode === 'all'">
            Are you sure you want to clear <strong>all</strong> roll history across all scenarios?
            This cannot be undone.
          </template>
          <template v-else>
            Are you sure you want to clear all roll history for
            <strong>{{ getJourneyName(selectedJourneyId!) }}</strong>?
            This cannot be undone.
          </template>
        </p>
        <div class="flex justify-end gap-3">
          <button
            @click="showClearConfirm = false"
            class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="confirmClear"
            class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="!selectedJourneyId || currentHistory.length === 0"
      class="text-center py-12"
    >
      <div class="text-6xl mb-4">📜</div>
      <p class="text-gray-400 text-lg">
        <template v-if="!selectedJourneyId">
          Select a scenario to view its roll history
        </template>
        <template v-else>
          No rolls recorded yet for this scenario
        </template>
      </p>
      <p class="text-gray-500 text-sm mt-2">
        Roll some dice in the Roller tab to see history here
      </p>
    </div>

    <!-- History sessions grouped by date -->
    <div v-else class="space-y-6">
      <div v-for="group in groupedHistory" :key="group.date">
        <!-- Date header -->
        <div class="sticky top-16 bg-gray-900/95 backdrop-blur-sm py-2 px-3 -mx-3 mb-3 border-b border-gray-700 z-10">
          <span class="text-sm font-semibold text-gray-400">{{ group.date }}</span>
        </div>

        <!-- Sessions for this date -->
        <div class="space-y-4">
          <div
            v-for="session in group.sessions"
            :key="session.id"
            class="bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <!-- Session header -->
            <div class="flex items-start justify-between mb-3 pb-2 border-b border-gray-700">
              <div>
                <h3 class="text-lg font-bold text-white">
                  {{ getSessionSummary(session) }}
                </h3>
                <p class="text-sm text-gray-400">
                  <span :title="formatTimestamp(session.timestamp)">
                    {{ formatRelativeTime(session.timestamp) }}
                  </span>
                </p>
              </div>
              <button
                @click="removeHistorySession(session.journeyId, session.id)"
                class="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded transition-colors cursor-pointer"
                title="Remove this session"
              >
                <i class="pi pi-trash text-sm"></i>
              </button>
            </div>

            <!-- Rolls in this session - displayed horizontally -->
            <div 
              class="flex gap-3 overflow-x-auto pb-2"
              :class="{ 'flex-wrap': session.rolls.length <= 4 }"
            >
              <div
                v-for="roll in session.rolls"
                :key="roll.rollId"
                class="bg-gray-900 rounded-lg p-3 border border-gray-700 min-w-[200px] shrink-0"
                :class="{ 'flex-1': session.rolls.length <= 4 }"
              >
                <!-- Roll name -->
                <h4 class="text-sm font-semibold text-white mb-2 pb-1 border-b border-gray-700">
                  {{ roll.rollName || "Unnamed Roll" }}
                </h4>

                <!-- Dice in this roll - horizontal grid like Roller -->
                <div
                  class="grid gap-2"
                  :style="{
                    gridTemplateColumns: `repeat(${Math.min(roll.dice.length, 3)}, 1fr)`,
                  }"
                >
                  <div
                    v-for="die in roll.dice"
                    :key="die.id"
                    class="p-2 rounded border"
                    :class="die.isSuccess ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'"
                  >
                    <!-- Die header -->
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-gray-400 text-xs font-mono">
                        {{ die.count }}d{{ die.value }}
                        <span v-if="die.success" class="text-gray-500">(≥{{ die.success }})</span>
                      </span>
                    </div>

                    <!-- Die name if present -->
                    <p v-if="die.name" class="text-white text-xs mb-1">
                      {{ die.name }}
                    </p>

                    <!-- Individual rolls -->
                    <div class="flex flex-wrap gap-1 mb-1">
                      <span
                        v-for="(result, index) in die.results"
                        :key="index"
                        class="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-700 text-white font-bold text-xs"
                      >
                        {{ result }}
                      </span>
                    </div>

                    <!-- Total -->
                    <div class="flex items-center justify-between pt-1 border-t border-gray-700">
                      <span class="text-gray-400 text-xs">Total:</span>
                      <span
                        class="font-bold text-sm"
                        :class="die.isSuccess ? 'text-green-400' : 'text-red-400'"
                      >
                        {{ die.total }}
                      </span>
                    </div>

                    <!-- Result message -->
                    <div
                      v-if="die.message"
                      class="mt-1 p-1 rounded text-xs"
                      :class="
                        die.isSuccess
                          ? 'bg-green-900/50 text-green-300'
                          : 'bg-red-900/50 text-red-300'
                      "
                    >
                      {{ die.message }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
