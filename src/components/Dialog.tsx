import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, Row, Txt } from "./ui";
import { colors as c, fonts as f } from "../theme";

export function Dialog({
  visible,
  title,
  onClose,
  children,
  subtitle,
  busy = false,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  subtitle?: string;
  busy?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[
          s.backdrop,
          {
            paddingTop: Math.max(16, insets.top),
            paddingBottom: Math.max(16, insets.bottom),
          },
        ]}
      >
        <View
          accessibilityViewIsModal
          accessibilityLabel={title}
          style={s.dialog}
        >
          <Row style={s.header}>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt accessibilityRole="header" variant="heading">
                {title}
              </Txt>
              {subtitle && (
                <Txt color={c.muted} variant="small">
                  {subtitle}
                </Txt>
              )}
            </View>
            <IconButton
              icon="close"
              label={`Close ${title}`}
              onPress={close}
              disabled={busy}
            />
          </Row>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function FormField({
  label,
  value,
  onChangeText,
  error,
  hint,
  numeric = false,
  placeholder,
  maxLength = 120,
  autoFocus = false,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  hint?: string;
  numeric?: boolean;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  editable?: boolean;
}) {
  return (
    <View style={{ gap: 7, marginBottom: 18 }}>
      <Txt variant="small" color={c.muted}>
        {label}
      </Txt>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error || hint}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? "decimal-pad" : "default"}
        placeholder={placeholder}
        placeholderTextColor={c.faint}
        maxLength={maxLength}
        autoFocus={autoFocus}
        editable={editable}
        style={[s.input, error ? { borderColor: c.red } : undefined]}
      />
      {error ? (
        <Txt accessibilityRole="alert" variant="small" color={c.red}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="small" color={c.faint}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#000000B8",
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  dialog: {
    width: "100%",
    maxWidth: 600,
    maxHeight: "100%",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 22,
    overflow: "hidden",
  },
  header: { padding: 20, borderBottomWidth: 1, borderColor: c.line, gap: 16 },
  content: { padding: 22, paddingBottom: 28 },
  input: {
    minHeight: 52,
    color: c.text,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 12,
    padding: 14,
    fontFamily: f.regular,
    fontSize: 16,
  },
});
