import type {
  TimelineEvent,
  TimelineRepository,
  TimelineSubject,
} from "./timeline.types";
import {
  assertNoTimelineQueryParameters,
  assertNoTimelineReadBody,
  parseCreateTimelineEventInput,
} from "./timeline-validation";

function assertIdentifier(value: string, name: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${name} must not be empty.`);
  }
}

function isEmptyIdentifier(value: string): boolean {
  return value.trim().length === 0;
}

function hasAvailableTimelineSubject(subject: TimelineSubject): boolean {
  if (
    subject.type === "PREGNANCY" &&
    !("childId" in subject) &&
    typeof subject.pregnancyId === "string"
  ) {
    return !isEmptyIdentifier(subject.pregnancyId);
  }

  if (
    subject.type === "CHILD" &&
    !("pregnancyId" in subject) &&
    typeof subject.childId === "string"
  ) {
    return !isEmptyIdentifier(subject.childId);
  }

  throw new Error(
    "Timeline subject must identify exactly one Pregnancy or Child.",
  );
}

export class TimelineApplicationService {
  constructor(private readonly repository: TimelineRepository) {}

  async createTimelineEvent(
    familyId: string,
    userId: string,
    subject: TimelineSubject,
    input: unknown,
    query?: unknown,
  ): Promise<TimelineEvent | null> {
    assertIdentifier(userId, "userId");
    assertNoTimelineQueryParameters(query);
    const parsedInput = parseCreateTimelineEventInput(input);

    if (isEmptyIdentifier(familyId) || !hasAvailableTimelineSubject(subject)) {
      return null;
    }

    return this.repository.createTimelineEventForMember({
      familyId,
      userId,
      subject,
      title: parsedInput.title,
      occurredAt: parsedInput.occurredAt,
    });
  }

  async listTimelineEvents(
    familyId: string,
    userId: string,
    subject: TimelineSubject,
    body?: unknown,
    query?: unknown,
  ): Promise<TimelineEvent[] | null> {
    assertIdentifier(userId, "userId");
    assertNoTimelineReadBody(body);
    assertNoTimelineQueryParameters(query);

    if (isEmptyIdentifier(familyId) || !hasAvailableTimelineSubject(subject)) {
      return null;
    }

    return this.repository.findTimelineEventsForMember({
      familyId,
      userId,
      subject,
    });
  }

  async getTimelineEvent(
    familyId: string,
    timelineEventId: string,
    userId: string,
    subject: TimelineSubject,
    body?: unknown,
    query?: unknown,
  ): Promise<TimelineEvent | null> {
    assertIdentifier(userId, "userId");
    assertNoTimelineReadBody(body);
    assertNoTimelineQueryParameters(query);

    if (
      isEmptyIdentifier(familyId) ||
      isEmptyIdentifier(timelineEventId) ||
      !hasAvailableTimelineSubject(subject)
    ) {
      return null;
    }

    return this.repository.findTimelineEventForMember({
      familyId,
      timelineEventId,
      userId,
      subject,
    });
  }
}
