const test = require("node:test");
const assert = require("node:assert/strict");
const { createToken, verifyToken, revokeToken, requireAdmin } = require("../middleware/token");

function responseRecorder() {
  // Lightweight response double for authentication middleware tests.
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test("a signed token verifies its user and role", () => {
  const token = createToken({ user_id: 7, user_role: "admin" });
  const decoded = verifyToken(token);
  assert.equal(decoded.userId, 7);
  assert.equal(decoded.role, "admin");
  assert.ok(decoded.exp > Math.floor(Date.now() / 1000));
});

test("a modified token is rejected", () => {
  const token = createToken({ user_id: 7, user_role: "admin" });
  const [payload, signature] = token.split(".");
  assert.equal(verifyToken(`${payload}.${signature.slice(0, -1)}x`), null);
});

test("a signed token with an unsupported role is rejected", () => {
  const token = createToken({ user_id: 7, user_role: "owner" });
  assert.equal(verifyToken(token), null);
});

test("a revoked token is rejected", () => {
  const token = createToken({ user_id: 8, user_role: "student" });
  const decoded = verifyToken(token);
  revokeToken(token, decoded);
  assert.equal(verifyToken(token), null);
});

test("requireAdmin rejects a valid student token with 403", () => {
  const token = createToken({ user_id: 9, user_role: "student" });
  const req = { get: () => `Bearer ${token}` };
  const res = responseRecorder();
  requireAdmin(req, res, () => assert.fail("student token must not call next"));
  assert.equal(res.statusCode, 403);
});

test("requireAdmin accepts a valid admin token", () => {
  const token = createToken({ user_id: 10, user_role: "admin" });
  const req = { get: () => `Bearer ${token}` };
  const res = responseRecorder();
  let called = false;
  requireAdmin(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.deepEqual(req.auth.role, "admin");
});
