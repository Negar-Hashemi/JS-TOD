const S = require("../src/state");

describe("suite B (consumes flag)", () => {
  test("expects flag to be true (order-dependent)", () => {
    // This will fail if this file runs before 01-setupState.test.js in the same process.
    expect(S.get().flag).toBe(true);
  });
});
