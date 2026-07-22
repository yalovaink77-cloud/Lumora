import { HttpException, Injectable } from "@nestjs/common";

import { emailVerificationRateLimitedResponse } from "./auth.constants";

type VerificationAction = "confirm" | "request";

const WINDOW_MS = 60_000;
const LIMITS: Record<VerificationAction, number> = {
  request: 3,
  confirm: 10,
};

@Injectable()
export class EmailVerificationRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  assertAllowed(
    action: VerificationAction,
    userId: string,
    ipAddress: string,
    now = Date.now(),
  ): void {
    const keys = [`${action}:user:${userId}`, `${action}:ip:${ipAddress}`];
    const threshold = now - WINDOW_MS;
    const activeAttempts = keys.map((key) => {
      const attempts = (this.attempts.get(key) ?? []).filter(
        (attempt) => attempt > threshold,
      );

      if (attempts.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, attempts);
      }

      return attempts;
    });

    if (activeAttempts.some((attempts) => attempts.length >= LIMITS[action])) {
      throw new HttpException(emailVerificationRateLimitedResponse, 429);
    }

    keys.forEach((key, index) => {
      this.attempts.set(key, [...(activeAttempts[index] ?? []), now]);
    });
  }
}
