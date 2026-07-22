import type { FamilyValidationCode } from "./family.types";

export const FAMILY_NETWORK_ERROR_MESSAGE =
  "Unable to reach Lumora right now. Check your connection and try again.";

export const FAMILY_SERVER_ERROR_MESSAGE =
  "Unable to complete that request. Try again.";

export const FAMILY_NOT_FOUND_MESSAGE = "Family not found.";

export const FAMILY_MALFORMED_RESPONSE_MESSAGE =
  "Unable to read the Family response. Try again.";

export function messageForFamilyValidationCode(
  code: FamilyValidationCode,
): string {
  switch (code) {
    case "DISPLAY_NAME_REQUIRED":
      return "Enter a Family name.";
    case "DISPLAY_NAME_TOO_LONG":
      return "Family name must be at most 100 characters.";
    case "DISPLAY_NAME_INVALID":
    case "UNKNOWN_FIELD":
      return "Check the Family name and try again.";
  }
}
