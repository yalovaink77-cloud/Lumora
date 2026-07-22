import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertNoTimelineQueryParameters,
  assertNoTimelineReadBody,
  parseCreateTimelineEventInput,
  TIMELINE_TITLE_MAX_LENGTH,
  TimelineValidationError,
} from "./timeline-validation";

function assertValidationCode(input: unknown, expectedCode: string): void {
  assert.throws(
    () => parseCreateTimelineEventInput(input),
    (error: unknown) =>
      error instanceof TimelineValidationError && error.code === expectedCode,
  );
}

test("trims a valid Unicode title and normalizes occurredAt to UTC", () => {
  assert.deepEqual(
    parseCreateTimelineEventInput({
      title: "  İlk hareket 🌿  ",
      occurredAt: "2026-07-22T14:10:00.123+03:00",
    }),
    {
      title: "İlk hareket 🌿",
      occurredAt: new Date("2026-07-22T11:10:00.123Z"),
    },
  );
});

test("accepts exactly 80 Unicode code points and duplicate content", () => {
  const exactMaximum = "🌿".repeat(TIMELINE_TITLE_MAX_LENGTH);
  const input = {
    title: exactMaximum,
    occurredAt: "2026-07-22T11:10:00.000Z",
  };

  assert.equal(parseCreateTimelineEventInput(input).title, exactMaximum);
  assert.equal(parseCreateTimelineEventInput(input).title, exactMaximum);
});

test("rejects missing, invalid, empty, and oversized titles", () => {
  assertValidationCode(undefined, "TITLE_REQUIRED");
  assertValidationCode(
    {
      occurredAt: "2026-07-22T11:10:00.000Z",
    },
    "TITLE_REQUIRED",
  );
  assertValidationCode(
    {
      title: 42,
      occurredAt: "2026-07-22T11:10:00.000Z",
    },
    "TITLE_INVALID",
  );
  assertValidationCode(
    {
      title: " \t\n ",
      occurredAt: "2026-07-22T11:10:00.000Z",
    },
    "TITLE_REQUIRED",
  );
  assertValidationCode(
    {
      title: "🌿".repeat(TIMELINE_TITLE_MAX_LENGTH + 1),
      occurredAt: "2026-07-22T11:10:00.000Z",
    },
    "TITLE_TOO_LONG",
  );
  assertValidationCode(
    {
      title: "\ud800",
      occurredAt: "2026-07-22T11:10:00.000Z",
    },
    "TITLE_INVALID",
  );
  assertValidationCode(
    {
      title: "invalid\u0000title",
      occurredAt: "2026-07-22T11:10:00.000Z",
    },
    "TITLE_INVALID",
  );
});

test("rejects missing and non-string occurredAt", () => {
  assertValidationCode(
    {
      title: "Event",
    },
    "OCCURRED_AT_REQUIRED",
  );
  assertValidationCode(
    {
      title: "Event",
      occurredAt: 42,
    },
    "OCCURRED_AT_INVALID",
  );
});

test("accepts exact UTC and numeric-offset timestamp profiles", () => {
  const utc = parseCreateTimelineEventInput({
    title: "UTC event",
    occurredAt: "2024-02-29T23:59:59.999Z",
  });
  const offset = parseCreateTimelineEventInput({
    title: "Offset event",
    occurredAt: "2024-03-01T13:59:59.999+14:00",
  });

  assert.equal(utc.occurredAt.toISOString(), "2024-02-29T23:59:59.999Z");
  assert.equal(offset.occurredAt.toISOString(), "2024-02-29T23:59:59.999Z");
});

test("rejects malformed, ambiguous, and impossible timestamps", () => {
  for (const occurredAt of [
    "2026-07-22T11:10:00Z",
    "2026-07-22T11:10:00.000",
    "2026-07-22 11:10:00.000Z",
    "2026-07-22T11:10:00.000z",
    "2026-07-22T11:10:00.00Z",
    "2026-07-22T11:10:00.0000Z",
    "2026-02-29T11:10:00.000Z",
    "2024-13-01T11:10:00.000Z",
    "2024-04-31T11:10:00.000Z",
    "2024-01-01T24:00:00.000Z",
    "2024-01-01T23:60:00.000Z",
    "2024-01-01T23:59:60.000Z",
    "2024-01-01T12:00:00.000+14:01",
    "2024-01-01T12:00:00.000+15:00",
    "2024-01-01T12:00:00.000-00:00",
    "0000-01-01T00:00:00.000Z",
    "0001-01-01T00:00:00.000+14:00",
    "9999-12-31T23:59:59.999-14:00",
  ]) {
    assertValidationCode(
      {
        title: "Event",
        occurredAt,
      },
      "OCCURRED_AT_INVALID",
    );
  }
});

test("does not impose a past-or-future server-clock rule", () => {
  assert.equal(
    parseCreateTimelineEventInput({
      title: "Historical",
      occurredAt: "0001-01-01T00:00:00.000Z",
    }).occurredAt.toISOString(),
    "0001-01-01T00:00:00.000Z",
  );
  assert.equal(
    parseCreateTimelineEventInput({
      title: "User-stated future",
      occurredAt: "9999-12-31T23:59:59.999Z",
    }).occurredAt.toISOString(),
    "9999-12-31T23:59:59.999Z",
  );
});

test("rejects every unknown creation field", () => {
  for (const field of [
    "id",
    "familyId",
    "pregnancyId",
    "childId",
    "subjectId",
    "subjectType",
    "userId",
    "role",
    "createdAt",
    "updatedAt",
    "note",
    "category",
    "medicalClassification",
  ]) {
    assertValidationCode(
      {
        title: "Event",
        occurredAt: "2026-07-22T11:10:00.000Z",
        [field]: "client-supplied",
      },
      "UNKNOWN_FIELD",
    );
  }
});

test("rejects read bodies and every query parameter", () => {
  assert.doesNotThrow(() => assertNoTimelineReadBody(undefined));
  assert.doesNotThrow(() => assertNoTimelineQueryParameters(undefined));
  assert.doesNotThrow(() => assertNoTimelineQueryParameters({}));

  assert.throws(
    () => assertNoTimelineReadBody({}),
    (error: unknown) =>
      error instanceof TimelineValidationError &&
      error.code === "UNKNOWN_FIELD",
  );
  assert.throws(
    () => assertNoTimelineReadBody({ title: "private" }),
    (error: unknown) =>
      error instanceof TimelineValidationError &&
      error.code === "UNKNOWN_FIELD",
  );
  assert.throws(
    () => assertNoTimelineQueryParameters({ page: "1" }),
    (error: unknown) =>
      error instanceof TimelineValidationError &&
      error.code === "UNKNOWN_QUERY_PARAMETER",
  );
});
