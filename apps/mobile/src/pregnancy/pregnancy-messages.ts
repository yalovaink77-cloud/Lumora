import type { PregnancyValidationCode } from "./pregnancy.types";

export const PREGNANCY_NETWORK_ERROR_MESSAGE =
  "Unable to reach Lumora right now. Check your connection and try again.";

export const PREGNANCY_SERVER_ERROR_MESSAGE =
  "Unable to complete that request. Try again.";

export const PREGNANCY_FAMILY_NOT_FOUND_MESSAGE = "Family not found.";

export const PREGNANCY_NOT_FOUND_MESSAGE = "Pregnancy not found.";

export const PREGNANCY_MALFORMED_RESPONSE_MESSAGE =
  "Unable to read the Pregnancy response. Try again.";

export function messageForPregnancyValidationCode(
  code: PregnancyValidationCode,
): string {
  switch (code) {
    case "DISPLAY_NAME_REQUIRED":
      return "Enter a Pregnancy name.";
    case "DISPLAY_NAME_TOO_LONG":
      return "Pregnancy name must be at most 100 characters.";
    case "DISPLAY_NAME_INVALID":
    case "UNKNOWN_FIELD":
      return "Check the Pregnancy name and try again.";
  }
}
