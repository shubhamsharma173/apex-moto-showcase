import React from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  TextStyle,
  ViewStyle,
  StyleProp,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors as c, fonts as f } from "../theme";
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function Icon({
  name,
  size = 20,
  color = c.muted,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} accessible={false} />;
}
export function Txt({
  children,
  style,
  variant = "body",
  color,
  ...props
}: React.ComponentProps<typeof Text> & {
  variant?: "body" | "label" | "title" | "heading" | "small" | "metric";
  color?: string;
}) {
  return (
    <Text
      {...props}
      style={[
        styles.text,
        textStyles[variant],
        color ? { color } : undefined,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
const textStyles: Record<string, TextStyle> = {
  body: { fontSize: 15, lineHeight: 23 },
  small: { fontSize: 12, lineHeight: 18 },
  label: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.5,
    fontFamily: f.bold,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontFamily: f.displayBold,
    letterSpacing: -1,
  },
  heading: {
    fontSize: 19,
    lineHeight: 27,
    fontFamily: f.display,
    letterSpacing: -0.4,
  },
  metric: {
    fontSize: 34,
    lineHeight: 43,
    fontFamily: f.display,
    letterSpacing: -1.4,
    fontVariant: ["tabular-nums"],
  },
};
export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  icon,
  kind = "primary",
  small = false,
  disabled = false,
  loading = false,
  style,
  testID,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const foreground =
    kind === "primary" ? c.ink : kind === "danger" ? c.red : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      testID={testID}
      onPress={onPress}
      style={({ pressed, focused }: any) => [
        styles.button,
        {
          backgroundColor:
            kind === "primary"
              ? c.lime
              : kind === "secondary"
                ? c.raised
                : kind === "danger"
                  ? "#3D2424"
                  : "transparent",
          minHeight: 48,
          paddingHorizontal: small ? 14 : 20,
          borderColor: focused
            ? c.lime
            : kind === "secondary"
              ? c.line
              : "transparent",
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : icon ? (
        <Icon name={icon} size={small ? 17 : 19} color={foreground} />
      ) : null}
      <Txt
        style={{
          fontFamily: f.bold,
          fontSize: small ? 13 : 14,
          flexShrink: 1,
          textAlign: "center",
        }}
        color={foreground}
      >
        {title}
      </Txt>
    </Pressable>
  );
}
export function IconButton({
  icon,
  label,
  onPress,
  active = false,
  style,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled, selected: active }}
      onPress={onPress}
      style={({ pressed, focused }: any) => [
        styles.iconButton,
        {
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
          backgroundColor: active ? c.limeDim : c.surface,
          borderColor: focused ? c.lime : c.line,
        },
        style,
      ]}
    >
      <Icon name={icon} color={active ? c.lime : c.text} />
    </Pressable>
  );
}
export function Tag({
  children,
  icon,
  color = c.muted,
}: {
  children: React.ReactNode;
  icon?: IconName;
  color?: string;
}) {
  return (
    <Row style={styles.tag}>
      {icon && <Icon name={icon} size={13} color={color} />}
      <Txt
        variant="small"
        color={color}
        style={{ fontFamily: f.medium, fontSize: 11 }}
      >
        {children}
      </Txt>
    </Row>
  );
}
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.limeDim : c.surface,
          borderColor: selected ? c.lime : c.line,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Txt
        style={{ fontSize: 13, fontFamily: f.medium }}
        color={selected ? c.lime : c.muted}
      >
        {label}
      </Txt>
    </Pressable>
  );
}
export function SectionTitle({
  title,
  action,
  onPress,
  eyebrow,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
  eyebrow?: string;
}) {
  return (
    <Row
      style={{
        justifyContent: "space-between",
        marginBottom: 16,
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <View>
        {eyebrow && (
          <Txt variant="label" color={c.faint} style={{ marginBottom: 4 }}>
            {eyebrow}
          </Txt>
        )}
        <Txt variant="heading">{title}</Txt>
      </View>
      {action && onPress && (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={action}
          style={({ pressed }) => ({
            minHeight: 48,
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Row style={{ gap: 5 }}>
            <Txt variant="small" color={c.lime}>
              {action}
            </Txt>
            <Icon name="arrow-forward" size={14} color={c.lime} />
          </Row>
        </Pressable>
      )}
    </Row>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 8, marginBottom: 18 }}>
      <Txt variant="small" color={c.muted}>
        {label}
      </Txt>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.faint}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[
          styles.input,
          multiline && { minHeight: 96, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
export function Empty({
  icon,
  title,
  body,
  action,
  onPress,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <Card style={{ padding: 32, alignItems: "center", gap: 14 }}>
      <View
        style={{ padding: 18, borderRadius: 50, backgroundColor: c.limeDim }}
      >
        <Icon name={icon} size={30} color={c.lime} />
      </View>
      <Txt variant="heading">{title}</Txt>
      <Txt color={c.muted} style={{ textAlign: "center", maxWidth: 380 }}>
        {body}
      </Txt>
      {action && onPress && <Button title={action} onPress={onPress} />}
    </Card>
  );
}
const styles = StyleSheet.create({
  text: { color: c.text, fontFamily: f.regular },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 20,
    overflow: "hidden",
  },
  button: {
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderWidth: 1,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
  },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: "#FFFFFF08",
    alignSelf: "flex-start",
    gap: 5,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 48,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  input: {
    minHeight: 52,
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    color: c.text,
    backgroundColor: c.bg,
    fontFamily: f.regular,
    fontSize: 15,
  },
});
