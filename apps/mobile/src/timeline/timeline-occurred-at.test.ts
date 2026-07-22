import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyOccurredAtPickerChange,
  confirmOccurredAtSelection,
  createInitialOccurredAtSelection,
  formatTimelineOccurredAt,
  serializeOccurredAtUtc,
} from "./timeline-occurred-at";

test("serializeOccurredAtUtc emits UTC with milliseconds", () => {
  const value = new Date("2026-07-22T11:10:00.123Z");
  assert.equal(serializeOccurredAtUtc(value), "2026-07-22T11:10:00.123Z");
});

test("untouched selection starts unconfirmed", () => {
  const initial = createInitialOccurredAtSelection(
    new Date("2026-07-22T11:10:00.000Z"),
  );
  assert.equal(initial.confirmed, false);
});

test("picker dismissal does not confirm or change selection", () => {
  const initial = createInitialOccurredAtSelection(
    new Date("2026-07-22T11:10:00.000Z"),
  );
  const next = applyOccurredAtPickerChange(
    initial,
    new Date("2026-07-23T12:00:00.000Z"),
    true,
  );
  assert.equal(next.confirmed, false);
  assert.equal(next.selected.toISOString(), "2026-07-22T11:10:00.000Z");
});

test("picker change updates value and clears confirmation", () => {
  const confirmed = confirmOccurredAtSelection(
    createInitialOccurredAtSelection(new Date("2026-07-22T11:10:00.000Z")),
  );
  assert.equal(confirmed.confirmed, true);

  const changed = applyOccurredAtPickerChange(
    confirmed,
    new Date("2026-07-23T12:00:00.000Z"),
    false,
  );
  assert.equal(changed.confirmed, false);
  assert.equal(changed.selected.toISOString(), "2026-07-23T12:00:00.000Z");
});

test("explicit confirmation accepts current selection including now", () => {
  const initial = createInitialOccurredAtSelection(
    new Date("2026-07-22T11:10:00.000Z"),
  );
  const confirmed = confirmOccurredAtSelection(initial);
  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.selected.toISOString(), "2026-07-22T11:10:00.000Z");
});

test("formatTimelineOccurredAt is deterministic with injected timeZone", () => {
  const formatted = formatTimelineOccurredAt("2026-07-22T11:10:00.123Z", {
    locale: "en-US",
    timeZone: "UTC",
  });
  assert.match(formatted, /Jul/);
  assert.match(formatted, /22/);
  assert.match(formatted, /11:10/);
});
