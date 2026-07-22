import type { MobileChild } from "./child.types";

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

export function mapChildResponse(
  body: unknown,
  expectedFamilyId: string,
): MobileChild | null {
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

export function mapChildListResponse(
  body: unknown,
  expectedFamilyId: string,
): MobileChild[] | null {
  if (!isRecord(body) || !Array.isArray(body.children)) {
    return null;
  }

  const children: MobileChild[] = [];
  for (const item of body.children) {
    const mapped = mapChildResponse(item, expectedFamilyId);
    if (!mapped) {
      return null;
    }
    children.push(mapped);
  }

  return children;
}

export function upsertChildSorted(
  children: readonly MobileChild[],
  child: MobileChild,
): MobileChild[] {
  const next = children.filter((item) => item.id !== child.id);
  next.push(child);
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

/** Conservative date display from ISO timestamps (YYYY-MM-DD). Not a birth date. */
export function formatChildDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return iso;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}
