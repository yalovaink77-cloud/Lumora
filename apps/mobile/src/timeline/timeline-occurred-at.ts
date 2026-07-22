/**
 * occurredAt capture and display helpers (ADR-024).
 * Serializes confirmed device-local Instant values as UTC RFC 3339 with ms.
 */

/** Serialize a confirmed Date instant to API-accepted UTC with milliseconds. */
export function serializeOccurredAtUtc(value: Date): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error("Invalid occurredAt Date.");
  }

  return value.toISOString();
}

export type FormatTimelineOccurredAtOptions = {
  locale?: string;
  timeZone?: string;
};

/**
 * Device-local readable formatting boundary for API UTC timestamps.
 * Inject locale/timeZone in tests for deterministic assertions.
 */
export function formatTimelineOccurredAt(
  isoUtc: string,
  options: FormatTimelineOccurredAtOptions = {},
): string {
  const parsed = Date.parse(isoUtc);
  if (!Number.isFinite(parsed)) {
    return isoUtc;
  }

  const formatter = new Intl.DateTimeFormat(options.locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  });

  return formatter.format(new Date(parsed));
}

export type OccurredAtSelectionState = {
  selected: Date;
  confirmed: boolean;
};

export function createInitialOccurredAtSelection(
  now: Date = new Date(),
): OccurredAtSelectionState {
  return {
    selected: now,
    confirmed: false,
  };
}

/** Picker dismissal must not confirm. Only explicit confirmation does. */
export function applyOccurredAtPickerChange(
  state: OccurredAtSelectionState,
  next: Date,
  dismissed: boolean,
): OccurredAtSelectionState {
  if (dismissed) {
    return state;
  }

  if (!Number.isFinite(next.getTime())) {
    return state;
  }

  return {
    selected: next,
    confirmed: false,
  };
}

export function confirmOccurredAtSelection(
  state: OccurredAtSelectionState,
): OccurredAtSelectionState {
  if (!Number.isFinite(state.selected.getTime())) {
    return state;
  }

  return {
    ...state,
    confirmed: true,
  };
}
