import type { Pregnancy } from "@lumora/pregnancy";

export type PregnancyResponse = {
  id: string;
  familyId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export function toPregnancyResponse(pregnancy: Pregnancy): PregnancyResponse {
  return {
    id: pregnancy.id,
    familyId: pregnancy.familyId,
    displayName: pregnancy.displayName,
    createdAt: pregnancy.createdAt.toISOString(),
    updatedAt: pregnancy.updatedAt.toISOString(),
  };
}
