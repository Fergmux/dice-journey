<script setup lang="ts">
import {
  computed,
  inject,
  ref,
  type Ref,
} from "vue";

import { useLocalStorage } from "@vueuse/core";

import { useJourneyStorage } from "../composables/useJourneyStorage";
import {
  type DieResult,
  type RollResult,
  useRollHistory,
} from "../composables/useRollHistory";
import type { Die } from "../Config";

const { currentJourney, journeyList, setCurrentJourney } = useJourneyStorage();
const { addHistorySession } = useRollHistory();

// Session accumulator for grouping rolls
let currentSessionRolls: RollResult[] = [];
let isInSession = false;

const tooltipsEnabled = inject<Ref<boolean>>("tooltipsEnabled", ref(true));

const resultMap = useLocalStorage<Map<string, number[]>>(
  "dice-roller-results",
  new Map(),
  {
    serializer: {
      read: (v) => new Map(JSON.parse(v)),
      write: (v) => JSON.stringify([...v.entries()]),
    },
  },
);
const completedRollIds = useLocalStorage<Set<string>>(
  "dice-roller-completed-rolls",
  new Set(),
  {
    serializer: {
      read: (v) => new Set(JSON.parse(v)),
      write: (v) => JSON.stringify([...v]),
    },
  },
);
const rollAnimationKey = ref<Map<string, number>>(new Map());

// Helper to create sequence-specific keys
const seqKey = (seqIndex: number, id: string) => `${seqIndex}-${id}`;

