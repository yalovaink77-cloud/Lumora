import type { MobilePregnancy } from "./pregnancy.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

export function mapPregnancyResponse(
  body: unknown,
  expectedFamilyId: string,
): MobilePregnancy | null {
  if (!isRecord(body)) {
    return null;
  }

  if (
    typeof body.id !== "string" ||
    body.id.length === 0 ||
    typeof body.familyId !== "string" ||
    body.familyId.length === 0 ||
    typeof body.displayName !== "string" ||
    !isIsoTimestamp(body.createdAt) ||
    !isIsoTimestamp(body.updatedAt)
  ) {
    return null;
  }

  if (body.familyId !== expectedFamilyId) {
    return null;
  }

  return {
    id: body.id,
    familyId: body.familyId,
    displayName: body.displayName,
    createdAt: body.createdAt,
    updatedAt: body.updatedAt,
  };
}

export function mapPregnancyListResponse(
  body: unknown,
  expectedFamilyId: string,
): MobilePregnancy[] | null {
  if (!isRecord(body) || !Array.isArray(body.pregnancies)) {
    return null;
  }

  const pregnancies: MobilePregnancy[] = [];
  for (const item of body.pregnancies) {
    const mapped = mapPregnancyResponse(item, expectedFamilyId);
    if (!mapped) {
      return null;
    }
    pregnancies.push(mapped);
  }

  return pregnancies;
}

export function upsertPregnancySorted(
  pregnancies: readonly MobilePregnancy[],
  pregnancy: MobilePregnancy,
): MobilePregnancy[] {
  const next = pregnancies.filter((item) => item.id !== pregnancy.id);
  next.push(pregnancy);
  next.sort((left, right) => {
    if (left.createdAt < right.createdAt) {
      return -1;
    }
    if (left.createdAt > right.createdAt) {
      return 1;
    }
    if (left.id < right.id) {
      return -1;
    }
    if (left.id > right.id) {
      return 1;
    }
    return 0;
  });
  return next;
}

/** Conservative date display from ISO timestamps (YYYY-MM-DD). Not medical. */
export function formatPregnancyDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return iso;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}
