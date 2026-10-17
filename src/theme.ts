export const colors = {
  bg: "#0B100F",
  surface: "#121A18",
  raised: "#1A2320",
  line: "#2A3530",
  text: "#F2F5EF",
  muted: "#A6B2AA",
  faint: "#7E9185",
  lime: "#D4F779",
  limeDim: "#253222",
  green: "#78D6AA",
  orange: "#FFBA7A",
  red: "#FF9393",
  cyan: "#73D9D2",
  ink: "#182014",
  map: "#101C19",
};
export const fonts = {
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  bold: "DMSans_700Bold",
  display: "SpaceGrotesk_600SemiBold",
  displayBold: "SpaceGrotesk_700Bold",
};
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };
export type Units = "km" | "mi";
export const distance = (km: number, units: Units) =>
  km * (units === "mi" ? 0.621371 : 1);
export const formatDistance = (km: number, units: Units, decimals = 1) =>
  distance(km, units).toLocaleString("en", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
export const formatDuration = (s: number) => {
  const n = Math.max(0, Math.floor(s));
  return n >= 3600
    ? `${Math.floor(n / 3600)}h ${Math.floor((n % 3600) / 60)}m`
    : `${Math.floor(n / 60)}m ${n % 60}s`;
};
export const formatClock = (s: number) =>
  `${Math.floor(Math.max(0, s) / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((Math.max(0, s) % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(Math.max(0, s) % 60)
    .toString()
    .padStart(2, "0")}`;
