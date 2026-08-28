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
- live sandbox timing samples
- clearly labeled historical reference results
- public-safe learning lifecycle states and candidate metadata
- simulated coverage and reasoning-frequency snapshots

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

Reference benchmark and evolution figures may be displayed only when their
data contracts and UI label them as applying to the reference implementation,
not the browser sandbox. Live measurements must come from the running public
simulation and may not be substituted with reference values.

The public learning simulation may expose `OBSERVED`, `CANDIDATE`, `VALIDATED`,
`APPROVED`, and `ACTIVATED`. It may inject deterministic resolution evidence only
after an explicit governed transition to `ACTIVATED`; it may never modify Commit
authority or execution capability.

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

## O-Agent provider boundary

The browser may call a same-origin `OAgentProvider` endpoint only for
structured reasoning evidence. Model credentials, model configuration, and any
provider transport remain server-side. A provider response is not authority:
it must re-enter Xact through Resolve and Commit before an effect may be
authorized. Offline provider output is labeled `SIMULATED_O_AGENT`; only a
server-attested model result may be labeled `LIVE_SANDBOX_MEASUREMENT`.
