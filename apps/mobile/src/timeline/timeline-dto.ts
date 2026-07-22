import type {
  MobileChildTimelineEvent,
  MobilePregnancyTimelineEvent,
} from "./timeline.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Accepts API UTC RFC 3339 with milliseconds (and common ISO variants from Date). */
export function isApiTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return false;
  }

  // Require millisecond precision UTC shape from API responses.
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
}

function mapBaseFields(body: Record<string, unknown>): {
  id: string;
  familyId: string;
  title: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
} | null {
  if (
    typeof body.id !== "string" ||
    body.id.length === 0 ||
    typeof body.familyId !== "string" ||
    body.familyId.length === 0 ||
    typeof body.title !== "string" ||
    !isApiTimestamp(body.occurredAt) ||
    !isApiTimestamp(body.createdAt) ||
    !isApiTimestamp(body.updatedAt)
  ) {
    return null;
  }

  return {
    id: body.id,
    familyId: body.familyId,
    title: body.title,
    occurredAt: body.occurredAt,
    createdAt: body.createdAt,
    updatedAt: body.updatedAt,
  };
}

export function mapPregnancyTimelineEventResponse(
  body: unknown,
  expectedFamilyId: string,
  expectedPregnancyId: string,
): MobilePregnancyTimelineEvent | null {
  if (!isRecord(body)) {
    return null;
  }

  if (Object.hasOwn(body, "childId")) {
    return null;
  }

  const base = mapBaseFields(body);
  if (!base) {
    return null;
  }

  if (
    typeof body.pregnancyId !== "string" ||
    body.pregnancyId.length === 0 ||
    base.familyId !== expectedFamilyId ||
    body.pregnancyId !== expectedPregnancyId
  ) {
    return null;
  }

  return {
    ...base,
    pregnancyId: body.pregnancyId,
  };
}

export function mapChildTimelineEventResponse(
  body: unknown,
  expectedFamilyId: string,
  expectedChildId: string,
): MobileChildTimelineEvent | null {
  if (!isRecord(body)) {
    return null;
  }

  if (Object.hasOwn(body, "pregnancyId")) {
    return null;
  }

  const base = mapBaseFields(body);
  if (!base) {
    return null;
  }

  if (
    typeof body.childId !== "string" ||
    body.childId.length === 0 ||
    base.familyId !== expectedFamilyId ||
    body.childId !== expectedChildId
  ) {
    return null;
  }

  return {
    ...base,
    childId: body.childId,
  };
}

export function mapPregnancyTimelineListResponse(
  body: unknown,
  expectedFamilyId: string,
  expectedPregnancyId: string,
): MobilePregnancyTimelineEvent[] | null {
  if (!isRecord(body) || !Array.isArray(body.timelineEvents)) {
    return null;
  }

  const events: MobilePregnancyTimelineEvent[] = [];
  for (const item of body.timelineEvents) {
    const mapped = mapPregnancyTimelineEventResponse(
      item,
      expectedFamilyId,
      expectedPregnancyId,
    );
    if (!mapped) {
      return null;
    }
    events.push(mapped);
  }

  return events;
}

export function mapChildTimelineListResponse(
  body: unknown,
  expectedFamilyId: string,
  expectedChildId: string,
): MobileChildTimelineEvent[] | null {
  if (!isRecord(body) || !Array.isArray(body.timelineEvents)) {
    return null;
  }

  const events: MobileChildTimelineEvent[] = [];
  for (const item of body.timelineEvents) {
    const mapped = mapChildTimelineEventResponse(
      item,
      expectedFamilyId,
      expectedChildId,
    );
    if (!mapped) {
      return null;
    }
    events.push(mapped);
  }

  return events;
}

export function upsertTimelineEventSorted<T extends MobileTimelineEventLike>(
  events: readonly T[],
  event: T,
): T[] {
  const next = events.filter((item) => item.id !== event.id);
  next.push(event);
  // Preserve server order keys only when merging a known event; do not invent
  // a different product sort. Sort by occurredAt/createdAt/id descending.
  next.sort((left, right) => {
    if (left.occurredAt > right.occurredAt) {
      return -1;
    }
    if (left.occurredAt < right.occurredAt) {
      return 1;
    }
    if (left.createdAt > right.createdAt) {
      return -1;
    }
    if (left.createdAt < right.createdAt) {
      return 1;
    }
    if (left.id > right.id) {
      return -1;
    }
    if (left.id < right.id) {
      return 1;
    }
    return 0;
  });
  return next;
}

type MobileTimelineEventLike = {
  id: string;
  occurredAt: string;
  createdAt: string;
};
