# Consequence Boundary Test Plan

The challenge build must test:

- unauthorized mutation
- stale mutation
- over-limit mutation
- missing evidence
- contradictory verified evidence
- ambiguous semantic intent
- replayed request
- unknown actor
- unknown capability
- unknown policy state
- unsupported execution substrate
- execution succeeds but verification fails

## Required invariant

Unknown authority state must result in `REJECTED` or equivalent hard block.

Never emit an invented wire action such as `ASK` when the substrate only supports a fixed action set.
