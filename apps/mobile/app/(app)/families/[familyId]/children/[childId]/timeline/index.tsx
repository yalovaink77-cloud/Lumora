import { useLocalSearchParams } from "expo-router";

import { useChildStore } from "../../../../../../../src/child/ChildProvider";
import { TimelineListScreen } from "../../../../../../../src/timeline/TimelineListScreen";

export default function ChildTimelineListRoute() {
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
  const child = useChildStore();
  const subjectLabel =
    child.detail !== null && child.detail.id === childId
      ? child.detail.displayName
      : "this Child";

  return (
    <TimelineListScreen
      familyId={familyId}
      subjectId={childId}
      subjectType="child"
      subjectLabel={subjectLabel}
    />
  );
}
