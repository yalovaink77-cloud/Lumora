import type { Child } from "@lumora/child";

export type ChildResponse = {
  id: string;
  familyId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export function toChildResponse(child: Child): ChildResponse {
  return {
    id: child.id,
    familyId: child.familyId,
    displayName: child.displayName,
    createdAt: child.createdAt.toISOString(),
    updatedAt: child.updatedAt.toISOString(),
  };
}
