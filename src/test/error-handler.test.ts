import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { errorHandler } from "../middlewares/error-handler.js";
import { AppError } from "../utils/app-error.js";

/** Runs the handler and records the status and JSON body it would send. */
function respondTo(error: unknown): { status: number; body: unknown } {
  const sent = { status: 0, body: undefined as unknown };
  const res = {
    status(code: number) {
      sent.status = code;
      return res;
    },
    json(body: unknown) {
      sent.body = body;
      return res;
    },
  };
  const noNext: NextFunction = () => undefined;
  errorHandler(error, {} as Request, res as unknown as Response, noNext);
  return sent;
}

/** An error shaped like the ones body-parser raises. */
function bodyError(type: string, status: number): Error {
  return Object.assign(new Error("parser wording that must not leak"), { type, status, expose: true });
}

test("an AppError keeps its own status and message", () => {
  assert.deepEqual(respondTo(new AppError(409, "That time is no longer available")), {
    status: 409,
    body: { error: "That time is no longer available" },
  });
});

test("malformed JSON is a 400 with a plain message, not a 500", () => {
  assert.deepEqual(respondTo(bodyError("entity.parse.failed", 400)), {
    status: 400,
    body: { error: "The request body is not valid JSON" },
  });
});

test("an oversized body is a 413", () => {
  assert.deepEqual(respondTo(bodyError("entity.too.large", 413)), {
    status: 413,
    body: { error: "The file is too large" },
  });
});

test("other client-side body errors keep their 4xx status without exposing the parser's wording", () => {
  assert.deepEqual(respondTo(bodyError("charset.unsupported", 415)), {
    status: 415,
    body: { error: "The request could not be processed" },
  });
});

test("an unexpected error is a 500 with no internal detail", () => {
  const originalError = console.error;
  console.error = () => undefined;
  try {
    assert.deepEqual(respondTo(new Error("database connection lost")), {
      status: 500,
      body: { error: "Internal server error" },
    });
  } finally {
    console.error = originalError;
  }
});
