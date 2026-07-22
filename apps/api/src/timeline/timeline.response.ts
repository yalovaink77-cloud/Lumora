import type { TimelineEvent } from "@lumora/timeline";

type TimelineEventResponseBase = {
  id: string;
  familyId: string;
  title: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PregnancyTimelineEventResponse = TimelineEventResponseBase & {
  pregnancyId: string;
};

export type ChildTimelineEventResponse = TimelineEventResponseBase & {
  childId: string;
};

export function toPregnancyTimelineEventResponse(
  event: TimelineEvent,
): PregnancyTimelineEventResponse {
  if (!("pregnancyId" in event)) {
    throw new Error("Expected a Pregnancy Timeline event.");
  }

  return {
    id: event.id,
    familyId: event.familyId,
    pregnancyId: event.pregnancyId,
    title: event.title,
    occurredAt: event.occurredAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export function toChildTimelineEventResponse(
  event: TimelineEvent,
): ChildTimelineEventResponse {
  if (!("childId" in event)) {
    throw new Error("Expected a Child Timeline event.");
  }

  return {
    id: event.id,
    familyId: event.familyId,
    childId: event.childId,
    title: event.title,
    occurredAt: event.occurredAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}
