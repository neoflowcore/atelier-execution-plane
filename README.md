# Atelier Execution Plane Rev5.2

Provider/worker/transport sidecar for Atelier Runtime Rev5.2.

Authority boundary:
- Pilote = semantics / intent
- Runtime = authority / durable state / routing / admission / acceptance
- Execution Plane = provider / worker / transport implementation

This repository must not reinterpret Runtime or Pilote semantics. It binds to a frozen Runtime handoff and fails closed on dependency/protocol drift.
