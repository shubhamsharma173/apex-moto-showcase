import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import * as Application from "expo-application";
import { Page, PageHeading } from "../components/Shell";
import {
  Button,
  Card,
  Icon,
  Row,
  SectionTitle,
  Tag,
  Txt,
} from "../components/ui";
import { Dialog, FormField } from "../components/Dialog";
import { useApp, Preferences } from "../state/AppContext";
import { deleteRide } from "../services/storage";
import { colors as c, fonts as f, formatDistance } from "../theme";

export default function SettingsScreen() {
  const { prefs, realRides, updatePrefs, refreshRides, notify } = useApp();
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 1100;
  const [pending, setPending] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"profile" | "delete" | null>(null);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [originalGoal, setOriginalGoal] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function change(
    key: string,
    values: Partial<Preferences>,
    message?: string,
  ) {
    if (pending) return;
    setPending(key);
    try {
      await updatePrefs(values);
      if (message) notify(message);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Your setting could not be saved. Please try again.",
      );
    } finally {
      setPending(null);
    }
  }
  function editProfile() {
    const value = String(
      Math.round(
        prefs.weeklyGoalKm * (prefs.units === "mi" ? 0.621371 : 1) * 10,
      ) / 10,
    );
    setName(prefs.name);
    setGoal(value);
    setOriginalGoal(value);
    setErrors({});
    setDialog("profile");
  }
  async function saveProfile() {
    if (pending) return;
    const nextErrors: Record<string, string> = {};
    const goalKm =
      goal === originalGoal
        ? prefs.weeklyGoalKm
        : Number(goal) / (prefs.units === "mi" ? 0.621371 : 1);
    if (!name.trim())
      nextErrors.name =
        "Add the name you would like to see in your personal space.";
    if (
      !/^\d+(?:\.\d{1,2})?$/.test(goal.trim()) ||
      !Number.isFinite(goalKm) ||
      goalKm < 1 ||
      goalKm > 10_000
    )
      nextErrors.goal = `Choose a weekly goal from ${prefs.units === "mi" ? "1 to 6,213" : "1 to 10,000"} ${prefs.units}.`;
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setPending("profile");
    try {
      await updatePrefs({ name: name.trim(), weeklyGoalKm: goalKm });
      setDialog(null);
      notify("Your personal space is updated.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not save your preferences.";
      setErrors({ general: message });
      notify(message);
    } finally {
      setPending(null);
    }
  }
  async function clearHistory() {
    if (pending) return;
    setPending("delete");
    setErrors({});
    try {
      // Delete only saved real/imported rides. The current recording and garage stay intact.
      for (const ride of realRides) await deleteRide(ride.id);
      await refreshRides();
      setDialog(null);
      notify("Your saved ride history has been cleared.");
    } catch (error) {
      await refreshRides();
      const message =
        error instanceof Error
          ? error.message
          : "Some rides could not be removed. Please try again.";
      setErrors({ general: message });
      notify(message);
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <Page>
          <PageHeading
            eyebrow="MAKE IT YOURS"
            title="Your ride. Your way."
            subtitle="A few thoughtful settings for the way you like to ride."
          />
          <View
            style={{
              flexDirection: wide ? "row" : "column",
              gap: 24,
              alignItems: "flex-start",
            }}
          >
            <View
              style={{
                flex: wide ? 1.35 : undefined,
                width: wide ? undefined : "100%",
                minWidth: 0,
                gap: 24,
              }}
            >
              <Card style={{ padding: 24 }}>
                <Row style={{ gap: 16, alignItems: "flex-start" }}>
                  <View style={s.avatar}>
                    <Txt
                      style={{ fontSize: 29, fontFamily: f.displayBold }}
                      color={c.lime}
                    >
                      {prefs.name.slice(0, 1).toUpperCase()}
                    </Txt>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Tag color={c.lime} icon="lock-closed-outline">
                      PERSONAL SPACE
                    </Tag>
                    <Txt variant="heading" style={{ marginTop: 10 }}>
                      {prefs.name}
                    </Txt>
                    <Txt
                      variant="small"
                      color={c.muted}
                      style={{ marginTop: 4 }}
                    >
                      A place for your roads and the stories behind them.
                    </Txt>
                  </View>
                </Row>
                <View style={s.rule} />
                <Row
                  style={{
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <View>
                    <Txt variant="small" color={c.muted}>
                      Your weekly distance goal
                    </Txt>
                    <Row style={{ alignItems: "baseline", marginTop: 4 }}>
                      <Txt style={{ fontFamily: f.display, fontSize: 28 }}>
                        {formatDistance(prefs.weeklyGoalKm, prefs.units, 0)}
                      </Txt>
                      <Txt color={c.muted}>{prefs.units} / week</Txt>
                    </Row>
                  </View>
                  <Button
                    title="Edit profile & goal"
                    icon="create-outline"
                    kind="secondary"
                    small
                    onPress={editProfile}
                    disabled={pending !== null}
                  />
                </Row>
                <Txt variant="small" color={c.faint} style={{ marginTop: 16 }}>
                  Your name is local to this device. Your goal is personal, with
                  no speed rankings or pressure to catch up.
                </Txt>
              </Card>

              <View>
                <SectionTitle title="The way you measure it" />
                <Card style={{ padding: 24 }}>
                  <Row style={{ gap: 14, marginBottom: 20 }}>
                    <View style={s.iconBox}>
                      <Icon name="speedometer-outline" color={c.lime} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt style={s.rowTitle}>Distance & speed</Txt>
                      <Txt variant="small" color={c.muted}>
                        Pick the units that feel familiar.
                      </Txt>
                    </View>
                  </Row>
                  <Row
                    style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}
                  >
                    {(
                      [
                        {
                          value: "km",
                          name: "Metric",
                          distance: "Kilometres",
                          speed: "km/h",
                        },
                        {
                          value: "mi",
                          name: "Imperial",
                          distance: "Miles",
                          speed: "mph",
                        },
                      ] as const
                    ).map((unit) => (
                      <Pressable
                        key={unit.value}
                        accessibilityRole="radio"
                        aria-checked={prefs.units === unit.value}
                        aria-busy={pending === "units"}
                        accessibilityLabel={`${unit.name} units`}
                        accessibilityState={{
                          checked: prefs.units === unit.value,
                          disabled: pending !== null,
                          busy: pending === "units",
                        }}
                        disabled={pending !== null}
                        onPress={() =>
                          prefs.units !== unit.value &&
                          void change("units", { units: unit.value })
                        }
                        style={({ pressed }) => [
                          s.unitChoice,
                          {
                            flexBasis: 120 * fontScale,
                            borderColor:
                              prefs.units === unit.value ? c.lime : c.line,
                            backgroundColor:
                              prefs.units === unit.value ? c.limeDim : c.bg,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Row style={{ justifyContent: "space-between" }}>
                          <Txt
                            color={prefs.units === unit.value ? c.lime : c.text}
                            style={s.rowTitle}
                          >
                            {unit.name}
                          </Txt>
                          <Icon
                            name={
                              prefs.units === unit.value
                                ? "checkmark-circle"
                                : "ellipse-outline"
                            }
                            color={
                              prefs.units === unit.value ? c.lime : c.faint
                            }
                            size={18}
                          />
                        </Row>
                        <Txt
                          variant="small"
                          color={c.muted}
                          style={{ marginTop: 8 }}
                        >
                          {unit.distance}
                        </Txt>
                        <Txt variant="small" color={c.muted}>
                          {unit.speed}
                        </Txt>
                      </Pressable>
                    ))}
                  </Row>
                  <Txt
                    variant="small"
                    color={c.faint}
                    style={{ marginTop: 16 }}
                  >
                    Elevation stays in metres and fuel in litres. Changing units
                    does not change your recorded data.
                  </Txt>
                </Card>
              </View>

              <View>
                <SectionTitle title="Your experience" />
                <Card>
                  <View style={s.settingRow}>
                    <Row style={{ gap: 14 }}>
                      <View style={s.iconBox}>
                        <Icon name="radio-button-on-outline" color={c.lime} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt style={s.rowTitle}>Recording preferences</Txt>
                        <Txt
                          variant="small"
                          color={c.muted}
                          style={{ marginTop: 5 }}
                        >
                          Start a ride or set up optional automatic capture.
                        </Txt>
                      </View>
                    </Row>
                    <Button
                      title="Open ride recorder"
                      icon="arrow-forward"
                      kind="ghost"
                      onPress={() => router.navigate("/record")}
                      style={{ marginTop: 12 }}
                    />
                  </View>
                </Card>
              </View>
            </View>

            <View
              style={{
                flex: wide ? 1 : undefined,
                width: wide ? undefined : "100%",
                minWidth: 0,
                gap: 24,
              }}
            >
              <View>
                <SectionTitle title="Privacy, by choice" />
                <Card>
                  <View style={s.settingRow}>
                    <Row style={{ gap: 14, alignItems: "flex-start" }}>
                      <View style={s.iconBox}>
                        <Icon name="shield-checkmark-outline" color={c.green} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt style={s.rowTitle}>Protect route endpoints</Txt>
                        <Txt
                          variant="small"
                          color={c.muted}
                          style={{ marginTop: 5 }}
                        >
                          Remove the first and last 300 metres from shared GPX
                          files and route cards.
                        </Txt>
                      </View>
                      <Switch
                        accessibilityLabel="Protect route endpoints in exports"
                        value={prefs.privacyTrim}
                        onValueChange={(value) =>
                          void change(
                            "privacy",
                            { privacyTrim: value },
                            value
                              ? "Endpoint protection is on for exports."
                              : "Exports can include your full route.",
                          )
                        }
                        disabled={pending !== null}
                        trackColor={{ false: c.line, true: c.lime }}
                        thumbColor={prefs.privacyTrim ? c.ink : c.muted}
                        ios_backgroundColor={c.line}
                      />
                    </Row>
                    <Txt
                      variant="small"
                      color={prefs.privacyTrim ? c.green : c.orange}
                      style={{ marginTop: 14 }}
                    >
                      {pending === "privacy"
                        ? "Saving your choice…"
                        : prefs.privacyTrim
                          ? "On · your saved original stays complete"
                          : "Off · exported routes may reveal where you started"}
                    </Txt>
                  </View>
                  <View style={[s.settingRow, s.divider]}>
                    <Txt variant="small" color={c.muted}>
                      Rides are stored on this device. Online maps contact their
                      providers, and sharing sends a copy to the destination you
                      choose. Trimming endpoints reduces exposure; it does not
                      make a ride anonymous.
                    </Txt>
                  </View>
                </Card>
              </View>

              <View>
                <SectionTitle title="Your local library" />
                <Card style={{ padding: 24 }}>
                  <Row
                    style={{
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    {[
                      { value: realRides.length, label: "Saved rides" },
                      {
                        value: realRides.filter((ride) => ride.isFavorite)
                          .length,
                        label: "Saved routes",
                      },
                      { value: prefs.vehicles.length, label: "Motorcycles" },
                    ].map((item) => (
                      <View key={item.label}>
                        <Txt
                          style={{
                            fontFamily: f.display,
                            fontSize: 28,
                            lineHeight: 36,
                          }}
                        >
                          {item.value}
                        </Txt>
                        <Txt variant="small" color={c.muted}>
                          {item.label}
                        </Txt>
                      </View>
                    ))}
                  </Row>
                  <View style={s.rule} />
                  <Row style={{ alignItems: "flex-start", gap: 10 }}>
                    <Icon name="download-outline" size={18} color={c.lime} />
                    <Txt variant="small" color={c.muted} style={{ flex: 1 }}>
                      Export a GPX from any ride to keep your own copy. There is
                      no cloud backup in this edition.
                    </Txt>
                  </Row>
                  <Button
                    title="Clear saved ride history"
                    icon="trash-outline"
                    kind="danger"
                    small
                    onPress={() => {
                      setErrors({});
                      setDialog("delete");
                    }}
                    disabled={realRides.length === 0 || pending !== null}
                    style={{ marginTop: 20 }}
                  />
                </Card>
              </View>

              <Card style={{ padding: 24, backgroundColor: c.limeDim }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt variant="label" color={c.lime}>
                    APEX MOTO
                  </Txt>
                  <Tag color={c.lime}>
                    VERSION {Application.nativeApplicationVersion ?? "1.0.0"} ·{" "}
                    {Application.nativeBuildVersion
                      ? `BUILD ${Application.nativeBuildVersion}`
                      : "WEB PREVIEW"}
                  </Tag>
                </Row>
                <Txt variant="heading" style={{ marginTop: 18 }}>
                  Good roads. Better rides.
                </Txt>
                <Txt variant="small" color={c.muted} style={{ marginTop: 10 }}>
                  An independent companion for the long way home. Your rides,
                  your motorcycles, your next escape.
                </Txt>
                <View style={s.rule} />
                <Txt variant="small" color={c.muted}>
                  Your logbook stays on this device. Export rides you want to
                  keep before uninstalling the app or clearing its data.
                </Txt>
                <Txt variant="small" color={c.faint} style={{ marginTop: 12 }}>
                  Keep your attention on the road. Explore the details when
                  you’ve parked.
                </Txt>
              </Card>
            </View>
          </View>
        </Page>
      </ScrollView>

      <Dialog
        visible={dialog === "profile"}
        title="A space that feels like you"
        subtitle="Your name and a little motivation for the week."
        onClose={() => setDialog(null)}
        busy={pending === "profile"}
      >
        {!!errors.general && (
          <Txt
            accessibilityRole="alert"
            color={c.red}
            style={{ marginBottom: 18 }}
          >
            {errors.general}
          </Txt>
        )}
        <FormField
          label="Your name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setErrors((old) => ({ ...old, name: "" }));
          }}
          error={errors.name}
          maxLength={40}
          editable={pending === null}
          placeholder="Rider"
        />
        <FormField
          label={`Weekly distance goal (${prefs.units})`}
          value={goal}
          onChangeText={(value) => {
            setGoal(value);
            setErrors((old) => ({ ...old, goal: "" }));
          }}
          error={errors.goal}
          numeric
          maxLength={8}
          editable={pending === null}
          hint="A personal target. Change it whenever your plans change."
        />
        <View
          style={{
            gap: 12,
            flexDirection: width < 600 ? "column-reverse" : "row",
          }}
        >
          <Button
            title="Cancel"
            kind="secondary"
            onPress={() => setDialog(null)}
            disabled={pending !== null}
            style={width >= 600 ? { flex: 1 } : undefined}
          />
          <Button
            title="Save preferences"
            icon="checkmark"
            onPress={() => void saveProfile()}
            loading={pending === "profile"}
            style={width >= 600 ? { flex: 1 } : undefined}
          />
        </View>
      </Dialog>
      <Dialog
        visible={dialog === "delete"}
        title="Clear your saved ride history?"
        onClose={() => setDialog(null)}
        busy={pending === "delete"}
      >
        <View
          style={[
            s.iconBox,
            { backgroundColor: "#FF939315", marginBottom: 18 },
          ]}
        >
          <Icon name="trash-outline" color={c.red} size={24} />
        </View>
        <Txt>
          This removes {realRides.length} saved{" "}
          {realRides.length === 1 ? "ride" : "rides"} from this device. It
          cannot be undone.
        </Txt>
        <Txt color={c.muted} style={{ marginTop: 12 }}>
          Export anything you want to keep first. Your garage, saved route
          selections, preferences and any current recording stay in place.
          Copies you already shared are unaffected.
        </Txt>
        {!!errors.general && (
          <Txt
            accessibilityRole="alert"
            color={c.red}
            style={{ marginTop: 16 }}
          >
            {errors.general}
          </Txt>
        )}
        <View style={{ gap: 12, marginTop: 24 }}>
          <Button
            title="Keep my rides"
            kind="secondary"
            onPress={() => setDialog(null)}
            disabled={pending !== null}
          />
          <Button
            title="Delete saved rides"
            kind="danger"
            icon="trash-outline"
            loading={pending === "delete"}
            onPress={() => void clearHistory()}
          />
        </View>
      </Dialog>
    </>
  );
}

const s = StyleSheet.create({
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: c.limeDim,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.line,
  },
  rowTitle: { fontFamily: f.bold, fontSize: 15 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.raised,
  },
  settingRow: { padding: 22 },
  divider: { borderTopWidth: 1, borderColor: c.line },
  rule: { height: 1, backgroundColor: c.line, marginVertical: 22 },
  unitChoice: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 100,
    padding: 16,
    borderWidth: 1,
    borderRadius: 14,
  },
});
