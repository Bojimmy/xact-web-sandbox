/// <reference lib="webworker" />

import { executeDeterministicRange } from "./scale-work";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<{ id: number; start: number; count: number }>) => {
  const started = performance.now();
  try {
    const result = executeDeterministicRange(event.data.start, event.data.count);
    self.postMessage({ id: event.data.id, ...result, durationMs: performance.now() - started });
  } catch (cause) {
    self.postMessage({ id: event.data.id, error: cause instanceof Error ? cause.message : "Scale worker failed." });
  }
};
