export class InvalidEmailVerificationRequestError extends Error {
  override readonly name = "InvalidEmailVerificationRequestError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function assertEmptyEmailVerificationRequestBody(body: unknown): void {
  if (body === undefined) {
    return;
  }

  if (!isRecord(body) || Object.keys(body).length !== 0) {
    throw new InvalidEmailVerificationRequestError();
  }
}

export function parseEmailVerificationConfirmationBody(body: unknown): {
  token: string;
} {
  if (!isRecord(body)) {
    throw new InvalidEmailVerificationRequestError();
  }

  const keys = Object.keys(body);

  if (
    keys.length !== 1 ||
    keys[0] !== "token" ||
    typeof body.token !== "string" ||
    body.token.length === 0
  ) {
    throw new InvalidEmailVerificationRequestError();
  }

  return { token: body.token };
}
