import { useLocalSearchParams } from "expo-router";

import { usePregnancyStore } from "../../../../../../../src/pregnancy/PregnancyProvider";
import { TimelineListScreen } from "../../../../../../../src/timeline/TimelineListScreen";

export default function PregnancyTimelineListRoute() {
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
  const pregnancy = usePregnancyStore();
  const subjectLabel =
    pregnancy.detail !== null && pregnancy.detail.id === pregnancyId
      ? pregnancy.detail.displayName
      : "this Pregnancy";

  return (
    <TimelineListScreen
      familyId={familyId}
      subjectId={pregnancyId}
      subjectType="pregnancy"
      subjectLabel={subjectLabel}
    />
  );
}
