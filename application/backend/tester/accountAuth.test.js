const test = require("node:test");
const assert = require("node:assert/strict");
const { bbeduemail } = require("../controllers/accountAuth");

test("BBEdu email addresses qualify for fast-track signup", () => {
  assert.equal(bbeduemail("student@bbedu.com"), true);
  assert.equal(bbeduemail(" Student@BBEDU.COM "), true);
});

test("lookalike and unrelated domains do not qualify for fast-track signup", () => {
  assert.equal(bbeduemail("student@bbedu.com.example.org"), false);
  assert.equal(bbeduemail("student@notbbedu.com"), false);
  assert.equal(bbeduemail("@bbedu.com"), false);
  assert.equal(bbeduemail("student@@bbedu.com"), false);
  assert.equal(bbeduemail("student@sfsu.edu"), false);
});
