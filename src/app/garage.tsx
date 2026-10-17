import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, Path, Line, Ellipse } from "react-native-svg";
import { Page, PageHeading } from "../components/Shell";
import {
  Button,
  Card,
  Empty,
  Icon,
  IconButton,
  Row,
  SectionTitle,
  Tag,
  Txt,
} from "../components/ui";
import { Dialog, FormField } from "../components/Dialog";
import { useApp, Vehicle } from "../state/AppContext";
import { summarizeRide } from "../domain/ride";
import { colors as c, fonts as f, formatDistance } from "../theme";

type Editor = "bike" | "service" | "fuel" | null;
type Form = Record<string, string>;
const dateText = (value = Date.now()) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const numberValue = (value: string) =>
  /^\d+(?:\.\d{1,3})?$/.test(value.trim()) ? Number(value) : NaN;
const uniqueId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
function parseDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    year >= 1900 &&
    value <= dateText()
    ? date.getTime()
    : null;
}

function Motorcycle() {
  return (
    <Svg width="100%" height={175} viewBox="0 0 420 190" aria-hidden={true}>
      <Ellipse cx="211" cy="169" rx="172" ry="8" fill={c.bg} />
      <Circle
        cx="97"
        cy="127"
        r="40"
        fill={c.bg}
        stroke={c.line}
        strokeWidth="13"
      />
      <Circle
        cx="327"
        cy="127"
        r="40"
        fill={c.bg}
        stroke={c.line}
        strokeWidth="13"
      />
      <Circle
        cx="97"
        cy="127"
        r="25"
        fill="none"
        stroke={c.faint}
        strokeWidth="2"
      />
      <Circle
        cx="327"
        cy="127"
        r="25"
        fill="none"
        stroke={c.faint}
        strokeWidth="2"
      />
      <Path
        d="M98 127 L164 75 L223 127 Z M164 75 L199 127 L269 65"
        fill="none"
        stroke={c.muted}
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <Path
        d="M151 69 L181 49 Q217 31 252 61 L241 83 L188 91 Z"
        fill={c.lime}
      />
      <Path d="M99 62 L158 62 L178 74 L145 82 L110 77 Z" fill={c.text} />
      <Path
        d="M273 50 L284 48 L325 126 M277 51 L257 35 L244 35"
        stroke={c.muted}
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M282 52 L300 57 L304 73 L289 72 Z" fill={c.lime} />
      <Path
        d="M80 82 Q98 70 119 81 M294 91 Q328 71 355 96"
        stroke={c.muted}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M181 96 L220 94 L240 118 L221 137 L186 137 L175 119 Z"
        fill={c.raised}
        stroke={c.faint}
        strokeWidth="3"
      />
      <Line
        x1="218"
        y1="133"
        x2="144"
        y2="143"
        stroke={c.muted}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <Circle cx="97" cy="127" r="5" fill={c.lime} />
      <Circle cx="327" cy="127" r="5" fill={c.lime} />
    </Svg>
  );
}

