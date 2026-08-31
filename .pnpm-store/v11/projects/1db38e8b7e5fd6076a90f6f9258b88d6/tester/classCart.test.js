const test = require("node:test");
const assert = require("node:assert/strict");

const { cartLoadErrors } = require("../controllers/classCart");

test("cart load allows the fourth course up to 15 units", () => {
  assert.deepEqual(cartLoadErrors(3, 12, 3), []);
});

test("cart load rejects a fifth course", () => {
  const errors = cartLoadErrors(4, 12, 3);
  assert.equal(errors.some((error) => error.code === "CART_COURSE_LIMIT"), true);
});

test("cart load rejects a course that would exceed 15 units", () => {
  const errors = cartLoadErrors(3, 13, 3);
  assert.equal(errors.some((error) => error.code === "CART_UNIT_LIMIT"), true);
});
