import { KernelError } from "./errors";
import type { JobState } from "./types";

const TRANSITIONS: Readonly<Record<JobState, readonly JobState[]>> = {
  QUEUED: ["RUNNING", "CANCELED", "FAILED"],
  RUNNING: ["QUEUED", "SUCCEEDED", "FAILED", "CANCELED", "A3_NOT_CONFIGURED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELED: [],
  A3_NOT_CONFIGURED: [],
};

export function isLegalJobTransition(from: JobState, to: JobState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertLegalJobTransition(from: JobState, to: JobState): void {
  if (!isLegalJobTransition(from, to)) {
    throw new KernelError(
      "KERNEL_ILLEGAL_TRANSITION",
      `Illegal job state transition: ${from} -> ${to}`,
      409,
    );
  }
}

export function isTerminalJobState(state: JobState): boolean {
  return TRANSITIONS[state].length === 0;
}
