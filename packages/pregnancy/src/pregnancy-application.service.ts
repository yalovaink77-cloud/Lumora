import type { Pregnancy, PregnancyRepository } from "./pregnancy.types";
import { parseCreatePregnancyInput } from "./pregnancy-validation";

function assertIdentifier(value: string, name: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${name} must not be empty.`);
  }
}

export class PregnancyApplicationService {
  constructor(private readonly repository: PregnancyRepository) {}

  async createPregnancy(
    familyId: string,
    userId: string,
    input: unknown,
  ): Promise<Pregnancy | null> {
    assertIdentifier(familyId, "familyId");
    assertIdentifier(userId, "userId");
    const parsedInput = parseCreatePregnancyInput(input);

    return this.repository.createPregnancyForMember({
      familyId,
      userId,
      displayName: parsedInput.displayName,
    });
  }

  async listPregnancies(
    familyId: string,
    userId: string,
  ): Promise<Pregnancy[] | null> {
    assertIdentifier(familyId, "familyId");
    assertIdentifier(userId, "userId");
    return this.repository.findPregnanciesForMember(familyId, userId);
  }

  async getPregnancy(
    familyId: string,
    pregnancyId: string,
    userId: string,
  ): Promise<Pregnancy | null> {
    assertIdentifier(familyId, "familyId");
    assertIdentifier(pregnancyId, "pregnancyId");
    assertIdentifier(userId, "userId");
    return this.repository.findPregnancyForMember(
      familyId,
      pregnancyId,
      userId,
    );
  }
}
