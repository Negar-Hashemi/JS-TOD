const S = require("../src/state");

/**
 * This file is crafted so that the *relative order of describe blocks* matters.
 * If "dependent" runs before "prep" (as JS-TOD may reorder), it will fail.
 */

describe("prep (increments counter in beforeAll)", () => {
  beforeAll(() => {
    // increment once
    S.inc();
  });

  test("counter should be >= 1 after prep", () => {
    expect(S.get().counter).toBeGreaterThanOrEqual(1);
  });
});

describe("dependent (requires counter === 1)", () => {
  beforeAll(() => {
    // expects that prep has already run exactly once
    if (S.get().counter !== 1) {
      // Make it visible when it fails due to reordering
      throw new Error("counter is not 1; actual: " + S.get().counter);
    }
  });

  test("counter observed as 1", () => {
    expect(S.get().counter).toBe(1);
  });
});
