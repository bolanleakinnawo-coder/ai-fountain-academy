const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const { evaluateTransaction, isValidSignature } = require("../src/paystack");

const payment = { reference: "afa_1", uid: "u1", courseId: "c1", amountKobo: 2500000, currency: "NGN" };
const tx = (over = {}) => ({
  reference: "afa_1", status: "success", amount: 2500000, currency: "NGN",
  metadata: { uid: "u1", courseId: "c1" }, ...over,
});

test("accepts a matching successful transaction", () => {
  assert.deepStrictEqual(evaluateTransaction(payment, tx()), { ok: true, status: "success" });
});
test("rejects a lower amount", () => {
  assert.strictEqual(evaluateTransaction(payment, tx({ amount: 100 })).ok, false);
});
test("rejects another currency", () => {
  assert.strictEqual(evaluateTransaction(payment, tx({ currency: "USD" })).ok, false);
});
test("rejects metadata for another user", () => {
  assert.strictEqual(evaluateTransaction(payment, tx({ metadata: { uid: "u2", courseId: "c1" } })).ok, false);
});
test("maps abandoned and failed", () => {
  assert.strictEqual(evaluateTransaction(payment, tx({ status: "abandoned" })).status, "abandoned");
  assert.strictEqual(evaluateTransaction(payment, tx({ status: "failed" })).status, "failed");
  assert.strictEqual(evaluateTransaction(payment, tx({ status: "ongoing" })).status, "pending");
});
test("checks webhook signatures", () => {
  const body = Buffer.from(JSON.stringify({ event: "charge.success" }));
  const sig = crypto.createHmac("sha512", "sk_test").update(body).digest("hex");
  assert.ok(isValidSignature("sk_test", body, sig));
  assert.ok(!isValidSignature("sk_test", body, "bad"));
  assert.ok(!isValidSignature("sk_other", body, sig));
});
