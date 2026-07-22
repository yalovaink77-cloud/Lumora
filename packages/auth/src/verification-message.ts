import {
  VERIFICATION_EMAIL_TEMPLATE_ID,
  type VerificationEmailDeliveryInput,
} from "./verification-delivery.js";

export const EMAIL_VERIFICATION_EXPIRES_IN_SECONDS = 900;

export function buildVerificationConfirmationUrl(
  confirmationPageUrl: string,
  token: string,
): string {
  return `${confirmationPageUrl}#token=${encodeURIComponent(token)}`;
}

export function composeVerificationEmailDeliveryInput(input: {
  recipient: string;
  confirmationPageUrl: string;
  token: string;
}): VerificationEmailDeliveryInput {
  return {
    recipient: input.recipient,
    confirmationUrl: buildVerificationConfirmationUrl(
      input.confirmationPageUrl,
      input.token,
    ),
    expiresInSeconds: EMAIL_VERIFICATION_EXPIRES_IN_SECONDS,
    templateId: VERIFICATION_EMAIL_TEMPLATE_ID,
  };
}
