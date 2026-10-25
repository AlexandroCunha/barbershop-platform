import assert from "node:assert/strict";
import { test } from "node:test";
import { parseContactEmail } from "../validations/barber.js";
import { AppError } from "../utils/app-error.js";

test("the barber's booking e-mail is trimmed and lower-cased", () => {
  assert.equal(parseContactEmail({ email: "  Chair@Shop.TEST " }), "chair@shop.test");
});

test("an empty value clears the barber's booking e-mail", () => {
  assert.equal(parseContactEmail({ email: "" }), "");
  assert.equal(parseContactEmail({ email: null }), "");
});

test("a booking e-mail that is not an address is refused", () => {
  assert.throws(() => parseContactEmail({ email: "not-an-address" }), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.status, 400);
    return true;
  });
  assert.throws(() => parseContactEmail({ email: 12 }), AppError);
  assert.throws(() => parseContactEmail([]), AppError);
});
