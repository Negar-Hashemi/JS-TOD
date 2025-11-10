const S = require("../src/state");

describe("test-level order dependency", () => {
  test("prepare name", () => {
    S.setName("alpha");
    expect(S.get().name).toBe("alpha");
  });

  test("use name (expects alpha)", () => {
    expect(S.get().name).toBe("alpha"); // will fail if executed before 'prepare name'
  });
});
