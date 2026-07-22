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

export default function SignInScreen() {
  const session = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await session.signIn({ email, password });
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
        Sign in
      </Text>
      <Text style={shellStyles.subtitle}>
        Use your Lumora account email and password.
      </Text>

      {error ? (
        <Text style={shellStyles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Text style={shellStyles.label} nativeID="sign-in-email-label">
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
        accessibilityLabelledBy="sign-in-email-label"
        editable={!submitting}
      />

      <Text style={shellStyles.label} nativeID="sign-in-password-label">
        Password
      </Text>
      <TextInput
        style={shellStyles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        accessibilityLabel="Password"
        accessibilityLabelledBy="sign-in-password-label"
        editable={!submitting}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign in"
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
          <Text style={shellStyles.primaryButtonText}>Sign in</Text>
        )}
      </Pressable>

      <Link href="/(auth)/register" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Create an account"
          style={shellStyles.secondaryButton}
          disabled={submitting}
        >
          <Text style={shellStyles.secondaryButtonText}>Create an account</Text>
        </Pressable>
      </Link>
    </KeyboardAvoidingView>
  );
}
