import { useLocalSearchParams } from "expo-router";

import { usePregnancyStore } from "../../../../../../../src/pregnancy/PregnancyProvider";
import { TimelineDetailScreen } from "../../../../../../../src/timeline/TimelineDetailScreen";

export default function PregnancyTimelineDetailRoute() {
  const params = useLocalSearchParams<{
    familyId: string | string[];
    pregnancyId: string | string[];
    timelineEventId: string | string[];
  }>();
  const familyId = Array.isArray(params.familyId)
    ? params.familyId[0]
    : params.familyId;
  const pregnancyId = Array.isArray(params.pregnancyId)
    ? params.pregnancyId[0]
    : params.pregnancyId;
  const timelineEventId = Array.isArray(params.timelineEventId)
    ? params.timelineEventId[0]
    : params.timelineEventId;
  const pregnancy = usePregnancyStore();
  const subjectLabel =
    pregnancy.detail !== null && pregnancy.detail.id === pregnancyId
      ? pregnancy.detail.displayName
      : "this Pregnancy";

  return (
    <TimelineDetailScreen
      familyId={familyId}
      subjectId={pregnancyId}
      timelineEventId={timelineEventId}
      subjectType="pregnancy"
      subjectLabel={subjectLabel}
    />
  );
}
