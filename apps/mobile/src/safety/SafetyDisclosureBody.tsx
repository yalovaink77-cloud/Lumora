import {
  LUMORA_MVP_SAFETY_CONTENT,
  LUMORA_MVP_SAFETY_CONTENT_ID,
} from "@lumora/shared";
import { Text, View } from "react-native";

import { shellStyles } from "../ui/shell-styles";

type SafetyDisclosureBodyProps = {
  /** When true, include the Safety & Limitations heading. */
  showHeading?: boolean;
};

/**
 * Shared presentation of the ADR-019 canonical safety copy.
 * Does not track views, persist acknowledgment, or load Family data.
 */
export function SafetyDisclosureBody({
  showHeading = true,
}: SafetyDisclosureBodyProps) {
  return (
    <View>
      {showHeading ? (
        <Text
          style={shellStyles.title}
          accessibilityRole="header"
          accessibilityLabel="Safety and Limitations"
        >
          Safety & Limitations
        </Text>
      ) : null}

      <Text
        style={shellStyles.contentId}
        accessibilityLabel={`Content identifier ${LUMORA_MVP_SAFETY_CONTENT_ID}`}
      >
        {LUMORA_MVP_SAFETY_CONTENT.id}
      </Text>

      <Text
        style={shellStyles.disclosureText}
        accessibilityRole="text"
        accessibilityLabel="Medical safety and AI limitations disclosure"
      >
        {LUMORA_MVP_SAFETY_CONTENT.text}
      </Text>
    </View>
  );
}
