import { useLocalSearchParams } from "expo-router";

import { useChildStore } from "../../../../../../../src/child/ChildProvider";
import { TimelineDetailScreen } from "../../../../../../../src/timeline/TimelineDetailScreen";

export default function ChildTimelineDetailRoute() {
  const params = useLocalSearchParams<{
    familyId: string | string[];
    childId: string | string[];
    timelineEventId: string | string[];
  }>();
  const familyId = Array.isArray(params.familyId)
    ? params.familyId[0]
    : params.familyId;
  const childId = Array.isArray(params.childId)
    ? params.childId[0]
    : params.childId;
  const timelineEventId = Array.isArray(params.timelineEventId)
    ? params.timelineEventId[0]
    : params.timelineEventId;
  const child = useChildStore();
  const subjectLabel =
    child.detail !== null && child.detail.id === childId
      ? child.detail.displayName
      : "this Child";

  return (
    <TimelineDetailScreen
      familyId={familyId}
      subjectId={childId}
      timelineEventId={timelineEventId}
      subjectType="child"
      subjectLabel={subjectLabel}
    />
  );
}
