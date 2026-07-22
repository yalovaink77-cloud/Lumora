import type { Child, ChildRepository } from "./child.types";
import {
  parseCreateChildInput,
  parseUpdateChildDisplayNameInput,
} from "./child-validation";

function assertIdentifier(value: string, name: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${name} must not be empty.`);
  }
}

export class ChildApplicationService {
  constructor(private readonly repository: ChildRepository) {}

  async createChild(
    familyId: string,
    userId: string,
    input: unknown,
  ): Promise<Child | null> {
    assertIdentifier(familyId, "familyId");
    assertIdentifier(userId, "userId");
    const parsedInput = parseCreateChildInput(input);

    return this.repository.createChildForMember({
      familyId,
      userId,
      displayName: parsedInput.displayName,
    });
  }

  async listChildren(
    familyId: string,
    userId: string,
  ): Promise<Child[] | null> {
    assertIdentifier(familyId, "familyId");
    assertIdentifier(userId, "userId");
    return this.repository.findChildrenForMember(familyId, userId);
  }

  async getChild(
    familyId: string,
    childId: string,
    userId: string,
  ): Promise<Child | null> {
    assertIdentifier(familyId, "familyId");
    assertIdentifier(childId, "childId");
    assertIdentifier(userId, "userId");
    return this.repository.findChildForMember(familyId, childId, userId);
  }

  async updateChildDisplayName(
    familyId: string,
    childId: string,
    userId: string,
    input: unknown,
  ): Promise<Child | null> {
    assertIdentifier(familyId, "familyId");
    assertIdentifier(childId, "childId");
    assertIdentifier(userId, "userId");
    const parsedInput = parseUpdateChildDisplayNameInput(input);

    return this.repository.updateChildDisplayNameForMember({
      familyId,
      childId,
      userId,
      displayName: parsedInput.displayName,
    });
  }
}
