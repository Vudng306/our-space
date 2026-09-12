"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./client";

type State<T> = { data: T | null; error: string | null };

/**
 * Loads data once the component is on screen, and again on demand.
 *
 * State is only ever written from a promise callback, never synchronously
 * inside the effect, so a mount costs one render rather than three.
 *
 * `fetcher` must be memoised (useCallback) — its identity is the cache key.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, fallbackMessage = "Something went wrong.") {
  const [state, setState] = useState<State<T>>({ data: null, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    fetcher()
      .then((data) => {
        if (alive) setState({ data, error: null });
      })
      .catch((err: unknown) => {
        if (alive) {
          setState({ data: null, error: err instanceof ApiError ? err.message : fallbackMessage });
        }
      });
    return () => {
      alive = false;
    };
  }, [fetcher, nonce, fallbackMessage]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  /** Local, optimistic edit — replaced by the server copy on the next reload. */
  const mutate = useCallback((update: (current: T) => T) => {
    setState((prev) => (prev.data === null ? prev : { data: update(prev.data), error: prev.error }));
  }, []);

  return {
    data: state.data,
    error: state.error,
    loading: state.data === null && state.error === null,
    reload,
    mutate,
  };
}
