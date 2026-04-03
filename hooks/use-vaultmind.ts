"use client";

import { useState, useEffect, useCallback } from "react";
import { getLatestCycle, getCycleHistory, triggerCycle, type CycleResult } from "@/lib/api";
import { useUser } from "@/contexts/user-context";

export function useLatestCycle() {
  const { userId } = useUser();
  const [cycle, setCycle] = useState<CycleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getLatestCycle(userId);
      setCycle(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 10_000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { cycle, loading, error, refetch: fetch };
}

export function useCycleHistory(limit = 10) {
  const { userId } = useUser();
  const [history, setHistory] = useState<CycleResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetch = useCallback(
    async (newOffset = 0) => {
      if (!userId) return;
      setLoading(true);
      try {
        const data = await getCycleHistory(userId, limit, newOffset);
        if (newOffset === 0) {
          setHistory(data);
        } else {
          setHistory((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === limit);
        setOffset(newOffset + data.length);
      } finally {
        setLoading(false);
      }
    },
    [userId, limit]
  );

  useEffect(() => {
    fetch(0);
  }, [fetch]);

  const loadMore = () => fetch(offset);

  return { history, loading, hasMore, loadMore, refetch: () => fetch(0) };
}

export function useTriggerCycle() {
  const { userId } = useUser();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (): Promise<CycleResult | null> => {
    if (!userId) return null;
    setRunning(true);
    setError(null);
    try {
      const result = await triggerCycle(userId);
      return result;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setRunning(false);
    }
  }, [userId]);

  return { run, running, error };
}
