const { sum, mul } = require("../src/math");

test("adds 1 + 2 = 3", () => {
  expect(sum(1, 2)).toBe(3);
});

test("multiplies 2 * 4 = 8", () => {
  expect(mul(2, 4)).toBe(8);
});
