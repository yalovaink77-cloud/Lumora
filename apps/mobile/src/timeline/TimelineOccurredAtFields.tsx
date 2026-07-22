import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { shellStyles } from "../ui/shell-styles";
import {
  applyOccurredAtPickerChange,
  confirmOccurredAtSelection,
  createInitialOccurredAtSelection,
  formatTimelineOccurredAt,
  serializeOccurredAtUtc,
  type OccurredAtSelectionState,
} from "./timeline-occurred-at";

export type TimelineOccurredAtFieldsProps = {
  value: OccurredAtSelectionState;
  onChange: (next: OccurredAtSelectionState) => void;
  disabled?: boolean;
};

/**
 * Native date/time selection with explicit confirmation (ADR-024).
 * Prefills device-local "now"; untouched default cannot submit until confirmed.
 * Android dialog dismissal does not confirm. iOS requires Confirm after edits.
 */
export function TimelineOccurredAtFields({
  value,
  onChange,
  disabled = false,
}: TimelineOccurredAtFieldsProps) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);

  function onPickerEvent(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setMode(null);
    }

    const dismissed = event.type === "dismissed";
    if (dismissed || !selected) {
      onChange(applyOccurredAtPickerChange(value, value.selected, true));
      return;
    }

    onChange(applyOccurredAtPickerChange(value, selected, false));
    if (Platform.OS === "ios") {
      // Keep picker open until user closes mode; confirmation is separate.
    }
  }

  const preview = formatTimelineOccurredAt(
    serializeOccurredAtUtc(value.selected),
  );

  return (
    <View>
      <Text style={shellStyles.label} nativeID="timeline-occurred-at-label">
        When it occurred
      </Text>
      <Text
        style={shellStyles.bodyText}
        accessibilityLabel={`Selected time ${preview}${
          value.confirmed ? ", confirmed" : ", not confirmed"
        }`}
      >
        {preview}
        {value.confirmed ? " (confirmed)" : " (not confirmed)"}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose date"
        accessibilityLabelledBy="timeline-occurred-at-label"
        style={shellStyles.secondaryButton}
        disabled={disabled}
        onPress={() => {
          setMode("date");
        }}
      >
        <Text style={shellStyles.secondaryButtonText}>Choose date</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose time"
        style={shellStyles.secondaryButton}
        disabled={disabled}
        onPress={() => {
          setMode("time");
        }}
      >
        <Text style={shellStyles.secondaryButtonText}>Choose time</Text>
      </Pressable>

      {mode ? (
        <DateTimePicker
          value={value.selected}
          mode={mode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onPickerEvent}
          accessibilityLabel={mode === "date" ? "Date picker" : "Time picker"}
        />
      ) : null}

      {Platform.OS === "ios" && mode ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close date time picker"
          style={shellStyles.secondaryButton}
          onPress={() => {
            setMode(null);
          }}
        >
          <Text style={shellStyles.secondaryButtonText}>Done editing</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Confirm selected date and time"
        style={shellStyles.primaryButton}
        disabled={disabled}
        onPress={() => {
          setMode(null);
          onChange(confirmOccurredAtSelection(value));
        }}
      >
        <Text style={shellStyles.primaryButtonText}>Confirm date and time</Text>
      </Pressable>
    </View>
  );
}

export { createInitialOccurredAtSelection };
