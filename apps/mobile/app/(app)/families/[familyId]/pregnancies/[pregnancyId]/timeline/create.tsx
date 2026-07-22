import { useLocalSearchParams } from "expo-router";

import { TimelineCreateScreen } from "../../../../../../../src/timeline/TimelineCreateScreen";

export default function PregnancyTimelineCreateRoute() {
  const params = useLocalSearchParams<{
    familyId: string | string[];
    pregnancyId: string | string[];
  }>();
  const familyId = Array.isArray(params.familyId)
    ? params.familyId[0]
    : params.familyId;
  const pregnancyId = Array.isArray(params.pregnancyId)
    ? params.pregnancyId[0]
    : params.pregnancyId;

  return (
    <TimelineCreateScreen
      familyId={familyId}
      subjectId={pregnancyId}
      subjectType="pregnancy"
    />
  );
}
