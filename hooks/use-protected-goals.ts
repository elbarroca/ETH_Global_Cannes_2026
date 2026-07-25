"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProtectedGoal,
  createProtectedGoalRun,
  getProtectedGoalRuns,
  getProtectedGoals,
  updateProtectedGoal,
} from "@/lib/api";
import type { GoalPolicy, GoalSnapshot } from "@/src/kernel/types";

const ACTIVE_RUN_STATES = new Set(["SCHEDULED", "SELECTING", "RUNNING", "SYNTHESIZING"]);

export function useProtectedGoals(enabled: boolean) {
  const queryClient = useQueryClient();
  const goalsQuery = useQuery({
    queryKey: ["protected-goals"],
    queryFn: ({ signal }) => getProtectedGoals(50, signal),
    enabled,
    retry: false,
  });
  const goals = goalsQuery.data ?? [];
  const goal = goals.find((entry) => entry.state !== "COMPLETED") ?? goals[0] ?? null;
  const runsQuery = useQuery({
    queryKey: ["protected-goal-runs", goal?.goalId],
    queryFn: ({ signal }) => getProtectedGoalRuns(goal!.goalId, 50, signal),
    enabled: enabled && goal !== null,
    retry: false,
    refetchInterval: (query) => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return false;
      const runs = query.state.data ?? [];
      return runs.some((run) => ACTIVE_RUN_STATES.has(run.state)) ? 2_000 : false;
    },
  });

  async function refresh(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["protected-goals"] }),
      queryClient.invalidateQueries({ queryKey: ["protected-goal-runs"] }),
    ]);
  }

  const createGoal = useMutation({
    mutationFn: (input: {
      goal: Pick<GoalSnapshot, "objective" | "requiredCapabilities" | "policy"> & {
        state: "DRAFT" | "ACTIVE";
      };
      idempotencyKey: string;
    }) => createProtectedGoal(input.goal, input.idempotencyKey),
    onSuccess: refresh,
  });
  const updateGoal = useMutation({
    mutationFn: (input: {
      goalId: string;
      mutation:
        | { action: "ACTIVATE" | "PAUSE" | "RESUME" }
        | {
            action: "UPDATE";
            objective?: string;
            requiredCapabilities?: readonly string[];
            policy?: GoalPolicy;
          };
      idempotencyKey: string;
    }) => updateProtectedGoal(input.goalId, input.mutation, input.idempotencyKey),
    onSuccess: refresh,
  });
  const runGoal = useMutation({
    mutationFn: (input: { goalId: string; idempotencyKey: string }) =>
      createProtectedGoalRun(input.goalId, input.idempotencyKey),
    onSuccess: refresh,
  });

  return {
    goal,
    goals,
    runs: runsQuery.data ?? [],
    isLoading: goalsQuery.isLoading || (goal !== null && runsQuery.isLoading),
    error: goalsQuery.error ?? runsQuery.error,
    refresh,
    createGoal,
    updateGoal,
    runGoal,
  };
}
