import type { ChildValidationCode } from "./child.types";

export const CHILD_NETWORK_ERROR_MESSAGE =
  "Unable to reach Lumora right now. Check your connection and try again.";

export const CHILD_SERVER_ERROR_MESSAGE =
  "Unable to complete that request. Try again.";

export const CHILD_FAMILY_NOT_FOUND_MESSAGE = "Family not found.";

export const CHILD_NOT_FOUND_MESSAGE = "Child not found.";

export const CHILD_MALFORMED_RESPONSE_MESSAGE =
  "Unable to read the Child response. Try again.";

export function messageForChildValidationCode(
  code: ChildValidationCode,
): string {
  switch (code) {
    case "DISPLAY_NAME_REQUIRED":
      return "Enter a Child name.";
    case "DISPLAY_NAME_TOO_LONG":
      return "Child name must be at most 80 characters.";
    case "DISPLAY_NAME_INVALID":
    case "UNKNOWN_FIELD":
      return "Check the Child name and try again.";
  }
}
