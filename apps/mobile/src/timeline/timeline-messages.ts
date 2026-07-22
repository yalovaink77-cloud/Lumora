import type { TimelineValidationCode } from "./timeline.types";

export const TIMELINE_NETWORK_ERROR_MESSAGE =
  "Unable to reach Lumora right now. Check your connection and try again.";

export const TIMELINE_SERVER_ERROR_MESSAGE =
  "Unable to complete that request. Try again.";

export const TIMELINE_NOT_FOUND_MESSAGE = "Timeline resource not found.";

export const TIMELINE_MALFORMED_RESPONSE_MESSAGE =
  "Unable to read the Timeline response. Try again.";

export function messageForTimelineValidationCode(
  code: TimelineValidationCode,
): string {
  switch (code) {
    case "TITLE_REQUIRED":
      return "Enter a Timeline title.";
    case "TITLE_TOO_LONG":
      return "Timeline title must be at most 80 characters.";
    case "TITLE_INVALID":
    case "UNKNOWN_FIELD":
      return "Check the Timeline title and try again.";
    case "OCCURRED_AT_REQUIRED":
    case "OCCURRED_AT_INVALID":
      return "Choose a valid date and time.";
    case "OCCURRED_AT_UNCONFIRMED":
      return "Confirm the date and time before saving.";
  }
}
