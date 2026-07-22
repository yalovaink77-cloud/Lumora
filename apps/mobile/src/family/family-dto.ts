import type { MobileFamily } from "./family.types";

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

export function mapFamilyResponse(body: unknown): MobileFamily | null {
  if (!isRecord(body)) {
    return null;
  }

  if (
    typeof body.id !== "string" ||
    body.id.length === 0 ||
    typeof body.displayName !== "string" ||
    !isIsoTimestamp(body.createdAt) ||
    !isIsoTimestamp(body.updatedAt)
  ) {
    return null;
  }

  // Reject unexpected role/membership fields on list/detail shapes by ignoring
  // extras; require exact approved keys not to be absent.
  return {
    id: body.id,
    displayName: body.displayName,
    createdAt: body.createdAt,
    updatedAt: body.updatedAt,
  };
}

export function mapFamilyListResponse(body: unknown): MobileFamily[] | null {
  if (!isRecord(body) || !Array.isArray(body.families)) {
    return null;
  }

  const families: MobileFamily[] = [];
  for (const item of body.families) {
    const mapped = mapFamilyResponse(item);
    if (!mapped) {
      return null;
    }
    families.push(mapped);
  }

  return families;
}

/**
 * Maps create success JSON. Membership may be present but is never stored in
 * durable Family UI state; only the Family DTO is returned.
 */
export function mapCreatedFamilyResponse(body: unknown): MobileFamily | null {
  if (!isRecord(body)) {
    return null;
  }

  return mapFamilyResponse(body.family);
}

export function upsertFamilySorted(
  families: readonly MobileFamily[],
  family: MobileFamily,
): MobileFamily[] {
  const next = families.filter((item) => item.id !== family.id);
  next.push(family);
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

/** Conservative date display from ISO timestamps (YYYY-MM-DD). */
export function formatFamilyDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return iso;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}
