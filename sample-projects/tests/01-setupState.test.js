const S = require("../src/state");

describe("suite A (sets shared flag)", () => {
  test("set flag true", () => {
    S.setFlag(true);
    expect(S.get().flag).toBe(true);
  });
});
