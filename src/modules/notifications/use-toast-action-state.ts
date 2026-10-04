"use client";

import { useActionState } from "react";
import { useToast, notifyActionResult, runWithToast, isNavigationError } from "./toast-provider";

export function useToastActionState<State, Payload>(action: (state: Awaited<State>, payload: Payload) => State | Promise<State>, initialState: Awaited<State>, permalink?: string) {
  const notify = useToast();
  return useActionState<State, Payload>(async (state, payload) => {
    try {
      const result = await runWithToast(notify, async () => action(state, payload));
      notifyActionResult(notify, result);
      return result;
    } catch (error) {
      if (isNavigationError(error)) throw error;
      return state;
    }
  }, initialState, permalink);
}
