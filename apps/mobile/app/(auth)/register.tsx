import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
} from "react-native";

import { useAuthSession } from "../../src/auth/auth-session-context";
import { shellStyles } from "../../src/ui/shell-styles";

export default function RegisterScreen() {
  const session = useAuthSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await session.register({ name, email, password });
      if (!result.ok) {
        setError(result.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={shellStyles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={shellStyles.title} accessibilityRole="header">
        Create account
      </Text>
      <Text style={shellStyles.subtitle}>
        Register with email and password. Family features are not part of this
        shell.
      </Text>

      {error ? (
        <Text style={shellStyles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Text style={shellStyles.label} nativeID="register-name-label">
        Name
      </Text>
      <TextInput
        style={shellStyles.input}
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        accessibilityLabel="Name"
        accessibilityLabelledBy="register-name-label"
        editable={!submitting}
      />

      <Text style={shellStyles.label} nativeID="register-email-label">
        Email
      </Text>
      <TextInput
        style={shellStyles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        accessibilityLabel="Email"
        accessibilityLabelledBy="register-email-label"
        editable={!submitting}
      />

      <Text style={shellStyles.label} nativeID="register-password-label">
        Password
      </Text>
      <TextInput
        style={shellStyles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        accessibilityLabel="Password"
        accessibilityLabelledBy="register-password-label"
        editable={!submitting}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create account"
        accessibilityState={{ disabled: submitting, busy: submitting }}
        style={[
          shellStyles.primaryButton,
          submitting ? shellStyles.primaryButtonDisabled : null,
        ]}
        disabled={submitting}
        onPress={() => {
          void onSubmit();
        }}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={shellStyles.primaryButtonText}>Create account</Text>
        )}
      </Pressable>

      <Link href="/(auth)/sign-in" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Sign in instead"
          style={shellStyles.secondaryButton}
          disabled={submitting}
        >
          <Text style={shellStyles.secondaryButtonText}>
            Already have an account? Sign in
          </Text>
        </Pressable>
      </Link>
    </KeyboardAvoidingView>
  );
}
