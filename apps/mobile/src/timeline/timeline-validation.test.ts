import assert from "node:assert/strict";
import { test } from "node:test";

import {
  TimelineClientValidationError,
  parseCreateTimelineEventBody,
  parseCreateTimelineEventInput,
  unicodeCodePointLength,
} from "./timeline-validation";

test("create validation requires title and confirmed occurredAt", () => {
  assert.throws(
    () =>
      parseCreateTimelineEventInput({
        title: "",
        occurredAt: new Date("2026-07-22T11:10:00.000Z"),
        occurredAtConfirmed: true,
      }),
    (error: unknown) =>
      error instanceof TimelineClientValidationError &&
      error.code === "TITLE_REQUIRED",
  );

  assert.throws(
    () =>
      parseCreateTimelineEventInput({
        title: "Event",
        occurredAt: new Date("2026-07-22T11:10:00.000Z"),
        occurredAtConfirmed: false,
      }),
    (error: unknown) =>
      error instanceof TimelineClientValidationError &&
      error.code === "OCCURRED_AT_UNCONFIRMED",
  );
});

test("create validation trims title and accepts 1 and 80 code points", () => {
  const one = parseCreateTimelineEventInput({
    title: "  A  ",
    occurredAt: new Date("2026-07-22T11:10:00.000Z"),
    occurredAtConfirmed: true,
  });
  assert.equal(one.title, "A");
  assert.equal(one.occurredAt, "2026-07-22T11:10:00.000Z");

  const eighty = "a".repeat(80);
  assert.equal(unicodeCodePointLength(eighty), 80);
  assert.equal(
    parseCreateTimelineEventInput({
      title: eighty,
      occurredAt: new Date("2026-07-22T11:10:00.000Z"),
      occurredAtConfirmed: true,
    }).title,
    eighty,
  );
});

test("create validation rejects 81 code points and counts emoji", () => {
  assert.throws(
    () =>
      parseCreateTimelineEventInput({
        title: "a".repeat(81),
        occurredAt: new Date("2026-07-22T11:10:00.000Z"),
        occurredAtConfirmed: true,
      }),
    (error: unknown) =>
      error instanceof TimelineClientValidationError &&
      error.code === "TITLE_TOO_LONG",
  );

  const emoji = "😀".repeat(80);
  assert.equal(unicodeCodePointLength(emoji), 80);
  assert.equal(
    parseCreateTimelineEventInput({
      title: emoji,
      occurredAt: new Date("2026-07-22T11:10:00.000Z"),
      occurredAtConfirmed: true,
    }).title,
    emoji,
  );
});

test("body parser rejects unknown fields and invalid occurredAt shapes", () => {
  assert.throws(
    () =>
      parseCreateTimelineEventBody({
        title: "Ok",
        occurredAt: "2026-07-22T11:10:00.000Z",
        note: "nope",
      }),
    (error: unknown) =>
      error instanceof TimelineClientValidationError &&
      error.code === "UNKNOWN_FIELD",
  );

  assert.throws(
    () =>
      parseCreateTimelineEventBody({
        title: "Ok",
        occurredAt: "2026-07-22T11:10:00Z",
      }),
    (error: unknown) =>
      error instanceof TimelineClientValidationError &&
      error.code === "OCCURRED_AT_INVALID",
  );

  assert.deepEqual(
    parseCreateTimelineEventBody({
      title: "  Dup  ",
      occurredAt: "2026-07-22T11:10:00.000Z",
    }),
    { title: "Dup", occurredAt: "2026-07-22T11:10:00.000Z" },
  );
});