export default function GarageScreen() {
  const { prefs, realRides, updatePrefs, notify } = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const vehicle =
    prefs.vehicles.find((item) => item.id === prefs.selectedVehicleId) ??
    prefs.vehicles[0];
  const [editor, setEditor] = useState<Editor>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [reviewFuel, setReviewFuel] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [form, setForm] = useState<Form>({});
  const [errors, setErrors] = useState<Form>({});
  const [saving, setSaving] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [history, setHistory] = useState<"service" | "fuel">("service");
  const [limit, setLimit] = useState(6);
  const logged = useMemo(() => {
    const rides = realRides.filter((ride) => ride.vehicleId === vehicle?.id);
    return {
      count: rides.length,
      distanceKm: rides.reduce(
        (total, ride) => total + summarizeRide(ride).distanceKm,
        0,
      ),
    };
  }, [realRides, vehicle?.id]);
  const services = useMemo(
    () => [...(vehicle?.services ?? [])].sort((a, b) => b.date - a.date),
    [vehicle],
  );
  const fuel = useMemo(
    () => [...(vehicle?.fuel ?? [])].sort((a, b) => b.date - a.date),
    [vehicle],
  );
  const totalLiters = fuel.reduce((sum, entry) => sum + entry.liters, 0);
  const totalCost = fuel.reduce((sum, entry) => sum + entry.cost, 0);
  const remaining =
    vehicle && vehicle.serviceDueKm > 0
      ? vehicle.serviceDueKm - vehicle.odometerKm
      : null;
  const factor = prefs.units === "mi" ? 0.621371 : 1;
  const displayNumber = (km: number) =>
    String(Math.round(km * factor * 10) / 10);

  function openBike(bike?: Vehicle) {
    setEntryId(null);
    setReviewFuel(false);
    setEditingId(bike?.id ?? null);
    setForm({
      name: bike?.name ?? "",
      model: bike?.model === "Add your make & model" ? "" : (bike?.model ?? ""),
      year: bike?.year ?? "",
      odometer: displayNumber(bike?.odometerKm ?? 0),
      due: bike?.serviceDueKm ? displayNumber(bike.serviceDueKm) : "",
    });
    setErrors({});
    setEditor("bike");
    setEditorOpen(true);
  }
  function openEntry(kind: "service" | "fuel", id?: string) {
    if (!vehicle) return;
    const entry =
      kind === "service"
        ? vehicle.services.find((e) => e.id === id)
        : vehicle.fuel.find((e) => e.id === id);
    setEntryId(entry?.id ?? null);
    setReviewFuel(false);
    setDeletingEntry(false);
    setEditingId(vehicle.id);
    setForm({
      kind: entry && "kind" in entry ? entry.kind : "",
      date: dateText(entry?.date),
      odometer: displayNumber(entry?.odometerKm ?? vehicle.odometerKm),
      due:
        !entry && vehicle.serviceDueKm > vehicle.odometerKm
          ? displayNumber(vehicle.serviceDueKm)
          : "",
      liters: entry && "liters" in entry ? String(entry.liters) : "",
      cost: entry && "cost" in entry ? String(entry.cost) : "",
    });
    setErrors({});
    setEditor(kind);
    setEditorOpen(true);
  }
  function change(key: string, value: string) {
    setReviewFuel(false);
    setForm((old) => ({ ...old, [key]: value }));
    setErrors((old) => ({ ...old, [key]: "", general: "" }));
  }
  async function save() {
    if (saving) return;
    const nextErrors: Form = {};
    const odometer = numberValue(form.odometer ?? "") / factor;
    if (!Number.isFinite(odometer) || odometer < 0 || odometer > 2_000_000)
      nextErrors.odometer = `Enter an odometer from 0 to ${formatDistance(2_000_000, prefs.units, 0)} ${prefs.units}.`;
    const due = form.due?.trim() ? numberValue(form.due) / factor : 0;
    if (
      editor !== "fuel" &&
      (!Number.isFinite(due) || due < 0 || due > 2_000_000)
    )
      nextErrors.due = "Enter a valid distance, or leave this blank.";
    if (
      editor === "service" &&
      due > 0 &&
      Number.isFinite(odometer) &&
      due <= odometer
    )
      nextErrors.due =
        "Choose a next-service reading above this service odometer, or leave it blank.";
    let date: number | null = null;
    if (editor === "bike") {
      if (!form.name?.trim()) nextErrors.name = "Give your motorcycle a name.";
      if (!form.model?.trim())
        nextErrors.model =
          "Add a make and model, such as Royal Enfield Himalayan.";
      if (
        form.year &&
        (!/^\d{4}$/.test(form.year) ||
          Number(form.year) < 1900 ||
          Number(form.year) > new Date().getFullYear() + 1)
      )
        nextErrors.year = "Enter a four-digit model year, or leave it blank.";
    } else {
      date = parseDate(form.date ?? "");
      if (date === null)
        nextErrors.date =
          "Use a real date in YYYY-MM-DD format, today or earlier.";
      if (editor === "service" && !form.kind?.trim())
        nextErrors.kind = "Add what was serviced, such as Oil & filter.";
    }
    const liters = numberValue(form.liters ?? "");
    const cost = numberValue(form.cost ?? "");
    if (editor === "fuel") {
      if (!Number.isFinite(liters) || liters <= 0 || liters > 1000)
        nextErrors.liters =
          "Enter a fuel amount above 0 and up to 1,000 litres.";
      if (!Number.isFinite(cost) || cost < 0 || cost > 1_000_000)
        nextErrors.cost = "Enter a cost from ₹0 to ₹10,00,000.";
    }
    if (Object.keys(nextErrors).length) {
      setErrors({
        ...nextErrors,
        general: "Check the highlighted fields below.",
      });
      return;
    }
    if (editor === "fuel" && liters > 40 && !reviewFuel) {
      setReviewFuel(true);
      setErrors({
        general: `${liters} litres is a large motorcycle fill. Check the amount, then tap Confirm to keep this entry.`,
      });
      return;
    }
    setSaving(true);
    try {
      if (editor === "bike") {
        const previous = prefs.vehicles.find((item) => item.id === editingId);
        const bike: Vehicle = {
          id: previous?.id ?? `bike-${uniqueId()}`,
          name: form.name.trim(),
          model: form.model.trim(),
          year: form.year.trim(),
          odometerKm: odometer,
          serviceDueKm: due,
          services: previous?.services ?? [],
          fuel: previous?.fuel ?? [],
        };
        await updatePrefs({
          vehicles: previous
            ? prefs.vehicles.map((item) => (item.id === bike.id ? bike : item))
            : [...prefs.vehicles, bike],
          selectedVehicleId: previous ? prefs.selectedVehicleId : bike.id,
        });
      } else {
        const previous = prefs.vehicles.find((item) => item.id === editingId);
        if (!previous)
          throw new Error(
            "This motorcycle is no longer available. Close this form and choose another.",
          );
        const next: Vehicle =
          editor === "service"
            ? {
                ...previous,
                odometerKm: Math.max(previous.odometerKm, odometer),
                serviceDueKm: entryId ? previous.serviceDueKm : due,
                services: [
                  ...previous.services.filter((e) => e.id !== entryId),
                  {
                    id: entryId ?? uniqueId(),
                    date: date!,
                    kind: form.kind.trim(),
                    odometerKm: odometer,
                  },
                ],
              }
            : {
                ...previous,
                odometerKm: Math.max(previous.odometerKm, odometer),
                fuel: [
                  ...previous.fuel.filter((e) => e.id !== entryId),
                  {
                    id: entryId ?? uniqueId(),
                    date: date!,
                    liters,
                    cost,
                    odometerKm: odometer,
                  },
                ],
              };
        await updatePrefs({
          vehicles: prefs.vehicles.map((item) =>
            item.id === next.id ? next : item,
          ),
        });
      }
      notify(
        editor === "bike"
          ? "Motorcycle saved to your garage."
          : editor === "service"
            ? "Service entry saved."
            : "Fuel entry saved.",
      );
      setEditorOpen(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not save. Please try again.";
      setErrors({ general: message });
      notify(message);
    } finally {
      setSaving(false);
    }
  }
  async function selectBike(id: string) {
    setSelecting(id);
    try {
      await updatePrefs({ selectedVehicleId: id });
      setLimit(6);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not select your motorcycle.",
      );
    } finally {
      setSelecting(null);
    }
  }
  async function deleteEntry() {
    if (
      saving ||
      !vehicle ||
      !entryId ||
      (editor !== "service" && editor !== "fuel")
    )
      return;
    setSaving(true);
    try {
      const next =
        editor === "service"
          ? {
              ...vehicle,
              services: vehicle.services.filter((e) => e.id !== entryId),
            }
          : { ...vehicle, fuel: vehicle.fuel.filter((e) => e.id !== entryId) };
      await updatePrefs({
        vehicles: prefs.vehicles.map((b) => (b.id === next.id ? next : b)),
      });
      setEditorOpen(false);
      setDeletingEntry(false);
      notify(
        "Entry removed. The motorcycle's current odometer and service reminder are unchanged.",
      );
    } catch (error) {
      setErrors({
        general:
          error instanceof Error
            ? error.message
            : "Could not remove this entry.",
      });
    } finally {
      setSaving(false);
    }
  }
  const field = (
    key: string,
    label: string,
    numeric = false,
    hint?: string,
    placeholder?: string,
  ) => (
    <FormField
      key={key}
      label={label}
      value={form[key] ?? ""}
      onChangeText={(value) => change(key, value)}
      numeric={numeric}
      error={errors[key]}
      hint={hint}
      placeholder={placeholder}
      editable={!saving}
      maxLength={numeric ? 12 : key === "year" ? 4 : 100}
    />
  );

  return (
    <>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <Page>
          <PageHeading
            eyebrow="YOUR RIDING PARTNER"
            title="A little care. A lot of road."
            subtitle="Your motorcycles, their milestones, and everything in between."
            action={
              <Button
                title="Add motorcycle"
                icon="add"
                onPress={() => openBike()}
              />
            }
          />
          {!vehicle ? (
            <Empty
              icon="bicycle-outline"
              title="Make room for your motorcycle"
              body="Add your bike to keep your rides, servicing and fill-ups together."
              action="Add your first bike"
              onPress={() => openBike()}
            />
          ) : (
            <>
              <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
                <Card style={{ flex: wide ? 1.5 : undefined, minWidth: 0 }}>
                  <View style={{ padding: 24, paddingBottom: 0 }}>
                    <Row style={{ justifyContent: "space-between", gap: 12 }}>
                      <Tag color={c.lime} icon="radio-button-on-outline">
                        ACTIVE MOTORCYCLE
                      </Tag>
                      <IconButton
                        icon="create-outline"
                        label={`Edit ${vehicle.name}`}
                        onPress={() => openBike(vehicle)}
                      />
                    </Row>
                    <Txt
                      style={{
                        fontFamily: f.displayBold,
                        fontSize: 30,
                        lineHeight: 38,
                        marginTop: 18,
                      }}
                    >
                      {vehicle.name}
                    </Txt>
                    <Txt color={c.muted} style={{ marginTop: 3 }}>
                      {[vehicle.year, vehicle.model]
                        .filter(Boolean)
                        .join(" · ")}
                    </Txt>
                  </View>
                  <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
                    <Motorcycle />
                  </View>
                  <Row
                    style={{
                      padding: 24,
                      paddingTop: 14,
                      flexWrap: "wrap",
                      gap: 24,
                      borderTopWidth: 1,
                      borderColor: c.line,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 120 }}>
                      <Txt variant="label" color={c.muted}>
                        ODOMETER
                      </Txt>
                      <Row
                        style={{ alignItems: "baseline", gap: 6, marginTop: 5 }}
                      >
                        <Txt variant="metric">
                          {formatDistance(vehicle.odometerKm, prefs.units, 0)}
                        </Txt>
                        <Txt color={c.muted}>{prefs.units}</Txt>
                      </Row>
                      <Txt variant="small" color={c.faint}>
                        Your entered reading
                      </Txt>
                    </View>
                    <View style={{ flex: 1, minWidth: 110 }}>
                      <Txt variant="label" color={c.muted}>
                        IN YOUR LOGBOOK
                      </Txt>
                      <Row
                        style={{ alignItems: "baseline", gap: 6, marginTop: 5 }}
                      >
                        <Txt variant="metric">{logged.count}</Txt>
                        <Txt color={c.muted}>rides</Txt>
                      </Row>
                      <Txt variant="small" color={c.faint}>
                        {formatDistance(logged.distanceKm, prefs.units)}{" "}
                        {prefs.units} together
                      </Txt>
                    </View>
                  </Row>
                </Card>
                <View
                  style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 16 }}
                >
                  <Card style={{ padding: 24, flex: 1 }}>
                    <Row style={{ justifyContent: "space-between" }}>
                      <View style={s.badge}>
                        <Icon
                          name="build-outline"
                          color={
                            remaining !== null && remaining <= 0
                              ? c.orange
                              : c.lime
                          }
                          size={24}
                        />
                      </View>
                      <Txt variant="label" color={c.muted}>
                        NEXT SERVICE
                      </Txt>
                    </Row>
                    <Txt variant="heading" style={{ marginTop: 22 }}>
                      {remaining === null
                        ? "Give your next ride a head start."
                        : remaining <= 0
                          ? "A little attention is due."
                          : "Keep the good miles coming."}
                    </Txt>
                    <Row style={{ alignItems: "baseline", marginTop: 10 }}>
                      <Txt
                        variant="metric"
                        color={
                          remaining !== null && remaining <= 0
                            ? c.orange
                            : c.lime
                        }
                      >
                        {remaining === null
                          ? "—"
                          : formatDistance(Math.abs(remaining), prefs.units, 0)}
                      </Txt>
                      {remaining !== null && (
                        <Txt color={c.muted}>
                          {prefs.units} {remaining <= 0 ? "past due" : "to go"}
                        </Txt>
                      )}
                    </Row>
                    <Txt
                      variant="small"
                      color={c.muted}
                      style={{ marginTop: 8, marginBottom: 20 }}
                    >
                      {remaining === null
                        ? "Set a service odometer in your bike details."
                        : `Planned at ${formatDistance(vehicle.serviceDueKm, prefs.units, 0)} ${prefs.units}. Based on your entered odometer.`}
                    </Txt>
                    <Button
                      title="Log a service"
                      icon="add"
                      kind="secondary"
                      onPress={() => openEntry("service")}
                    />
                  </Card>
                  <Card style={{ padding: 20 }}>
                    <Row style={{ gap: 14 }}>
                      <View style={s.badge}>
                        <Icon name="water-outline" color={c.cyan} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt style={{ fontFamily: f.bold }}>
                          Keep track of every tank.
                        </Txt>
                        <Txt variant="small" color={c.muted}>
                          {fuel.length
                            ? `${fuel.length} fill-ups · ${totalLiters.toFixed(1)} litres logged`
                            : "Add your first fill-up to start a fuel history."}
                        </Txt>
                      </View>
                    </Row>
                    <Button
                      title="Add a fill-up"
                      icon="add"
                      kind="ghost"
                      onPress={() => openEntry("fuel")}
                      style={{ marginTop: 12 }}
                    />
                  </Card>
                </View>
              </View>

              <View>
                <SectionTitle
                  title="In your garage"
                  eyebrow={`${prefs.vehicles.length} MOTORCYCLE${prefs.vehicles.length === 1 ? "" : "S"}`}
                />
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}
                >
                  {prefs.vehicles.map((bike) => (
                    <Pressable
                      key={bike.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${bike.name} as active motorcycle`}
                      accessibilityState={{
                        selected: bike.id === vehicle.id,
                        disabled: selecting !== null,
                      }}
                      disabled={selecting !== null}
                      onPress={() => void selectBike(bike.id)}
                      style={({ pressed }) => [
                        s.bikeChoice,
                        {
                          borderColor: bike.id === vehicle.id ? c.lime : c.line,
                          opacity: pressed ? 0.7 : 1,
                          width: width < 600 ? "100%" : 270,
                        },
                      ]}
                    >
                      <View style={s.badge}>
                        <Icon
                          name="bicycle-outline"
                          color={bike.id === vehicle.id ? c.lime : c.muted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt style={{ fontFamily: f.bold }}>{bike.name}</Txt>
                        <Txt variant="small" color={c.muted}>
                          {selecting === bike.id
                            ? "Selecting…"
                            : bike.id === vehicle.id
                              ? "Active for your next ride"
                              : bike.model}
                        </Txt>
                      </View>
                      {bike.id === vehicle.id && (
                        <Icon name="checkmark-circle" color={c.lime} />
                      )}
                    </Pressable>
                  ))}
                </View>
                <Txt variant="small" color={c.faint} style={{ marginTop: 12 }}>
                  Changing your active motorcycle applies to new rides. Your
                  current recording keeps its original bike.
                </Txt>
              </View>

              <View>
                <SectionTitle title="A well-kept history" />
                <Row style={{ gap: 8, marginBottom: 16 }}>
                  {(["service", "fuel"] as const).map((kind) => (
                    <Pressable
                      key={kind}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: history === kind }}
                      onPress={() => {
                        setHistory(kind);
                        setLimit(6);
                      }}
                      style={({ pressed }) => [
                        s.historyTab,
                        {
                          borderColor: history === kind ? c.lime : c.line,
                          backgroundColor:
                            history === kind ? c.limeDim : c.surface,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Icon
                        name={
                          kind === "service" ? "build-outline" : "water-outline"
                        }
                        color={history === kind ? c.lime : c.muted}
                        size={17}
                      />
                      <Txt
                        style={{ fontFamily: f.medium, fontSize: 13 }}
                        color={history === kind ? c.lime : c.muted}
                      >
                        {kind === "service"
                          ? `Service · ${services.length}`
                          : `Fuel · ${fuel.length}`}
                      </Txt>
                    </Pressable>
                  ))}
                </Row>
                {history === "service" ? (
                  services.length ? (
                    <Card>
                      {services.slice(0, limit).map((entry, index) => (
                        <Row
                          key={entry.id}
                          style={[s.historyRow, index > 0 && s.divider]}
                        >
                          <View style={s.badge}>
                            <Icon name="checkmark-outline" color={c.green} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Txt style={{ fontFamily: f.bold }}>
                              {entry.kind}
                            </Txt>
                            <Txt variant="small" color={c.muted}>
                              {new Date(entry.date).toLocaleDateString("en", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </Txt>
                          </View>
                          <Txt variant="small" color={c.muted}>
                            {formatDistance(entry.odometerKm, prefs.units, 0)}{" "}
                            {prefs.units}
                          </Txt>
                          <IconButton
                            icon="create-outline"
                            label={`Edit service ${entry.kind}`}
                            onPress={() => openEntry("service", entry.id)}
                          />
                        </Row>
                      ))}
                    </Card>
                  ) : (
                    <Empty
                      icon="build-outline"
                      title="The beginning of a good habit"
                      body="Oil changes, chain care, tyres. Keep the details in one place, ready when you need them."
                      action="Log your first service"
                      onPress={() => openEntry("service")}
                    />
                  )
                ) : fuel.length ? (
                  <>
                    <Card style={{ padding: 20, marginBottom: 12 }}>
                      <Row
                        style={{
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 20,
                        }}
                      >
                        <View>
                          <Txt variant="label" color={c.muted}>
                            FUEL LOGGED
                          </Txt>
                          <Txt variant="heading" style={{ marginTop: 6 }}>
                            {totalLiters.toFixed(1)} L
                          </Txt>
                        </View>
                        <View>
                          <Txt variant="label" color={c.muted}>
                            SPEND LOGGED · INR
                          </Txt>
                          <Txt variant="heading" style={{ marginTop: 6 }}>
                            ₹
                            {totalCost.toLocaleString("en-IN", {
                              maximumFractionDigits: 2,
                            })}
                          </Txt>
                        </View>
                      </Row>
                      <Txt
                        variant="small"
                        color={c.faint}
                        style={{ marginTop: 12 }}
                      >
                        Totals use your entries. Fuel economy needs full-tank
                        records and is not calculated here.
                      </Txt>
                    </Card>
                    <Card>
                      {fuel.slice(0, limit).map((entry, index) => (
                        <Row
                          key={entry.id}
                          style={[s.historyRow, index > 0 && s.divider]}
                        >
                          <View style={s.badge}>
                            <Icon name="water-outline" color={c.cyan} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Txt style={{ fontFamily: f.bold }}>
                              {entry.liters.toFixed(1)} litres
                            </Txt>
                            <Txt variant="small" color={c.muted}>
                              {new Date(entry.date).toLocaleDateString("en", {
                                day: "numeric",
                                month: "short",
                              })}{" "}
                              ·{" "}
                              {formatDistance(entry.odometerKm, prefs.units, 0)}{" "}
                              {prefs.units}
                            </Txt>
                          </View>
                          <Txt style={{ fontFamily: f.medium }}>
                            ₹
                            {entry.cost.toLocaleString("en-IN", {
                              maximumFractionDigits: 2,
                            })}
                          </Txt>
                          <IconButton
                            icon="create-outline"
                            label={`Edit fuel entry from ${dateText(entry.date)}`}
                            onPress={() => openEntry("fuel", entry.id)}
                          />
                        </Row>
                      ))}
                    </Card>
                  </>
                ) : (
                  <Empty
                    icon="water-outline"
                    title="More roads. Fewer loose receipts."
                    body="Keep a simple history of your fuel, odometer and spend. All stored with your motorcycle."
                    action="Add your first fill-up"
                    onPress={() => openEntry("fuel")}
                  />
                )}
                {(history === "service" ? services.length : fuel.length) >
                  limit && (
                  <Button
                    title="Show more entries"
                    kind="ghost"
                    onPress={() => setLimit((value) => value + 20)}
                    style={{ marginTop: 12 }}
                  />
                )}
              </View>
              <Row style={{ alignItems: "flex-start", gap: 10 }}>
                <Icon
                  name="shield-checkmark-outline"
                  size={18}
                  color={c.faint}
                />
                <Txt variant="small" color={c.faint} style={{ flex: 1 }}>
                  Service distances are personal reminders; follow your
                  motorcycle’s maintenance schedule.
                </Txt>
              </Row>
            </>
          )}
        </Page>
      </ScrollView>
      <Dialog
        visible={editorOpen}
        title={
          editor === "bike"
            ? editingId
              ? "Your motorcycle"
              : "Add a motorcycle"
            : editor === "service"
              ? entryId
                ? "Edit service"
                : "Log a service"
              : entryId
                ? "Edit fill-up"
                : "Add a fill-up"
        }
        subtitle={
          editor === "bike" ? "A place for your riding partner." : vehicle?.name
        }
        onClose={() => setEditorOpen(false)}
        busy={saving}
      >
        {!!errors.general && (
          <View accessibilityRole="alert" style={s.error}>
            <Icon name="alert-circle-outline" color={c.red} />
            <Txt color={c.red} style={{ flex: 1, fontSize: 13 }}>
              {errors.general}
            </Txt>
          </View>
        )}
        {editor === "bike" ? (
          <>
            {field(
              "name",
              "Motorcycle name",
              false,
              undefined,
              "The Himalayan",
            )}
            {field(
              "model",
              "Make & model",
              false,
              undefined,
              "Royal Enfield Himalayan 450",
            )}
            {field("year", "Model year · optional", true, undefined, "2026")}
          </>
        ) : (
          <>
            {editor === "service" &&
              field(
                "kind",
                "What was serviced?",
                false,
                undefined,
                "Oil & filter",
              )}
            {field(
              "date",
              "Date",
              false,
              "YYYY-MM-DD · today or earlier",
              "2026-10-15",
            )}
          </>
        )}
        {field(
          "odometer",
          `Odometer (${prefs.units})`,
          true,
          editor === "bike"
            ? "Use the reading on your motorcycle. Rides do not automatically change it."
            : "An older entry will not lower your current odometer.",
        )}
        {(editor === "bike" || (editor === "service" && !entryId)) &&
          field(
            "due",
            `Next service at (${prefs.units}) · optional`,
            true,
            "An odometer reading, not an interval. Leave blank to clear the reminder.",
          )}
        {editor === "fuel" && (
          <>
            {field("liters", "Fuel added (litres)", true, undefined, "10.5")}
            {field("cost", "Total cost (INR)", true, undefined, "1100")}
          </>
        )}
        {!!entryId && (
          <View style={{ gap: 12, marginBottom: 20 }}>
            <Txt variant="small" color={c.muted}>
              Corrections do not lower the current odometer or change the
              service reminder. Use Edit motorcycle if these also need
              correcting.
            </Txt>
            {deletingEntry ? (
              <>
                <Txt>
                  Remove this entry permanently? Other entries and rides will be
                  kept.
                </Txt>
                <Button
                  title="Keep entry"
                  kind="secondary"
                  disabled={saving}
                  onPress={() => setDeletingEntry(false)}
                />
                <Button
                  title="Confirm delete entry"
                  kind="danger"
                  loading={saving}
                  onPress={() => void deleteEntry()}
                />
              </>
            ) : (
              <Button
                title="Delete this entry"
                kind="ghost"
                icon="trash-outline"
                onPress={() => setDeletingEntry(true)}
                disabled={saving}
              />
            )}
          </View>
        )}
        <View
          style={{
            gap: 12,
            flexDirection: width < 600 ? "column-reverse" : "row",
          }}
        >
          <Button
            title="Cancel"
            kind="secondary"
            onPress={() => setEditorOpen(false)}
            disabled={saving}
            style={width >= 600 ? { flex: 1 } : undefined}
          />
          <Button
            title={
              editor === "bike"
                ? "Save motorcycle"
                : reviewFuel
                  ? `Confirm ${form.liters} L fill-up`
                  : "Save entry"
            }
            icon="checkmark"
            loading={saving}
            onPress={() => void save()}
            style={width >= 600 ? { flex: 1 } : undefined}
          />
        </View>
      </Dialog>
    </>
  );
}

const s = StyleSheet.create({
  badge: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: c.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  bikeChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 80,
  },
  historyTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
  },
  historyRow: { padding: 20, gap: 14, flexWrap: "wrap" },
  divider: { borderTopWidth: 1, borderColor: c.line },
  error: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    backgroundColor: "#FF93930B",
    borderRadius: 12,
    marginBottom: 20,
  },
});
