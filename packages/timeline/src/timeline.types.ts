export type PregnancyTimelineSubject = {
  type: "PREGNANCY";
  pregnancyId: string;
};

export type ChildTimelineSubject = {
  type: "CHILD";
  childId: string;
};

export type TimelineSubject = PregnancyTimelineSubject | ChildTimelineSubject;

type TimelineEventBase = {
  id: string;
  familyId: string;
  title: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type PregnancyTimelineEvent = TimelineEventBase & {
  pregnancyId: string;
};

export type ChildTimelineEvent = TimelineEventBase & {
  childId: string;
};

export type TimelineEvent = PregnancyTimelineEvent | ChildTimelineEvent;

export type CreateTimelineEventPersistenceInput = {
  familyId: string;
  userId: string;
  subject: TimelineSubject;
  title: string;
  occurredAt: Date;
};

export type FindTimelineEventsPersistenceInput = {
  familyId: string;
  userId: string;
  subject: TimelineSubject;
};

export type FindTimelineEventPersistenceInput =
  FindTimelineEventsPersistenceInput & {
    timelineEventId: string;
  };

export interface TimelineRepository {
  createTimelineEventForMember(
    input: CreateTimelineEventPersistenceInput,
  ): Promise<TimelineEvent | null>;
  findTimelineEventsForMember(
    input: FindTimelineEventsPersistenceInput,
  ): Promise<TimelineEvent[] | null>;
  findTimelineEventForMember(
    input: FindTimelineEventPersistenceInput,
  ): Promise<TimelineEvent | null>;
}
