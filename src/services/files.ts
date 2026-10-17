import { Platform, PixelRatio, View } from "react-native";
import type { RefObject } from "react";
import { captureRef, releaseCapture } from "react-native-view-shot";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { exportGpx } from "../domain/gpx";
import {
  Ride,
  summarizeRide,
  trimRideForPrivacy,
  thinPoints,
} from "../domain/ride";
import { projectPoints } from "../components/RouteShape";
import { Units, formatDistance, formatDuration } from "../theme";
async function saveFile(name: string, contents: string, type: string) {
  if (Platform.OS === "web") {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    return;
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sharing is unavailable on this device.");
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(contents);
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: type,
      dialogTitle: "Share your ride",
    });
  } finally {
    try {
      file.delete();
    } catch {
      /* OS may still hold the temporary file. */
    }
  }
}
const safe = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (ch) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[ch]!,
  );
const filename = (r: Ride) =>
  r.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60) || "apex-ride";
export async function shareGpx(ride: Ride, privateEnds: boolean) {
  await saveFile(
    `${filename(ride)}.gpx`,
    exportGpx(
      ride,
      privateEnds ? { privacy: { trimMeters: 300, zones: [] } } : undefined,
    ),
    "application/gpx+xml",
  );
}
function postcardSvg(ride: Ride, units: Units, privateEnds: boolean) {
  const shared = privateEnds ? trimRideForPrivacy(ride, 300) : ride;
  const points = projectPoints(thinPoints(shared.points, 1200), 1000, 800, 90),
    stats = summarizeRide(shared);
  const segments: string[][] = [];
  points.forEach((p, i) => {
    if (!i || p.segment !== points[i - 1].segment) segments.push([]);
    segments.at(-1)!.push(`${p.x},${p.y + 270}`);
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="#0B100F"/><text x="65" y="100" fill="#D4F779" font-family="Arial,sans-serif" font-weight="bold" font-size="40" letter-spacing="8">APEX MOTO</text><text x="65" y="190" fill="#F2F5EF" font-family="Arial,sans-serif" font-size="42">${safe(ride.name.slice(0, 36))}</text><text x="65" y="230" fill="#A6B2AA" font-family="Arial,sans-serif" font-size="22">${safe(new Date(ride.startedAt).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" }))}</text>${segments.map((s) => `<polyline points="${s.join(" ")}" fill="none" stroke="#D4F779" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>`).join("")}<line x1="65" x2="1015" y1="1110" y2="1110" stroke="#2A3530"/><text x="65" y="1200" fill="#F2F5EF" font-family="Arial,sans-serif" font-size="54">${formatDistance(stats.distanceKm, units)} ${units}</text><text x="600" y="1200" fill="#F2F5EF" font-family="Arial,sans-serif" font-size="54">${formatDuration(stats.movingSeconds)}</text><text x="65" y="1240" fill="#A6B2AA" font-family="Arial,sans-serif" font-size="19">DISTANCE</text><text x="600" y="1240" fill="#A6B2AA" font-family="Arial,sans-serif" font-size="19">MOVING TIME</text><text x="65" y="1310" fill="#A6B2AA" font-family="Arial,sans-serif" font-size="18">${privateEnds ? "Start and finish hidden · shared portion shown" : "A ride worth remembering"}</text></svg>`;
  return svg;
}

export async function shareCard(
  ride: Ride,
  units: Units,
  privateEnds: boolean,
) {
  await saveFile(
    `${filename(ride)}-postcard.svg`,
    postcardSvg(ride, units, privateEnds),
    "image/svg+xml",
  );
}

export async function sharePng(
  ride: Ride,
  units: Units,
  privateEnds: boolean,
  preview: RefObject<View | null>,
) {
  if (Platform.OS === "web") {
    const source = URL.createObjectURL(
      new Blob([postcardSvg(ride, units, privateEnds)], {
        type: "image/svg+xml",
      }),
    );
    try {
      const img = new globalThis.Image();
      img.src = source;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1350;
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("Image export is unavailable. Try SVG instead.");
      context.drawImage(img, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("Could not create postcard.")),
          "image/png",
        ),
      );
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `${filename(ride)}-postcard.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } finally {
      URL.revokeObjectURL(source);
    }
    return;
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sharing is unavailable on this device.");
  if (!preview.current) throw new Error("Open the postcard preview first.");
  const uri = await captureRef(preview, {
    format: "png",
    result: "tmpfile",
    width: 1080 / PixelRatio.get(),
    height: 1350 / PixelRatio.get(),
    quality: 1,
  });
  try {
    await Sharing.shareAsync(uri, {
      mimeType: "image/png",
      dialogTitle: "Share your ride",
    });
  } finally {
    releaseCapture(uri);
  }
}
