# Handover — 2026-09-20: yearly allowance active now

The founder moved the yearly allowance forward from 1 October to immediately.

- From September 2026, every member has 2 sit-outs and 3 Solo months per calendar year, per Bloc.
- Previous approved 2026 sit-outs and Solo months count immediately.
- The Status tab and the `This Bloc` profile now show the available allowance immediately.
- The old rolling three-month request rule is retired for September as well.
- A member with no allowance left can still submit an exceptional request; it requires approval.

This changes only the allowance start month in `api/lift-log.js` and `src/lib/appState.js`, which keeps app display and server enforcement identical.