// Mark a roll as recently rolled (for the flash effect)
const markAsRecentlyRolled = (seqIndex: number, rollId: string) => {
  const key = seqKey(seqIndex, rollId);
  // Increment the key to force animation restart
  const currentKey = rollAnimationKey.value.get(key) ?? 0;
  rollAnimationKey.value.set(key, currentKey + 1);
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

// Find root rolls (not referenced by any dice's onSuccess/onFailure/ranges)
const rootRolls = computed(() => {
  if (!currentJourney.value) return [];

  // Collect all rollIds that are referenced by dice
  const referencedRollIds = new Set<string>();
  for (const roll of currentJourney.value.rolls) {
    for (const die of roll.dice) {
      // Threshold mode connections
      if (die.onSuccess?.rollIds) {
        die.onSuccess.rollIds.forEach((id) => referencedRollIds.add(id));
      }
      if (die.onFailure?.rollIds) {
        die.onFailure.rollIds.forEach((id) => referencedRollIds.add(id));
      }
      // Range mode connections
      if (die.ranges) {
        for (const range of die.ranges) {
          if (range.rollIds) {
            range.rollIds.forEach((id) => referencedRollIds.add(id));
          }
        }
      }
    }
  }

  // Return rolls that are not referenced
  return currentJourney.value.rolls.filter(
    (roll) => !referencedRollIds.has(roll.id),
  );
});

// Build sequences - each root roll and its chain of connected rolls
// A roll can appear in multiple sequences if it's reachable from multiple roots
const rollSequences = computed(() => {
  if (!currentJourney.value) return [];

  const sequences: Array<typeof currentJourney.value.rolls> = [];

  // For each root roll, build its sequence
  for (const rootRoll of rootRolls.value) {
    const sequence: typeof currentJourney.value.rolls = [];
    const visited = new Set<string>();

    // BFS to collect all rolls in this sequence in order
    const queue = [rootRoll.id];

    while (queue.length > 0) {
      const rollId = queue.shift()!;
      if (visited.has(rollId)) continue;
      visited.add(rollId);

      const roll = currentJourney.value!.rolls.find((r) => r.id === rollId);
      if (roll) {
        sequence.push(roll);

        // Add connected rolls to queue (supports multiple connections)
        for (const die of roll.dice) {
          // Threshold mode connections
          if (die.onSuccess?.rollIds) {
            for (const targetId of die.onSuccess.rollIds) {
              if (!visited.has(targetId)) {
                queue.push(targetId);
              }
            }
          }
          if (die.onFailure?.rollIds) {
            for (const targetId of die.onFailure.rollIds) {
              if (!visited.has(targetId)) {
                queue.push(targetId);
              }
            }
          }
          // Range mode connections
          if (die.ranges) {
            for (const range of die.ranges) {
              if (range.rollIds) {
                for (const targetId of range.rollIds) {
                  if (!visited.has(targetId)) {
                    queue.push(targetId);
                  }
                }
              }
            }
          }
        }
      }
    }

    if (sequence.length > 0) {
      sequences.push(sequence);
    }
  }

  return sequences;
});

const getResultTotal = (seqIndex: number, diceId: string) => {
  const key = seqKey(seqIndex, diceId);
  return resultMap.value.get(key)?.reduce((a, b) => a + b, 0) ?? 0;
};

const getResultSuccess = (seqIndex: number, diceId: string) => {
  const die = allDice.value[diceId];
  if (!die) return false;
  // For range mode, success doesn't apply the same way
  if (die.mode === 'range') return true;
  return getResultTotal(seqIndex, diceId) >= (die.success ?? 0);
};

// Get all matching ranges for a die result
const getMatchingRanges = (seqIndex: number, diceId: string) => {
  const die = allDice.value[diceId];
  if (!die?.ranges || die.mode !== 'range') return [];
  
  const total = getResultTotal(seqIndex, diceId);
  return die.ranges.filter((range) => total >= range.min && total <= range.max);
};

const hasResult = (seqIndex: number, diceId: string) => {
  return resultMap.value.has(seqKey(seqIndex, diceId));
};

const getResults = (seqIndex: number, diceId: string) => {
  return resultMap.value.get(seqKey(seqIndex, diceId)) ?? [];
};

const rollDice = (seqIndex: number, id: string) => {
  const dice = allDice.value[id];
  if (dice) {
    const key = seqKey(seqIndex, dice.id);
    resultMap.value.set(
      key,
      Array.from({ length: dice.count }, () =>
        Math.floor(Math.random() * dice.value + 1),
      ),
    );
  }
};

// Get all downstream roll IDs from a given roll within a sequence
const getDownstreamRollsInSequence = (seqIndex: number, rollId: string, visited = new Set<string>()): Set<string> => {
  if (visited.has(rollId) || !currentJourney.value) return visited;
  
  // Only include rolls that are in this sequence
  const sequence = rollSequences.value[seqIndex];
  if (!sequence?.some((r) => r.id === rollId)) return visited;
  
  visited.add(rollId);

  const roll = currentJourney.value.rolls.find((r) => r.id === rollId);
  if (roll) {
    for (const die of roll.dice) {
      // Threshold mode connections
      if (die.mode !== 'range') {
        if (die.onSuccess?.rollIds) {
          for (const targetId of die.onSuccess.rollIds) {
            getDownstreamRollsInSequence(seqIndex, targetId, visited);
          }
        }
        if (die.onFailure?.rollIds) {
          for (const targetId of die.onFailure.rollIds) {
            getDownstreamRollsInSequence(seqIndex, targetId, visited);
          }
        }
      }
      // Range mode connections
      if (die.mode === 'range' && die.ranges) {
        for (const range of die.ranges) {
          if (range.rollIds) {
            for (const targetId of range.rollIds) {
              getDownstreamRollsInSequence(seqIndex, targetId, visited);
            }
          }
        }
      }
    }
  }
  return visited;
};

// Build roll result for history
const buildRollResult = (seqIndex: number, rollId: string): RollResult | null => {
  if (!currentJourney.value) return null;
  const roll = currentJourney.value.rolls.find((r) => r.id === rollId);
  if (!roll) return null;

  const diceResults: DieResult[] = roll.dice.map((dice) => {
    const results = getResults(seqIndex, dice.id);
    const total = results.reduce((a, b) => a + b, 0);
    
    if (dice.mode === 'range') {
      // Range mode - calculate matched ranges
      const matchedRanges = (dice.ranges ?? []).map((range) => ({
        id: range.id,
        min: range.min,
        max: range.max,
        label: range.label,
        message: range.message,
        matched: total >= range.min && total <= range.max,
      }));
      
      return {
        id: dice.id,
        name: dice.name,
        value: dice.value,
        count: dice.count,
        mode: 'range' as const,
        results: [...results],
        total,
        isSuccess: matchedRanges.some((r) => r.matched),
        matchedRanges,
      };
    } else {
      // Threshold mode
      const isSuccess = dice.success ? total >= dice.success : true;
      return {
        id: dice.id,
        name: dice.name,
        value: dice.value,
        count: dice.count,
        mode: 'threshold' as const,
        success: dice.success,
        results: [...results],
        total,
        isSuccess,
        message: isSuccess ? dice.onSuccess?.message : dice.onFailure?.message,
      };
    }
  });

  return {
    rollId: roll.id,
    rollName: roll.name,
    dice: diceResults,
  };
};

// Save the current session to history
const saveCurrentSession = () => {
  if (currentSessionRolls.length > 0 && currentJourney.value) {
    addHistorySession({
      journeyId: currentJourney.value.id,
      journeyName: currentJourney.value.name,
      rolls: [...currentSessionRolls],
    });
    currentSessionRolls = [];
  }
};

const triggerRoll = (seqIndex: number, rollId?: string, isReroll = false, isPartOfSession = false) => {
  if (rollId && currentJourney.value) {
    const roll = currentJourney.value.rolls.find((roll) => roll.id === rollId);
    if (roll) {
      // If this is a reroll, clear this roll and all downstream rolls in this sequence
      if (isReroll) {
        const downstreamRolls = getDownstreamRollsInSequence(seqIndex, rollId);
        for (const id of downstreamRolls) {
          completedRollIds.value.delete(seqKey(seqIndex, id));
        }
      }

      roll.dice.forEach((dice) => {
        rollDice(seqIndex, dice.id);
      });
      completedRollIds.value.add(seqKey(seqIndex, rollId));
      markAsRecentlyRolled(seqIndex, rollId);

      // Build and collect roll result for history
      const rollResult = buildRollResult(seqIndex, rollId);
      if (rollResult) {
        currentSessionRolls.push(rollResult);
      }

      // Trigger chained rolls (supports multiple connections)
      roll.dice.forEach((dice) => {
        // Threshold mode
        if (dice.mode !== 'range') {
          if (getResultSuccess(seqIndex, dice.id) && dice.onSuccess?.rollIds) {
            for (const targetId of dice.onSuccess.rollIds) {
              // Only trigger if target is in this sequence
              const sequence = rollSequences.value[seqIndex];
              if (sequence?.some((r) => r.id === targetId)) {
                triggerRoll(seqIndex, targetId, false, true);
              }
            }
          }
          if (!getResultSuccess(seqIndex, dice.id) && dice.onFailure?.rollIds) {
            for (const targetId of dice.onFailure.rollIds) {
              // Only trigger if target is in this sequence
              const sequence = rollSequences.value[seqIndex];
              if (sequence?.some((r) => r.id === targetId)) {
                triggerRoll(seqIndex, targetId, false, true);
              }
            }
          }
        }
        // Range mode - trigger all matching ranges
        if (dice.mode === 'range' && dice.ranges) {
          const matchingRanges = getMatchingRanges(seqIndex, dice.id);
          for (const range of matchingRanges) {
            if (range.rollIds) {
              for (const targetId of range.rollIds) {
                // Only trigger if target is in this sequence
                const sequence = rollSequences.value[seqIndex];
                if (sequence?.some((r) => r.id === targetId)) {
                  triggerRoll(seqIndex, targetId, false, true);
                }
              }
            }
          }
        }
      });

      // If this is a standalone roll (not part of Roll All), save session immediately
      if (!isInSession && !isPartOfSession) {
        saveCurrentSession();
      }
    }
  }
};

const triggerJourney = () => {
  completedRollIds.value.clear();
  
  // Start a new session
  isInSession = true;
  currentSessionRolls = [];
  
  // Trigger each sequence's root roll independently
  rollSequences.value.forEach((sequence, seqIndex) => {
    const firstRoll = sequence[0];
    if (firstRoll) {
      triggerRoll(seqIndex, firstRoll.id, false, true);
    }
  });
  
  // End session and save to history
  isInSession = false;
  saveCurrentSession();
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

    <!-- Roll sequences - each sequence is a horizontal row -->
    <div class="space-y-6">
      <div
        v-for="(sequence, seqIndex) in rollSequences"
        :key="seqIndex"
        class="flex gap-4 pb-2 items-start"
      >
        <!-- Arrow/connector between rolls in sequence -->
        <template v-for="roll in sequence" :key="`${seqIndex}-${roll.id}`">
          <!-- Roll card -->
          <div
            class="bg-gray-800 rounded-lg p-4 shadow-lg border-2 border-gray-700 relative overflow-hidden min-w-0 flex-1 basis-[250px]"
            :class="{
              'opacity-40': !completedRollIds.has(seqKey(seqIndex, roll.id)),
            }"
          >
            <!-- Animation overlay that restarts on each roll -->
            <div
              v-if="rollAnimationKey.has(seqKey(seqIndex, roll.id))"
              :key="rollAnimationKey.get(seqKey(seqIndex, roll.id))"
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
                @click="triggerRoll(seqIndex, roll.id, completedRollIds.has(seqKey(seqIndex, roll.id)))"
                class="ml-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded shadow-lg transition-colors cursor-pointer"
              >
                {{ completedRollIds.has(seqKey(seqIndex, roll.id)) ? "Reroll" : "Roll" }}
              </button>
            </div>

            <!-- Dice grid - auto-fit to container width -->
            <div
              class="grid gap-3"
              style="grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));"
            >
              <div
                v-for="die in roll.dice"
                :key="`${seqIndex}-${die.id}`"
                class="bg-gray-900 rounded-lg p-3 border"
                :class="
                  !hasResult(seqIndex, die.id)
                    ? 'border-gray-600'
                    : die.mode === 'range'
                      ? (getMatchingRanges(seqIndex, die.id).length > 0 ? 'border-purple-500' : 'border-gray-500')
                      : getResultSuccess(seqIndex, die.id)
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
                    @click="rollDice(seqIndex, die.id)"
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
                <div v-if="hasResult(seqIndex, die.id)" class="space-y-2">
                  <!-- Individual rolls -->
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="(result, index) in getResults(seqIndex, die.id)"
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
                        die.mode === 'range'
                          ? (getMatchingRanges(seqIndex, die.id).length > 0 ? 'text-purple-400' : 'text-gray-400')
                          : getResultSuccess(seqIndex, die.id) ? 'text-green-400' : 'text-red-400'
                      "
                    >
                      {{ getResultTotal(seqIndex, die.id) }}
                    </span>
                  </div>

                  <!-- Result message - Threshold mode -->
                  <template v-if="die.mode !== 'range'">
                    <div
                      v-if="getResultSuccess(seqIndex, die.id) && die.onSuccess?.message"
                      class="mt-2 p-2 bg-green-900/50 border border-green-700 rounded text-green-300 text-sm"
                    >
                      {{ die.onSuccess.message }}
                    </div>
                    <div
                      v-else-if="!getResultSuccess(seqIndex, die.id) && die.onFailure?.message"
                      class="mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm"
                    >
                      {{ die.onFailure.message }}
                    </div>
                  </template>

                  <!-- Result messages - Range mode (show all matching ranges) -->
                  <template v-else-if="die.mode === 'range'">
                    <template 
                      v-for="range in getMatchingRanges(seqIndex, die.id)"
                      :key="range.id"
                    >
                      <div
                        v-if="range.message"
                        class="mt-2 p-2 bg-purple-900/50 border border-purple-700 rounded text-purple-300 text-sm"
                      >
                        {{ range.message }}
                      </div>
                    </template>
                  </template>
                </div>

                <!-- Not rolled yet -->
                <div v-else class="text-gray-500 text-sm italic">
                  Not rolled yet
                </div>
              </div>
            </div>
          </div>
        </template>
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
