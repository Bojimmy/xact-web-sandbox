# Xact Web Sandbox — Public / Private Boundary

## Safe to implement and expose

- Xact concepts
- R / U / C outputs
- reported / verified / derived facts
- decision traces
- evidence and provenance
- authorization outcomes
- public interface contracts
- WebMCP contracts
- execution adapters
- simulated policies
- simulated state
- scenario packs
- audit and verification results
- clean-room commit-boundary mechanics

## Demonstrate through interfaces, do not disclose internals

Do not copy, reconstruct, infer, publish, or expose:

- production Xact Core implementation
- production X-Node internals
- proprietary deterministic resolution algorithms
- matching or scoring methods
- production Rule Packs
- rule-generation mechanisms
- governed learning-loop internals
- pattern-promotion algorithms
- proprietary confidence systems
- production authorization logic
- confidential benchmark code or implementation details

## Build rule

The sandbox resolution path uses a clearly identified `SimulationDecisionProvider`.

The Commit path may demonstrate public-safe clean-room implementations of proven invariants such as:

- candidate-state binding
- read-before-write stale guards
- exact promotion verification
- capability checks
- fail-closed decisions
- governed evidence bindings

Do not copy code from private reference implementations into the public challenge repository.
