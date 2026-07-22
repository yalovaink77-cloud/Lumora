import type {
  CreateTimelineEventPersistenceInput,
  FindTimelineEventPersistenceInput,
  FindTimelineEventsPersistenceInput,
  TimelineEvent,
  TimelineRepository,
} from "@lumora/timeline";

import { getPrismaClient } from "./prisma-client";

type TimelineEventRecord = {
  id: string;
  familyId: string;
  pregnancyId: string | null;
  childId: string | null;
  title: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function toTimelineEvent(record: TimelineEventRecord): TimelineEvent {
  const base = {
    id: record.id,
    familyId: record.familyId,
    title: record.title,
    occurredAt: record.occurredAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  if (record.pregnancyId !== null && record.childId === null) {
    return {
      ...base,
      pregnancyId: record.pregnancyId,
    };
  }

  if (record.childId !== null && record.pregnancyId === null) {
    return {
      ...base,
      childId: record.childId,
    };
  }

  throw new Error("Persisted Timeline subject invariant is invalid.");
}

const chronologicalOrder = [
  {
    occurredAt: "desc" as const,
  },
  {
    createdAt: "desc" as const,
  },
  {
    id: "desc" as const,
  },
];

export class PrismaTimelineRepository implements TimelineRepository {
  async createTimelineEventForMember(
    input: CreateTimelineEventPersistenceInput,
  ): Promise<TimelineEvent | null> {
    return getPrismaClient().$transaction(
      async (transaction) => {
        if (input.subject.type === "PREGNANCY") {
          const pregnancy = await transaction.pregnancy.findFirst({
            where: {
              id: input.subject.pregnancyId,
              familyId: input.familyId,
              family: {
                memberships: {
                  some: {
                    userId: input.userId,
                  },
                },
              },
            },
            select: {
              id: true,
            },
          });

          if (!pregnancy) {
            return null;
          }

          return toTimelineEvent(
            await transaction.timelineEvent.create({
              data: {
                familyId: input.familyId,
                pregnancyId: pregnancy.id,
                pregnancyFamilyId: input.familyId,
                title: input.title,
                occurredAt: input.occurredAt,
              },
            }),
          );
        }

        const child = await transaction.child.findFirst({
          where: {
            id: input.subject.childId,
            familyId: input.familyId,
            family: {
              memberships: {
                some: {
                  userId: input.userId,
                },
              },
            },
          },
          select: {
            id: true,
          },
        });

        if (!child) {
          return null;
        }

        return toTimelineEvent(
          await transaction.timelineEvent.create({
            data: {
              familyId: input.familyId,
              childId: child.id,
              childFamilyId: input.familyId,
              title: input.title,
              occurredAt: input.occurredAt,
            },
          }),
        );
      },
      {
        isolationLevel: "Serializable",
      },
    );
  }

  async findTimelineEventsForMember(
    input: FindTimelineEventsPersistenceInput,
  ): Promise<TimelineEvent[] | null> {
    if (input.subject.type === "PREGNANCY") {
      const pregnancy = await getPrismaClient().pregnancy.findFirst({
        where: {
          id: input.subject.pregnancyId,
          familyId: input.familyId,
          family: {
            memberships: {
              some: {
                userId: input.userId,
              },
            },
          },
        },
        select: {
          timelineEvents: {
            where: {
              familyId: input.familyId,
            },
            orderBy: chronologicalOrder,
          },
        },
      });

      return pregnancy ? pregnancy.timelineEvents.map(toTimelineEvent) : null;
    }

    const child = await getPrismaClient().child.findFirst({
      where: {
        id: input.subject.childId,
        familyId: input.familyId,
        family: {
          memberships: {
            some: {
              userId: input.userId,
            },
          },
        },
      },
      select: {
        timelineEvents: {
          where: {
            familyId: input.familyId,
          },
          orderBy: chronologicalOrder,
        },
      },
    });

    return child ? child.timelineEvents.map(toTimelineEvent) : null;
  }

  async findTimelineEventForMember(
    input: FindTimelineEventPersistenceInput,
  ): Promise<TimelineEvent | null> {
    const timelineEvent =
      input.subject.type === "PREGNANCY"
        ? await getPrismaClient().timelineEvent.findFirst({
            where: {
              id: input.timelineEventId,
              familyId: input.familyId,
              pregnancyId: input.subject.pregnancyId,
              pregnancyFamilyId: input.familyId,
              pregnancy: {
                family: {
                  memberships: {
                    some: {
                      userId: input.userId,
                    },
                  },
                },
              },
            },
          })
        : await getPrismaClient().timelineEvent.findFirst({
            where: {
              id: input.timelineEventId,
              familyId: input.familyId,
              childId: input.subject.childId,
              childFamilyId: input.familyId,
              child: {
                family: {
                  memberships: {
                    some: {
                      userId: input.userId,
                    },
                  },
                },
              },
            },
          });

    return timelineEvent ? toTimelineEvent(timelineEvent) : null;
  }
}
