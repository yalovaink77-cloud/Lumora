export const VERIFICATION_EMAIL_TEMPLATE_ID = "lumora-email-verification-v1";

export type VerificationEmailDeliveryInput = Readonly<{
  recipient: string;
  confirmationUrl: string;
  expiresInSeconds: number;
  templateId: typeof VERIFICATION_EMAIL_TEMPLATE_ID;
}>;

export interface VerificationEmailDeliveryPort {
  deliver(input: VerificationEmailDeliveryInput): Promise<void>;
}

/**
 * Delivery adapters may use this error only for failures specific to one
 * recipient. The auth callback suppresses it to preserve non-enumeration.
 */
export class RecipientVerificationEmailDeliveryError extends Error {
  override readonly name = "RecipientVerificationEmailDeliveryError";

  constructor(options?: ErrorOptions) {
    super("Verification email delivery was unavailable.", options);
  }
}

export class InMemoryVerificationEmailCaptureAdapter implements VerificationEmailDeliveryPort {
  readonly #messages: VerificationEmailDeliveryInput[] = [];

  async deliver(input: VerificationEmailDeliveryInput): Promise<void> {
    this.#messages.push(Object.freeze({ ...input }));
  }

  get messages(): readonly VerificationEmailDeliveryInput[] {
    return this.#messages.map((message) => ({ ...message }));
  }

  clear(): void {
    this.#messages.length = 0;
  }
}
