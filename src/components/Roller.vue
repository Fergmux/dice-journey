<script setup lang="ts">
import {
  computed,
  inject,
  ref,
  type Ref,
} from "vue";

import { useJourneyStorage } from "../composables/useJourneyStorage";
import type { Die } from "../Config";

const { currentJourney, journeyList, setCurrentJourney } = useJourneyStorage();

const tooltipsEnabled = inject<Ref<boolean>>("tooltipsEnabled", ref(true));

const resultMap = ref<Map<string, number[]>>(new Map());
const completedRollIds = ref<Set<string>>(new Set());
const rollAnimationKey = ref<Map<string, number>>(new Map());

// Mark a roll as recently rolled (for the flash effect)
const markAsRecentlyRolled = (rollId: string) => {
  // Increment the key to force animation restart
  const currentKey = rollAnimationKey.value.get(rollId) ?? 0;
  rollAnimationKey.value.set(rollId, currentKey + 1);
};

// Build a map of all dice in the current journey
const allDice = computed(() => {
  if (!currentJourney.value) return {} as Record<string, Die>;
  return currentJourney.value.rolls.reduce(
    (acc, roll) => ({
      ...acc,
      ...Object.fromEntries(roll.dice.map((dice) => [dice.id, dice])),
    }),
    {} as Record<string, Die>,
  );
});

// Find root rolls (not referenced by any dice's onSuccess/onFailure)
const rootRolls = computed(() => {
  if (!currentJourney.value) return [];

  // Collect all rollIds that are referenced by dice
  const referencedRollIds = new Set<string>();
  for (const roll of currentJourney.value.rolls) {
    for (const die of roll.dice) {
      if (die.onSuccess?.rollId) referencedRollIds.add(die.onSuccess.rollId);
      if (die.onFailure?.rollId) referencedRollIds.add(die.onFailure.rollId);
    }
  }

  // Return rolls that are not referenced
  return currentJourney.value.rolls.filter(
    (roll) => !referencedRollIds.has(roll.id),
  );
});

const getResultTotal = (diceId: string) => {
  return resultMap.value.get(diceId)?.reduce((a, b) => a + b, 0) ?? 0;
};

const getResultSuccess = (diceId: string) => {
  return getResultTotal(diceId) >= (allDice.value[diceId]?.success ?? 0);
};

const rollDice = (id: string) => {
  const dice = allDice.value[id];
  if (dice) {
    resultMap.value.set(
      dice.id,
      Array.from({ length: dice.count }, () =>
        Math.floor(Math.random() * dice.value + 1),
      ),
    );
  }
};

// Get all downstream roll IDs from a given roll (connected via onSuccess/onFailure)
const getDownstreamRolls = (rollId: string, visited = new Set<string>()): Set<string> => {
  if (visited.has(rollId) || !currentJourney.value) return visited;
  visited.add(rollId);

  const roll = currentJourney.value.rolls.find((r) => r.id === rollId);
  if (roll) {
    for (const die of roll.dice) {
      if (die.onSuccess?.rollId) getDownstreamRolls(die.onSuccess.rollId, visited);
      if (die.onFailure?.rollId) getDownstreamRolls(die.onFailure.rollId, visited);
    }
  }
  return visited;
};

const triggerRoll = (rollId?: string, isReroll = false) => {
  if (rollId && currentJourney.value) {
    const roll = currentJourney.value.rolls.find((roll) => roll.id === rollId);
    if (roll) {
      // If this is a reroll, clear this roll and all downstream rolls
      if (isReroll) {
        const downstreamRolls = getDownstreamRolls(rollId);
        for (const id of downstreamRolls) {
          completedRollIds.value.delete(id);
        }
      }

      roll.dice.forEach((dice) => {
        rollDice(dice.id);
      });
      completedRollIds.value.add(rollId);
      markAsRecentlyRolled(rollId);
      roll.dice.forEach((dice) => {
        if (getResultSuccess(dice.id) && dice.onSuccess?.rollId) {
          triggerRoll(dice.onSuccess.rollId);
        }
      });
    }
  }
};

const triggerJourney = () => {
  completedRollIds.value.clear();
  // Trigger all root rolls (nodes that aren't triggered conditionally)
  for (const roll of rootRolls.value) {
    triggerRoll(roll.id);
  }
};

