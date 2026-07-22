import {
  TIMELINE_TITLE_MAX_CODE_POINTS,
  type TimelineValidationCode,
} from "./timeline.types";
import { serializeOccurredAtUtc } from "./timeline-occurred-at";

export class TimelineClientValidationError extends Error {
  constructor(readonly code: TimelineValidationCode) {
    super("Invalid Timeline event request.");
    this.name = "TimelineClientValidationError";
  }
}

export type ValidatedCreateTimelineEventInput = {
  title: string;
  occurredAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Unicode code-point length (not UTF-16 code units). */
export function unicodeCodePointLength(value: string): number {
  return Array.from(value).length;
}

function isWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (
        Number.isNaN(nextCodeUnit) ||
        nextCodeUnit < 0xdc00 ||
        nextCodeUnit > 0xdfff
      ) {
        return false;
      }
      index += 1;
      continue;
    }

    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }

  return true;
}

/**
 * Client-side create validation mirroring server title/occurredAt rules.
 * Server remains authoritative. occurredAtConfirmed must be true before submit.
 */
export function parseCreateTimelineEventInput(input: {
  title: unknown;
  occurredAt: Date | null;
  occurredAtConfirmed: boolean;
}): ValidatedCreateTimelineEventInput {
  if (typeof input.title !== "string") {
    throw new TimelineClientValidationError(
      input.title === undefined ? "TITLE_REQUIRED" : "TITLE_INVALID",
    );
  }

  const title = input.title.trim();
  if (title.length === 0) {
    throw new TimelineClientValidationError("TITLE_REQUIRED");
  }

  if (!isWellFormedUnicode(title) || title.includes("\u0000")) {
    throw new TimelineClientValidationError("TITLE_INVALID");
  }

  if (unicodeCodePointLength(title) > TIMELINE_TITLE_MAX_CODE_POINTS) {
    throw new TimelineClientValidationError("TITLE_TOO_LONG");
  }

  if (!input.occurredAtConfirmed) {
    throw new TimelineClientValidationError("OCCURRED_AT_UNCONFIRMED");
  }

  if (
    !(input.occurredAt instanceof Date) ||
    !Number.isFinite(input.occurredAt.getTime())
  ) {
    throw new TimelineClientValidationError("OCCURRED_AT_REQUIRED");
  }

  return {
    title,
    occurredAt: serializeOccurredAtUtc(input.occurredAt),
  };
}

/** Strict body parser used by the API client before POST. */
export function parseCreateTimelineEventBody(
  value: unknown,
): ValidatedCreateTimelineEventInput {
  if (!isRecord(value)) {
    throw new TimelineClientValidationError("TITLE_REQUIRED");
  }

  if (
    Object.keys(value).some((key) => key !== "title" && key !== "occurredAt")
  ) {
    throw new TimelineClientValidationError("UNKNOWN_FIELD");
  }

  if (!Object.hasOwn(value, "title")) {
    throw new TimelineClientValidationError("TITLE_REQUIRED");
  }

  if (typeof value.title !== "string") {
    throw new TimelineClientValidationError("TITLE_INVALID");
  }

  const title = value.title.trim();
  if (title.length === 0) {
    throw new TimelineClientValidationError("TITLE_REQUIRED");
  }

  if (!isWellFormedUnicode(title) || title.includes("\u0000")) {
    throw new TimelineClientValidationError("TITLE_INVALID");
  }

  if (unicodeCodePointLength(title) > TIMELINE_TITLE_MAX_CODE_POINTS) {
    throw new TimelineClientValidationError("TITLE_TOO_LONG");
  }

  if (!Object.hasOwn(value, "occurredAt")) {
    throw new TimelineClientValidationError("OCCURRED_AT_REQUIRED");
  }

  if (typeof value.occurredAt !== "string") {
    throw new TimelineClientValidationError("OCCURRED_AT_INVALID");
  }

  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(Z|[+-]\d{2}:\d{2})$/.test(
      value.occurredAt,
    )
  ) {
    throw new TimelineClientValidationError("OCCURRED_AT_INVALID");
  }

  return {
    title,
    occurredAt: value.occurredAt,
  };
}
