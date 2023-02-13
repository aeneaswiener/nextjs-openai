import { useEffect, useReducer } from "react";
import { yieldStream } from "yield-stream";
import { State, streamState } from "./state";

/**
 * Custom hook that updates with the current token buffer.
 *
 * @note Thanks to GPT for guidance on AbortControllers and fucked up state
 * logic.
 */
export const useBuffer = (
  url: string,
  delay = 0
) => {
  const initialState: State = {
    done: false,
    buffer: [],
    refreshCount: 0,
    aborted: false,
    controller: null,
  };

  const [state, dispatch] = useReducer(streamState, initialState);
  const { done, buffer, refreshCount } = state;

  /**
   * Fetch the new token stream.
   */
  useEffect(
    () => {
      const newController = new AbortController();
      dispatch({ type: "setController", payload: newController });

      (async () => {
        try {
          const { signal } = newController;
          const response = await fetch(url, { signal });

          if (!response.body) {
            throw new Error(`Failed to load response from URL: ${url}`);
          }

          const stream = yieldStream(response.body, newController);
          let lastUpdateTime = 0;

          for await (const chunk of stream) {
            dispatch({
              type: "add",
              payload: chunk,
            });

            if (delay) {
              const timeSinceLastUpdate = Date.now() - lastUpdateTime;
              const timeToWait = Math.max(0, delay - timeSinceLastUpdate);

              await new Promise((resolve) => setTimeout(resolve, timeToWait));
              lastUpdateTime = Date.now();
            }
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            // The stream was cancelled.
          } else {
            throw error;
          }
        }
      })();

      return () => {
        newController.abort();
      };
    },
    [refreshCount, url, delay]
  );

  return {
    buffer,
    done,
    refresh: () => dispatch({ type: "refresh" }),
    cancel: () => dispatch({ type: "cancel" }),
  };
};
