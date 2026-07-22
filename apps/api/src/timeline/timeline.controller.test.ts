import assert from "node:assert/strict";
import { test } from "node:test";

import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  type TimelineApplicationService,
  TimelineValidationError,
} from "@lumora/timeline";

import type { AuthenticatedPrincipal } from "../auth/auth.types";
import {
  ChildTimelineController,
  PregnancyTimelineController,
} from "./timeline.controller";

const principal: AuthenticatedPrincipal = {
  id: "authenticated-user",
  email: "user@example.test",
  emailVerified: false,
  name: "Test User",
};

const occurredAt = new Date("2026-07-22T11:10:00.123Z");
const now = new Date("2026-07-22T12:00:00.000Z");

test("composes Pregnancy create from path and neutral principal", async () => {
  let receivedArguments: unknown[] = [];
  const service = {
    createTimelineEvent: async (...args: unknown[]) => {
      receivedArguments = args;
      return {
        id: "event-1",
        familyId: "family-1",
        pregnancyId: "pregnancy-1",
        title: "First movement",
        occurredAt,
        createdAt: now,
        updatedAt: now,
      };
    },
  } as unknown as TimelineApplicationService;
  const controller = new PregnancyTimelineController(service);

  const response = await controller.createTimelineEvent(
    "family-1",
    "pregnancy-1",
    {
      title: "First movement",
      occurredAt: "2026-07-22T11:10:00.123Z",
    },
    {},
    principal,
  );

  assert.deepEqual(receivedArguments, [
    "family-1",
    "authenticated-user",
    {
      type: "PREGNANCY",
      pregnancyId: "pregnancy-1",
    },
    {
      title: "First movement",
      occurredAt: "2026-07-22T11:10:00.123Z",
    },
    {},
  ]);
  assert.deepEqual(response, {
    id: "event-1",
    familyId: "family-1",
    pregnancyId: "pregnancy-1",
    title: "First movement",
    occurredAt: "2026-07-22T11:10:00.123Z",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
  assert.deepEqual(Object.keys(response), [
    "id",
    "familyId",
    "pregnancyId",
    "title",
    "occurredAt",
    "createdAt",
    "updatedAt",
  ]);
});

test("composes Child list and get with subject-specific responses", async () => {
  const event = {
    id: "event-1",
    familyId: "family-1",
    childId: "child-1",
    title: "First step",
    occurredAt,
    createdAt: now,
    updatedAt: now,
  };
  const service = {
    listTimelineEvents: async () => [event],
    getTimelineEvent: async () => event,
  } as unknown as TimelineApplicationService;
  const controller = new ChildTimelineController(service);

  const list = await controller.listTimelineEvents(
    "family-1",
    "child-1",
    undefined,
    {},
    principal,
  );
  const direct = await controller.getTimelineEvent(
    "family-1",
    "child-1",
    "event-1",
    undefined,
    {},
    principal,
  );
  const expected = {
    id: "event-1",
    familyId: "family-1",
    childId: "child-1",
    title: "First step",
    occurredAt: "2026-07-22T11:10:00.123Z",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  assert.deepEqual(list, {
    timelineEvents: [expected],
  });
  assert.deepEqual(direct, expected);
  assert.doesNotMatch(JSON.stringify(expected), /pregnancyId|subjectType/);
});

test("maps every unavailable Family, subject, and event to one 404", async () => {
  const service = {
    createTimelineEvent: async () => null,
    listTimelineEvents: async () => null,
    getTimelineEvent: async () => null,
  } as unknown as TimelineApplicationService;
  const pregnancyController = new PregnancyTimelineController(service);
  const childController = new ChildTimelineController(service);
  const expected = {
    statusCode: 404,
    code: "TIMELINE_NOT_FOUND",
    message: "Timeline resource not found.",
  };
  const operations = [
    () =>
      pregnancyController.createTimelineEvent(
        "family",
        "pregnancy",
        {
          title: "Event",
          occurredAt: "2026-07-22T11:10:00.000Z",
        },
        {},
        principal,
      ),
    () =>
      pregnancyController.listTimelineEvents(
        "family",
        "pregnancy",
        undefined,
        {},
        principal,
      ),
    () =>
      pregnancyController.getTimelineEvent(
        "family",
        "pregnancy",
        "event",
        undefined,
        {},
        principal,
      ),
    () =>
      childController.createTimelineEvent(
        "family",
        "child",
        {
          title: "Event",
          occurredAt: "2026-07-22T11:10:00.000Z",
        },
        {},
        principal,
      ),
    () =>
      childController.listTimelineEvents(
        "family",
        "child",
        undefined,
        {},
        principal,
      ),
    () =>
      childController.getTimelineEvent(
        "family",
        "child",
        "event",
        undefined,
        {},
        principal,
      ),
  ];

  for (const operation of operations) {
    await assert.rejects(operation, (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual(error.getResponse(), expected);
      return true;
    });
  }
});

test("maps request validation safely without echoing Timeline content", async () => {
  const privateTitle = "Private medical-looking statement";
  const service = {
    createTimelineEvent: async () => {
      throw new TimelineValidationError("UNKNOWN_FIELD");
    },
    listTimelineEvents: async () => {
      throw new TimelineValidationError("UNKNOWN_QUERY_PARAMETER");
    },
  } as unknown as TimelineApplicationService;
  const controller = new ChildTimelineController(service);

  await assert.rejects(
    () =>
      controller.createTimelineEvent(
        "family-1",
        "child-1",
        {
          title: privateTitle,
          occurredAt: "2026-07-22T11:10:00.000Z",
          medicalClassification: "private",
        },
        {},
        principal,
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.deepEqual(error.getResponse(), {
        statusCode: 400,
        code: "UNKNOWN_FIELD",
        message: "Invalid Timeline event request.",
      });
      assert.ok(!JSON.stringify(error.getResponse()).includes(privateTitle));
      return true;
    },
  );

  await assert.rejects(
    () =>
      controller.listTimelineEvents(
        "family-1",
        "child-1",
        undefined,
        {
          page: "1",
        },
        principal,
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(
        (error.getResponse() as { code?: string }).code,
        "UNKNOWN_QUERY_PARAMETER",
      );
      return true;
    },
  );
});
