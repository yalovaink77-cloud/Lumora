import assert from "node:assert/strict";
import { test } from "node:test";

import { TimelineApplicationService } from "./timeline-application.service";
import type {
  CreateTimelineEventPersistenceInput,
  FindTimelineEventPersistenceInput,
  FindTimelineEventsPersistenceInput,
  TimelineEvent,
  TimelineRepository,
} from "./timeline.types";

class RecordingTimelineRepository implements TimelineRepository {
  readonly createInputs: CreateTimelineEventPersistenceInput[] = [];
  readonly listInputs: FindTimelineEventsPersistenceInput[] = [];
  readonly getInputs: FindTimelineEventPersistenceInput[] = [];

  async createTimelineEventForMember(
    input: CreateTimelineEventPersistenceInput,
  ): Promise<TimelineEvent> {
    this.createInputs.push(input);
    const now = new Date("2026-07-22T12:00:00.000Z");
    const base = {
      id: `event-${this.createInputs.length}`,
      familyId: input.familyId,
      title: input.title,
      occurredAt: input.occurredAt,
      createdAt: now,
      updatedAt: now,
    };

    return input.subject.type === "PREGNANCY"
      ? {
          ...base,
          pregnancyId: input.subject.pregnancyId,
        }
      : {
          ...base,
          childId: input.subject.childId,
        };
  }

  async findTimelineEventsForMember(
    input: FindTimelineEventsPersistenceInput,
  ): Promise<TimelineEvent[]> {
    this.listInputs.push(input);
    return [];
  }

  async findTimelineEventForMember(
    input: FindTimelineEventPersistenceInput,
  ): Promise<TimelineEvent | null> {
    this.getInputs.push(input);
    return null;
  }
}

test("creates normalized Pregnancy and Child events from neutral scope", async () => {
  const repository = new RecordingTimelineRepository();
  const service = new TimelineApplicationService(repository);

  await service.createTimelineEvent(
    "family-1",
    "user-1",
    {
      type: "PREGNANCY",
      pregnancyId: "pregnancy-1",
    },
    {
      title: "  First movement 🌿  ",
      occurredAt: "2026-07-22T14:10:00.123+03:00",
    },
  );
  await service.createTimelineEvent(
    "family-1",
    "user-1",
    {
      type: "CHILD",
      childId: "child-1",
    },
    {
      title: "First step",
      occurredAt: "2026-07-22T11:10:00.123Z",
    },
  );

  assert.deepEqual(repository.createInputs, [
    {
      familyId: "family-1",
      userId: "user-1",
      subject: {
        type: "PREGNANCY",
        pregnancyId: "pregnancy-1",
      },
      title: "First movement 🌿",
      occurredAt: new Date("2026-07-22T11:10:00.123Z"),
    },
    {
      familyId: "family-1",
      userId: "user-1",
      subject: {
        type: "CHILD",
        childId: "child-1",
      },
      title: "First step",
      occurredAt: new Date("2026-07-22T11:10:00.123Z"),
    },
  ]);
});

test("passes subject, membership, and event scope to list and get", async () => {
  const repository = new RecordingTimelineRepository();
  const service = new TimelineApplicationService(repository);
  const subject = {
    type: "CHILD",
    childId: "child-1",
  } as const;

  await service.listTimelineEvents(
    "family-1",
    "user-1",
    subject,
    undefined,
    {},
  );
  await service.getTimelineEvent(
    "family-1",
    "event-1",
    "user-1",
    subject,
    undefined,
    {},
  );

  assert.deepEqual(repository.listInputs, [
    {
      familyId: "family-1",
      userId: "user-1",
      subject,
    },
  ]);
  assert.deepEqual(repository.getInputs, [
    {
      familyId: "family-1",
      timelineEventId: "event-1",
      userId: "user-1",
      subject,
    },
  ]);
});

test("treats empty path identifiers as unavailable and rejects invalid subjects", async () => {
  const service = new TimelineApplicationService(
    new RecordingTimelineRepository(),
  );
  const validInput = {
    title: "Event",
    occurredAt: "2026-07-22T11:10:00.000Z",
  };

  assert.equal(
    await service.createTimelineEvent(
      " ",
      "user-1",
      {
        type: "CHILD",
        childId: "child-1",
      },
      validInput,
    ),
    null,
  );
  assert.equal(
    await service.createTimelineEvent(
      "family-1",
      "user-1",
      {
        type: "PREGNANCY",
        pregnancyId: "",
      },
      validInput,
    ),
    null,
  );
  await assert.rejects(
    () =>
      service.createTimelineEvent(
        "family-1",
        "user-1",
        {
          type: "PREGNANCY",
          pregnancyId: "pregnancy-1",
          childId: "child-1",
        } as never,
        validInput,
      ),
    /exactly one Pregnancy or Child/,
  );
  await assert.rejects(
    () =>
      service.createTimelineEvent(
        "family-1",
        "user-1",
        {
          type: "CHILD",
        } as never,
        validInput,
      ),
    /exactly one Pregnancy or Child/,
  );
});