const changeJourney = (id: string) => {
  setCurrentJourney(id);
  // Clear results when switching journeys
  resultMap.value.clear();
  completedRollIds.value.clear();
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
          currentJourney?.id === journey.id
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-blue-200 hover:bg-gray-600'
        "
        @click="changeJourney(journey.id)"
      >
        {{ journey.name }}
      </a>
    </div>

    <!-- Trigger button -->
    <button
      @click="triggerJourney()"
      class="mb-6 px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg transition-colors cursor-pointer"
    >
      Roll All
    </button>

    <!-- Rolls grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="roll in currentJourney?.rolls"
        :key="roll.id"
        class="bg-gray-800 rounded-lg p-4 shadow-lg border-2 border-gray-700 relative overflow-hidden"
        :class="{
          'opacity-40': !completedRollIds.has(roll.id),
        }"
      >
        <!-- Animation overlay that restarts on each roll -->
        <div
          v-if="rollAnimationKey.has(roll.id)"
          :key="rollAnimationKey.get(roll.id)"
          class="roll-flash-overlay"
        ></div>
        <!-- Roll header -->
        <div
          class="flex items-center justify-between mb-3 pb-2 border-b border-gray-600"
        >
          <h3 class="text-lg font-bold text-white">
            {{ roll.name || "Unnamed Roll" }}
          </h3>
          <button
            @click="triggerRoll(roll.id, completedRollIds.has(roll.id))"
            class="ml-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded shadow-lg transition-colors cursor-pointer"
          >
            {{ completedRollIds.has(roll.id) ? "Reroll" : "Roll" }}
          </button>
        </div>

        <!-- Dice grid -->
        <div
          class="grid gap-3"
          :style="{
            gridTemplateColumns: `repeat(${Math.min(roll.dice.length, 3)}, 1fr)`,
          }"
        >
          <div
            v-for="die in roll.dice"
            :key="die.id"
            class="bg-gray-900 rounded-lg p-3 border"
            :class="
              !resultMap.has(die.id)
                ? 'border-gray-600'
                : getResultSuccess(die.id)
                  ? 'border-green-500'
                  : 'border-red-500'
            "
          >
            <!-- Die header -->
            <div class="flex items-center justify-between mb-2">
              <span class="text-gray-400 text-sm font-mono">
                {{ die.count }}d{{ die.value }}
                <span v-if="die.success" class="text-gray-500"
                  >(≥{{ die.success }})</span
                >
              </span>
              <button
                @click="rollDice(die.id)"
                class="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded shadow-lg transition-colors text-sm cursor-pointer"
                v-tooltip.bottom="{ value: 'Reroll this die', disabled: !tooltipsEnabled }"
              >
                🎲
              </button>
            </div>

            <!-- Die name if present -->
            <p v-if="die.name" class="text-white text-sm mb-2">
              {{ die.name }}
            </p>

            <!-- Results -->
            <div v-if="resultMap.has(die.id)" class="space-y-2">
              <!-- Individual rolls -->
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="(result, index) in resultMap.get(die.id)"
                  :key="index"
                  class="inline-flex items-center justify-center w-8 h-8 rounded bg-gray-700 text-white font-bold text-sm"
                >
                  {{ result }}
                </span>
              </div>

              <!-- Total -->
              <div
                class="flex items-center justify-between pt-2 border-t border-gray-700"
              >
                <span class="text-gray-400 text-sm">Total:</span>
                <span
                  class="font-bold text-lg"
                  :class="
                    getResultSuccess(die.id) ? 'text-green-400' : 'text-red-400'
                  "
                >
                  {{ getResultTotal(die.id) }}
                </span>
              </div>

              <!-- Result message -->
              <div
                v-if="getResultSuccess(die.id) && die.onSuccess?.message"
                class="mt-2 p-2 bg-green-900/50 border border-green-700 rounded text-green-300 text-sm"
              >
                {{ die.onSuccess.message }}
              </div>
              <div
                v-else-if="!getResultSuccess(die.id) && die.onFailure?.message"
                class="mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm"
              >
                {{ die.onFailure.message }}
              </div>
            </div>

            <!-- Not rolled yet -->
            <div v-else class="text-gray-500 text-sm italic">
              Not rolled yet
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.roll-flash-overlay {
  position: absolute;
  inset: 0;
  border: 2px solid #22c55e;
  border-radius: 0.5rem;
  pointer-events: none;
  animation: border-fade 2s ease-out forwards;
}

@keyframes border-fade {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
