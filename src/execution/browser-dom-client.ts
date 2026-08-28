import type { AuthorizedEffect, ExecutionObservation } from "./contracts";
import type { DOMExecutionClient } from "./dom-execution-adapter";
import { targetFromPayload } from "./targeted-payload";

interface TargetElement {
  disabled?: boolean;
  click(): void;
  getAttribute(name: string): string | null;
  setAttribute?(name: string, value: string): void;
  removeAttribute?(name: string): void;
}

interface DOMDocumentLike {
  querySelector(selector: string): TargetElement | null;
}

/**
 * Actual DOM/accessibility transport: activates only the exact target bound in
 * the effect, then reads that target's independently written audit attributes.
 */
export class BrowserDOMExecutionClient implements DOMExecutionClient {
  constructor(
    private readonly documentRef: DOMDocumentLike | undefined =
      typeof document === "undefined" ? undefined : document,
    private readonly now: () => number = Date.now,
  ) {}

  isAvailable(): boolean {
    return Boolean(this.documentRef);
  }

  async activate(effect: AuthorizedEffect): Promise<{ receipt: unknown }> {
    const element = this.elementFor(effect);
    if (element.disabled) throw new Error("Authorized DOM target is disabled.");
    // The DOM handler must see an adapter-prepared nonce before it may publish
    // a receipt. A user click has no such dispatch marker and remains inert.
    element.setAttribute?.("data-xact-dispatch-nonce", effect.artifact.nonce);
    try { element.click(); }
    finally { element.removeAttribute?.("data-xact-dispatch-nonce"); }
    const receipt = element.getAttribute("data-xact-receipt");
    if (!receipt) throw new Error("DOM target did not publish an execution receipt.");
    return { receipt };
  }

  async observeAction(effect: AuthorizedEffect, receipt: unknown): Promise<ExecutionObservation> {
    const element = this.elementFor(effect);
    const observedReceipt = element.getAttribute("data-xact-receipt");
    const effectFingerprint = element.getAttribute("data-xact-effect-fingerprint");
    if (observedReceipt !== String(receipt) || !effectFingerprint) {
      throw new Error("DOM target has no matching post-execution observation.");
    }
    return {
      substrate: "DOM",
      receipt: observedReceipt,
      target: targetFromPayload(effect.payload),
      effectFingerprint,
      observedAtEpochMs: this.now(),
    };
  }

  private elementFor(effect: AuthorizedEffect): TargetElement {
    const documentRef = this.documentRef;
    if (!documentRef) throw new Error("DOM execution is unavailable outside a browser document.");
    const target = targetFromPayload(effect.payload).replace(/(["\\])/g, "\\$1");
    const element = documentRef.querySelector(`[data-xact-target="${target}"]`);
    if (!element) throw new Error("Exact authorized DOM target is unavailable.");
    return element;
  }
}
