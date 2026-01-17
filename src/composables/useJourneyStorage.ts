import { computed } from "vue";

import { useLocalStorage } from "@vueuse/core";

import type {
  Config,
  Die,
  Journey,
  Roll,
} from "../Config";

// Extended Roll with position data for the builder
export interface RollWithPosition extends Roll {
  x: number;
  y: number;
}

// Extended Journey with positioned rolls
export interface JourneyWithPositions extends Omit<Journey, "rolls"> {
  rolls: RollWithPosition[];
}

// Full storage config with positioned journeys
export type StorageConfig = Record<string, JourneyWithPositions>;

// Storage state including current journey selection
interface JourneyStorageState {
  currentJourneyId: string | null;
  journeys: StorageConfig;
}

const defaultJourney: JourneyWithPositions = {
  id: "default",
  name: "New Scenario",
  rolls: [
    {
      id: "roll-1",
      name: "Starting Roll",
      x: 50,
      y: 50,
      dice: [
        {
          id: "roll-1-dice-1",
          name: "Check",
          value: 20,
          count: 1,
          success: 10,
          onSuccess: {
            message: "Success!",
          },
          onFailure: {
            message: "Failed",
          },
        },
      ],
    },
  ],
};

const defaultState: JourneyStorageState = {
  currentJourneyId: "default",
  journeys: {
    default: defaultJourney,
  },
};

export function useJourneyStorage() {
  const state = useLocalStorage<JourneyStorageState>(
    "dice-journey-storage",
    defaultState,
    { mergeDefaults: true }
  );

  // Current journey computed
  const currentJourney = computed(() => {
    if (!state.value.currentJourneyId) return null;
    return state.value.journeys[state.value.currentJourneyId] ?? null;
  });

  // Get all journey IDs and names for selection
  const journeyList = computed(() => {
    return Object.values(state.value.journeys).map((j) => ({
      id: j.id,
      name: j.name,
    }));
  });

  // Set current journey
  function setCurrentJourney(journeyId: string) {
    if (state.value.journeys[journeyId]) {
      state.value.currentJourneyId = journeyId;
    }
  }

  // Create a new journey
  function createJourney(name: string): string {
    const id = `journey-${Date.now()}`;
    const newJourney: JourneyWithPositions = {
      id,
      name,
      rolls: [],
    };
    state.value.journeys[id] = newJourney;
    state.value.currentJourneyId = id;
    return id;
  }

  // Update journey name
  function updateJourneyName(journeyId: string, name: string) {
    if (state.value.journeys[journeyId]) {
      state.value.journeys[journeyId].name = name;
    }
  }

  // Delete a journey
  function deleteJourney(journeyId: string) {
    if (state.value.journeys[journeyId]) {
      delete state.value.journeys[journeyId];
      // If we deleted the current journey, switch to another or null
      if (state.value.currentJourneyId === journeyId) {
        const remaining = Object.keys(state.value.journeys);
        state.value.currentJourneyId = remaining[0] ?? null;
      }
    }
  }

  // Add a roll (node) to current journey
  function addRoll(roll: RollWithPosition) {
    if (currentJourney.value) {
      currentJourney.value.rolls.push(roll);
    }
  }

  // Update a roll in current journey
  function updateRoll(rollId: string, updates: Partial<RollWithPosition>) {
    if (currentJourney.value) {
      const roll = currentJourney.value.rolls.find((r) => r.id === rollId);
      if (roll) {
        Object.assign(roll, updates);
      }
    }
  }

  // Delete a roll from current journey
  function deleteRoll(rollId: string) {
    if (currentJourney.value) {
      const index = currentJourney.value.rolls.findIndex((r) => r.id === rollId);
      if (index !== -1) {
        currentJourney.value.rolls.splice(index, 1);
      }
    }
  }

  // Update roll position
  function updateRollPosition(rollId: string, x: number, y: number) {
    updateRoll(rollId, { x, y });
  }

  // Add a die to a roll
  function addDie(rollId: string, die: Die) {
    if (currentJourney.value) {
      const roll = currentJourney.value.rolls.find((r) => r.id === rollId);
      if (roll) {
        roll.dice.push(die);
      }
    }
  }

  // Update a die in a roll
  function updateDie(rollId: string, dieId: string, updates: Partial<Die>) {
    if (currentJourney.value) {
      const roll = currentJourney.value.rolls.find((r) => r.id === rollId);
      if (roll) {
        const die = roll.dice.find((d) => d.id === dieId);
        if (die) {
          Object.assign(die, updates);
        }
      }
    }
  }

  // Delete a die from a roll
  function deleteDie(rollId: string, dieId: string) {
    if (currentJourney.value) {
      const roll = currentJourney.value.rolls.find((r) => r.id === rollId);
      if (roll) {
        const index = roll.dice.findIndex((d) => d.id === dieId);
        if (index !== -1) {
          roll.dice.splice(index, 1);
        }
      }
    }
  }

  // Export current journey to Config format (without positions)
  function exportToConfig(): Config | null {
    if (!currentJourney.value) return null;
    
    const journey = currentJourney.value;
    const exportedJourney: Journey = {
      id: journey.id,
      name: journey.name,
      rolls: journey.rolls.map(({ x, y, ...roll }) => roll),
    };
    
    return { [journey.id]: exportedJourney };
  }

  // Import from Config format
  function importFromConfig(config: Config, defaultX = 50, defaultY = 50) {
    Object.entries(config).forEach(([id, journey], index) => {
      const journeyWithPositions: JourneyWithPositions = {
        ...journey,
        rolls: journey.rolls.map((roll, rollIndex) => ({
          ...roll,
          x: defaultX + rollIndex * 300,
          y: defaultY + index * 200,
        })),
      };
      state.value.journeys[id] = journeyWithPositions;
    });
  }

  // Reset to defaults
  function reset() {
    state.value = { ...defaultState };
  }

  return {
    state,
    currentJourney,
    journeyList,
    setCurrentJourney,
    createJourney,
    updateJourneyName,
    deleteJourney,
    addRoll,
    updateRoll,
    deleteRoll,
    updateRollPosition,
    addDie,
    updateDie,
    deleteDie,
    exportToConfig,
    importFromConfig,
    reset,
  };
}
