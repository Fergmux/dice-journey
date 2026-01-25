import { computed } from "vue";

import { useLocalStorage } from "@vueuse/core";

export interface DieResult {
  id: string;
  name?: string;
  value: number;
  count: number;
  success?: number;
  results: number[];
  total: number;
  isSuccess: boolean;
  message?: string;
}

export interface RollResult {
  rollId: string;
  rollName: string;
  dice: DieResult[];
}

export interface HistorySession {
  id: string;
  timestamp: number;
  journeyId: string;
  journeyName: string;
  rolls: RollResult[];
}

// History is stored per-journey
interface HistoryState {
  // Map of journeyId -> array of history sessions
  sessions: Record<string, HistorySession[]>;
}

const defaultState: HistoryState = {
  sessions: {},
};

export function useRollHistory() {
  const state = useLocalStorage<HistoryState>(
    "dice-roll-history-v2",
    defaultState,
    { mergeDefaults: true }
  );

  // Get history for a specific journey
  function getJourneyHistory(journeyId: string): HistorySession[] {
    return state.value.sessions[journeyId] ?? [];
  }

  // Get all journeys that have history
  const journeysWithHistory = computed(() => {
    return Object.keys(state.value.sessions).filter(
      (id) => (state.value.sessions[id]?.length ?? 0) > 0
    );
  });

  // Add a complete session (group of rolls)
  function addHistorySession(session: Omit<HistorySession, "id" | "timestamp">) {
    const fullSession: HistorySession = {
      ...session,
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    if (!state.value.sessions[session.journeyId]) {
      state.value.sessions[session.journeyId] = [];
    }

    // Add to the beginning so newest is first
    state.value.sessions[session.journeyId]!.unshift(fullSession);
  }

  // Remove a specific session
  function removeHistorySession(journeyId: string, sessionId: string) {
    if (state.value.sessions[journeyId]) {
      state.value.sessions[journeyId] = state.value.sessions[journeyId].filter(
        (s) => s.id !== sessionId
      );
    }
  }

  // Clear all history for a journey
  function clearJourneyHistory(journeyId: string) {
    if (state.value.sessions[journeyId]) {
      state.value.sessions[journeyId] = [];
    }
  }

  // Clear all history
  function clearAllHistory() {
    state.value.sessions = {};
  }

  // Get total count of all history sessions
  const totalHistoryCount = computed(() => {
    return Object.values(state.value.sessions).reduce(
      (sum, sessions) => sum + sessions.length,
      0
    );
  });

  return {
    state,
    getJourneyHistory,
    journeysWithHistory,
    addHistorySession,
    removeHistorySession,
    clearJourneyHistory,
    clearAllHistory,
    totalHistoryCount,
  };
}
