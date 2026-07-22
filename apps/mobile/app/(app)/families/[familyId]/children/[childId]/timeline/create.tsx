import { useLocalSearchParams } from "expo-router";

import { TimelineCreateScreen } from "../../../../../../../src/timeline/TimelineCreateScreen";

export default function ChildTimelineCreateRoute() {
  const params = useLocalSearchParams<{
    familyId: string | string[];
    childId: string | string[];
  }>();
  const familyId = Array.isArray(params.familyId)
    ? params.familyId[0]
    : params.familyId;
  const childId = Array.isArray(params.childId)
    ? params.childId[0]
    : params.childId;

  return (
    <TimelineCreateScreen
      familyId={familyId}
      subjectId={childId}
      subjectType="child"
    />
  );
}
