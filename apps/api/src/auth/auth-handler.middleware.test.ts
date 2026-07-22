import assert from "node:assert/strict";
import { test } from "node:test";

import type { NextFunction, Request, Response } from "express";

import { AuthHandlerMiddleware } from "./auth-handler.middleware";
import { AuthService } from "./auth.service";

function blockedResponse(): {
  response: Response;
  getStatus: () => number | undefined;
  wasEnded: () => boolean;
} {
  let statusCode: number | undefined;
  let ended = false;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    end() {
      ended = true;
      return this;
    },
  } as unknown as Response;

  return {
    response,
    getStatus: () => statusCode,
    wasEnded: () => ended,
  };
}

for (const route of [
  { method: "GET", path: "/api/auth/verify-email" },
  { method: "GET", path: "/api/auth/verify-email/" },
  { method: "POST", path: "/api/auth/send-verification-email" },
  { method: "POST", path: "/api/auth/send-verification-email/" },
]) {
  test(`blocks raw Better Auth ${route.method} ${route.path}`, async () => {
    let authWasResolved = false;
    let nextWasCalled = false;
    const authService = {
      getAuth: async () => {
        authWasResolved = true;
      },
    } as unknown as AuthService;
    const middleware = new AuthHandlerMiddleware(authService);
    const response = blockedResponse();

    await middleware.use(
      {
        method: route.method,
        path: route.path,
      } as Request,
      response.response,
      (() => {
        nextWasCalled = true;
      }) as NextFunction,
    );

    assert.equal(response.getStatus(), 404);
    assert.equal(response.wasEnded(), true);
    assert.equal(authWasResolved, false);
    assert.equal(nextWasCalled, false);
  });
}
