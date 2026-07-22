import { canonicalizeEmail } from "./canonical-email.js";
import {
  InvalidEmailVerificationTokenError,
  prevalidateEmailVerificationToken,
} from "./verification-token.js";

export type EmailVerificationPrincipal = Readonly<{
  email: string;
  emailVerified: boolean;
}>;

export type EmailVerificationAuthApi = Readonly<{
  api: {
    sendVerificationEmail(input: { body: { email: string } }): Promise<unknown>;
    verifyEmail(input: { query: { token: string } }): Promise<unknown>;
  };
}>;

export async function issueAuthenticatedSelfVerification(input: {
  auth: EmailVerificationAuthApi;
  principal: EmailVerificationPrincipal;
}): Promise<{ status: "accepted" }> {
  if (!input.principal.emailVerified) {
    try {
      await input.auth.api.sendVerificationEmail({
        body: { email: canonicalizeEmail(input.principal.email) },
      });
    } catch {
      // The authenticated response is deliberately independent of delivery.
    }
  }

  return { status: "accepted" };
}

export async function confirmAuthenticatedEmailVerification(input: {
  auth: EmailVerificationAuthApi;
  principal: EmailVerificationPrincipal;
  token: string;
  secret: string;
}): Promise<{ status: "verified" }> {
  try {
    const tokenSubject = await prevalidateEmailVerificationToken(
      input.token,
      input.secret,
    );
    const principalEmail = canonicalizeEmail(input.principal.email);

    if (tokenSubject.canonicalEmail !== principalEmail) {
      throw new InvalidEmailVerificationTokenError();
    }

    await input.auth.api.verifyEmail({
      query: { token: input.token },
    });

    return { status: "verified" };
  } catch {
    throw new InvalidEmailVerificationTokenError();
  }
}
