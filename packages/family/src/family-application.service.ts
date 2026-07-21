import {
  FAMILY_OWNER_ROLE,
  type CreatedFamily,
  type Family,
  type FamilyRepository,
} from "./family.types";
import { parseCreateFamilyInput } from "./family-validation";

function assertIdentifier(value: string, name: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${name} must not be empty.`);
  }
}

export class FamilyApplicationService {
  constructor(private readonly repository: FamilyRepository) {}

  async createFamily(userId: string, input: unknown): Promise<CreatedFamily> {
    assertIdentifier(userId, "userId");
    const parsedInput = parseCreateFamilyInput(input);

    return this.repository.createFamilyWithMembership({
      displayName: parsedInput.displayName,
      role: FAMILY_OWNER_ROLE,
      userId,
    });
  }

  async listFamilies(userId: string): Promise<Family[]> {
    assertIdentifier(userId, "userId");
    return this.repository.findFamiliesForUser(userId);
  }

  async getFamily(familyId: string, userId: string): Promise<Family | null> {
    assertIdentifier(familyId, "familyId");
    assertIdentifier(userId, "userId");
    return this.repository.findFamilyForUser(familyId, userId);
  }
}
