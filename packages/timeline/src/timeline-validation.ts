import { z } from "zod";

export const TIMELINE_TITLE_MAX_LENGTH = 80;

export type TimelineValidationCode =
  | "TITLE_REQUIRED"
  | "TITLE_INVALID"
  | "TITLE_TOO_LONG"
  | "OCCURRED_AT_REQUIRED"
  | "OCCURRED_AT_INVALID"
  | "UNKNOWN_FIELD"
  | "UNKNOWN_QUERY_PARAMETER";

export class TimelineValidationError extends Error {
  constructor(readonly code: TimelineValidationCode) {
    super("Invalid Timeline event request.");
    this.name = "TimelineValidationError";
  }
}

export type CreateTimelineEventInput = {
  title: string;
  occurredAt: Date;
};

const rawCreateTimelineEventSchema = z.strictObject({
  title: z.string(),
  occurredAt: z.string(),
});

const timestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|([+-])(\d{2}):(\d{2}))$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseOccurredAt(value: string): Date {
  const match = timestampPattern.exec(value);

  if (!match) {
    throw new TimelineValidationError("OCCURRED_AT_INVALID");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number(match[7]);
  const offset = match[8];
  const offsetSign = match[9];
  const offsetHour = Number(match[10] ?? 0);
  const offsetMinute = Number(match[11] ?? 0);

  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0) ||
    offset === "-00:00"
  ) {
    throw new TimelineValidationError("OCCURRED_AT_INVALID");
  }

  const offsetMagnitude = offsetHour * 60 + offsetMinute;
  const signedOffsetMinutes =
    offset === "Z"
      ? 0
      : offsetSign === "+"
        ? offsetMagnitude
        : -offsetMagnitude;
  const localDateTime = new Date(0);

  localDateTime.setUTCFullYear(year, month - 1, day);
  localDateTime.setUTCHours(hour, minute, second, millisecond);

  const occurredAt = new Date(
    localDateTime.getTime() - signedOffsetMinutes * 60_000,
  );
  const normalizedYear = occurredAt.getUTCFullYear();

  if (
    !Number.isFinite(occurredAt.getTime()) ||
    normalizedYear < 1 ||
    normalizedYear > 9999
  ) {
    throw new TimelineValidationError("OCCURRED_AT_INVALID");
  }

  return occurredAt;
}

export function assertNoTimelineQueryParameters(query: unknown): void {
  if (
    query !== undefined &&
    (!isRecord(query) || Object.keys(query).length > 0)
  ) {
    throw new TimelineValidationError("UNKNOWN_QUERY_PARAMETER");
  }
}

export function assertNoTimelineReadBody(body: unknown): void {
  if (body !== undefined) {
    throw new TimelineValidationError("UNKNOWN_FIELD");
  }
}

export function parseCreateTimelineEventInput(
  value: unknown,
): CreateTimelineEventInput {
  if (!isRecord(value)) {
    throw new TimelineValidationError("TITLE_REQUIRED");
  }

  if (
    Object.keys(value).some((key) => key !== "title" && key !== "occurredAt")
  ) {
    throw new TimelineValidationError("UNKNOWN_FIELD");
  }

  if (!Object.hasOwn(value, "title")) {
    throw new TimelineValidationError("TITLE_REQUIRED");
  }

  if (typeof value.title !== "string") {
    throw new TimelineValidationError("TITLE_INVALID");
  }

  const title = value.title.trim();

  if (title.length === 0) {
    throw new TimelineValidationError("TITLE_REQUIRED");
  }

  if (!isWellFormedUnicode(title) || title.includes("\u0000")) {
    throw new TimelineValidationError("TITLE_INVALID");
  }

  if (Array.from(title).length > TIMELINE_TITLE_MAX_LENGTH) {
    throw new TimelineValidationError("TITLE_TOO_LONG");
  }

  if (!Object.hasOwn(value, "occurredAt")) {
    throw new TimelineValidationError("OCCURRED_AT_REQUIRED");
  }

  if (typeof value.occurredAt !== "string") {
    throw new TimelineValidationError("OCCURRED_AT_INVALID");
  }

  const result = rawCreateTimelineEventSchema.safeParse(value);

  if (!result.success) {
    throw new TimelineValidationError("UNKNOWN_FIELD");
  }

  return {
    title,
    occurredAt: parseOccurredAt(result.data.occurredAt),
  };
}
