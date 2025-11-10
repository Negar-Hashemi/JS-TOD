# Sample Project for JS-TOD

This project intentionally contains **order-dependent** behaviors at three levels:

- **Suite level (test files):** `tests/01-setupState.test.js` must run before `tests/02-consumeState.test.js`.
- **Describe level (within a file):** `tests/03-describe-order.test.js` has two `describe` blocks where the second depends on the first.
- **Test level (within a describe):** `tests/04-test-order.test.js` has a test that depends on a previous test.

JS-TOD can reorder each level to reveal these hidden dependencies.

## Install

```bash
npm install
```

## Run tests normally

```bash
npm test
```

## Run tests in a single process (to highlight cross-file state)

```bash
npm run test:inband
```

## Files

- `src/state.js` — shared mutable state to simulate test interference.
- `tests/01-setupState.test.js` — sets a flag (suite A).
- `tests/02-consumeState.test.js` — expects the flag to be set (suite B).
- `tests/03-describe-order.test.js` — describe-level dependency.
- `tests/04-test-order.test.js` — test-level dependency.
