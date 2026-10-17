import {
  filterRidePoints,
  isValidRidePoint,
  PrivateZone,
  Ride,
  RidePoint,
  trimRideForPrivacy,
} from "./ride";

const MAX_GPX_CHARACTERS = 10_000_000;
const MAX_GPX_POINTS = 50_000;
const GPX_NAMESPACE = "http://www.topografix.com/GPX/1/1";

export interface GpxImportOptions {
  id?: string;
  name?: string;
  vehicleId?: string;
}

export interface GpxExportOptions {
  /** Explicit opt-in: pass {} for the default 300 m trim at both ends. */
  privacy?: { trimMeters?: number; zones?: readonly PrivateZone[] };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXml(value: string): string {
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/.test(value))
    throw new Error("GPX contains an unsupported XML entity.");
  return value.replace(
    /&(amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);/g,
    (_, entity: string) => {
      const entities: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
      };
      if (entities[entity]) return entities[entity];
      const code = entity.startsWith("#x")
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
      if (
        !Number.isSafeInteger(code) ||
        code > 0x10ffff ||
        (code >= 0xd800 && code <= 0xdfff) ||
        (code < 0x20 && code !== 9 && code !== 10 && code !== 13)
      )
        throw new Error("GPX contains an invalid character entity.");
      return String.fromCodePoint(code);
    },
  );
}

function parseNumber(value: string, field: string): number {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()))
    throw new Error(`Invalid GPX ${field}.`);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid GPX ${field}.`);
  return number;
}

function parseTime(value: string): number {
  const fields =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!fields)
    throw new Error(
      "Every GPX fix needs a valid ISO timestamp with a time zone.",
    );
  const [, year, month, day, hour, minute, second] = fields.map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    throw new Error("Invalid GPX timestamp.");
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp < 0)
    throw new Error("Invalid GPX timestamp.");
  return timestamp;
}

interface Element {
  name: string;
  local: string;
  text: string;
  attributes: Record<string, string>;
}
const localName = (name: string) => name.split(":").pop()!;

/**
 * Bounded XML reader for timed GPX tracks. No DOM, network, DTD, custom entities,
 * executable content, or external resources. Untimed routes are rejected rather
 * than inventing speed/duration data. Unknown extension elements are ignored.
 */
export function parseGpx(xml: string, options: GpxImportOptions = {}): Ride {
  return parseTrackXml(xml, options, false);
}

/** One recorded TCX activity, as exported by Fitbit / Google Health. */
export function parseTcx(xml: string, options: GpxImportOptions = {}): Ride {
  try {
    return parseTrackXml(xml, options, true);
  } catch (error) {
    throw new Error((error as Error).message.replace(/GPX/g, "TCX"));
  }
}

function parseTrackXml(
  xml: string,
  options: GpxImportOptions,
  tcx: boolean,
): Ride {
  if (
    typeof xml !== "string" ||
    xml.length === 0 ||
    xml.length > MAX_GPX_CHARACTERS
  )
    throw new Error("GPX must be a non-empty file smaller than 10 MB.");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error(
      "GPX documents with DTDs or custom entities are not supported.",
    );
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(xml))
    throw new Error("GPX contains invalid XML control characters.");
  const stack: Element[] = [];
  const points: RidePoint[] = [];
  let name = "";
  let rootSeen = false;
  let rootClosed = false;
  let xmlDeclarationSeen = false;
  let segment = -1;
  let pendingPoint: RidePoint | null = null;
  let pointHasTime = false;
  let activityCount = 0;
  let trackpointCount = 0;
  let skippedPositions = 0;
  let latitudeSeen = false;
  let longitudeSeen = false;
  let offset = xml.charCodeAt(0) === 0xfeff ? 1 : 0;

  function closeElement(expected: string): void {
    const element = stack.pop();
    if (!element || element.name !== expected)
      throw new Error("Malformed GPX: mismatched XML elements.");
    const parent = stack[stack.length - 1];
    const value = decodeXml(element.text).trim();
    if (
      element.local === "name" &&
      (parent?.local === "trk" || parent?.local === "metadata") &&
      !name
    )
      name = value.slice(0, 200);
    if (
      tcx &&
      element.local === "Notes" &&
      parent?.local === "Activity" &&
      !name
    )
      name = value.slice(0, 100);
    if (pendingPoint && parent?.local === (tcx ? "Trackpoint" : "trkpt")) {
      if (element.local === (tcx ? "Time" : "time")) {
        if (pointHasTime)
          throw new Error("GPX fix contains duplicate timestamps.");
        pendingPoint.timestamp = parseTime(value);
        pointHasTime = true;
      } else if (element.local === (tcx ? "AltitudeMeters" : "ele"))
        pendingPoint.altitude = parseNumber(value, "elevation");
    }
    if (
      tcx &&
      pendingPoint &&
      parent?.local === "Position" &&
      stack.at(-2)?.local === "Trackpoint"
    ) {
      if (element.local === "LatitudeDegrees") {
        if (latitudeSeen)
          throw new Error("Duplicate latitude in TCX track point.");
        latitudeSeen = true;
        pendingPoint.latitude = parseNumber(value, "latitude");
      } else if (element.local === "LongitudeDegrees") {
        if (longitudeSeen)
          throw new Error("Duplicate longitude in TCX track point.");
        longitudeSeen = true;
        pendingPoint.longitude = parseNumber(value, "longitude");
      }
    }
    if (
      pendingPoint &&
      stack.some(
        (item) => item.local === (tcx ? "Extensions" : "extensions"),
      ) &&
      stack.some((item) => item.local === (tcx ? "Trackpoint" : "trkpt"))
    ) {
      if (element.local === (tcx ? "Speed" : "speed"))
        pendingPoint.speed = parseNumber(value, "speed");
      else if (
        !tcx &&
        (element.local === "heading" || element.local === "course")
      )
        pendingPoint.heading = parseNumber(value, "heading");
      else if (!tcx && element.local === "accuracy")
        pendingPoint.accuracy = parseNumber(value, "accuracy");
      else if (!tcx && element.local === "lean")
        pendingPoint.lean = parseNumber(value, "lean");
    }
    if (element.local === (tcx ? "Trackpoint" : "trkpt")) {
      if (!pendingPoint || !pointHasTime)
        throw new Error(
          "This GPX has untimed points. Import a recorded track with timestamps.",
        );
      if (tcx && !latitudeSeen && !longitudeSeen) {
        // A heart-rate-only sample must not bridge a missing GPS section.
        skippedPositions += 1;
        segment += 1;
        pendingPoint = null;
        return;
      }
      if (!isValidRidePoint(pendingPoint))
        throw new Error(
          "GPX contains an invalid coordinate or telemetry value.",
        );
      points.push(pendingPoint);
      if (points.length > MAX_GPX_POINTS)
        throw new Error(
          "GPX has more than 50,000 points. Split it into smaller rides.",
        );
      pendingPoint = null;
    }
    if (stack.length === 0) rootClosed = true;
  }

  while (offset < xml.length) {
    if (xml[offset] !== "<") {
      const end = xml.indexOf("<", offset);
      const text = xml.slice(offset, end === -1 ? xml.length : end);
      if (text.includes("]]>")) throw new Error("Malformed GPX XML text.");
      // Validate entities even in unknown extensions so none bypass the XML contract.
      decodeXml(text);
      if (stack.length === 0 && text.trim())
        throw new Error("Malformed GPX: text outside the root element.");
      if (stack.length && text.trim()) {
        const current = stack[stack.length - 1];
        if (current.text.length + text.length > 16_384)
          throw new Error("A GPX text field is too large.");
        current.text += text;
      }
      offset = end === -1 ? xml.length : end;
      continue;
    }
    if (xml.startsWith("<!--", offset)) {
      const end = xml.indexOf("-->", offset + 4);
      if (end === -1 || xml.slice(offset + 4, end).includes("--"))
        throw new Error("Malformed GPX XML comment.");
      offset = end + 3;
      continue;
    }
    if (xml.startsWith("<?", offset)) {
      const end = xml.indexOf("?>", offset + 2);
      if (
        end === -1 ||
        rootSeen ||
        xmlDeclarationSeen ||
        !/^<\?xml\s/.test(xml.slice(offset, end))
      )
        throw new Error("Unsupported GPX processing instruction.");
      xmlDeclarationSeen = true;
      offset = end + 2;
      continue;
    }
    if (xml.startsWith("<!", offset))
      throw new Error("Unsupported GPX XML declaration.");
    let end = offset + 1;
    let quote = "";
    for (; end < xml.length; end += 1) {
      const char = xml[end];
      if (quote) {
        if (char === quote) quote = "";
      } else if (char === '"' || char === "'") quote = char;
      else if (char === ">") break;
      if (end - offset > 4_096) throw new Error("A GPX XML tag is too large.");
    }
    if (end === xml.length || quote) throw new Error("Malformed GPX XML tag.");
    const content = xml.slice(offset + 1, end);
    offset = end + 1;
    if (content.startsWith("/")) {
      const match = /^\/([A-Za-z_][\w.:-]*)\s*$/.exec(content);
      if (!match) throw new Error("Malformed GPX closing tag.");
      closeElement(match[1]);
      continue;
    }
    if (rootClosed) throw new Error("GPX must have exactly one root element.");
    const selfClosing = /\/\s*$/.test(content);
    const body = selfClosing ? content.replace(/\/\s*$/, "") : content;
    const tagMatch = /^([A-Za-z_][\w.:-]*)/.exec(body);
    if (!tagMatch) throw new Error("Malformed GPX opening tag.");
    const tag = tagMatch[1];
    const local = localName(tag);
    const attributes: Record<string, string> = Object.create(null) as Record<
      string,
      string
    >;
    let rest = body.slice(tag.length);
    let attributeCount = 0;
    while (rest.trim()) {
      const attribute =
        /^\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/.exec(rest);
      if (
        !attribute ||
        Object.prototype.hasOwnProperty.call(attributes, attribute[1])
      )
        throw new Error("Malformed or duplicate GPX attribute.");
      attributes[attribute[1]] = decodeXml(attribute[2] ?? attribute[3]);
      rest = rest.slice(attribute[0].length);
      if (++attributeCount > 32)
        throw new Error("Too many GPX XML attributes.");
    }
    if (!rootSeen) {
      if (local !== (tcx ? "TrainingCenterDatabase" : "gpx"))
        throw new Error("The file is not a GPX document.");
      const prefix = tag.includes(":") ? tag.split(":")[0] : "";
      const namespace = attributes[prefix ? `xmlns:${prefix}` : "xmlns"];
      if (
        namespace &&
        (tcx
          ? namespace !==
              "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" &&
            namespace !==
              "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v1"
          : namespace !== GPX_NAMESPACE &&
            namespace !== "http://www.topografix.com/GPX/1/0")
      )
        throw new Error("Unsupported GPX namespace.");
      rootSeen = true;
    }
    const parent = stack[stack.length - 1];
    if (tcx && local === "Activity") {
      if (parent?.local !== "Activities" || ++activityCount > 1)
        throw new Error(
          "Choose a TCX export containing one activity at a time.",
        );
    }
    if (local === (tcx ? "Track" : "trkseg")) {
      if (
        parent?.local !== (tcx ? "Lap" : "trk") ||
        pendingPoint ||
        (tcx && !stack.some((element) => element.local === "Activity"))
      )
        throw new Error("Malformed GPX track segment.");
      segment += 1;
    }
    if (local === (tcx ? "Trackpoint" : "trkpt")) {
      if (parent?.local !== (tcx ? "Track" : "trkseg") || pendingPoint)
        throw new Error("GPX points must belong to a track segment.");
      if (++trackpointCount > MAX_GPX_POINTS)
        throw new Error(
          "GPX has more than 50,000 points. Split it into smaller rides.",
        );
      pendingPoint = {
        latitude: tcx ? NaN : parseNumber(attributes.lat ?? "", "latitude"),
        longitude: tcx ? NaN : parseNumber(attributes.lon ?? "", "longitude"),
        timestamp: 0,
        speed: null,
        altitude: null,
        accuracy: null,
        heading: null,
        segment,
      };
      pointHasTime = false;
      latitudeSeen = false;
      longitudeSeen = false;
    }
    stack.push({ name: tag, local, text: "", attributes });
    if (stack.length > 32) throw new Error("GPX XML nesting is too deep.");
    if (selfClosing) closeElement(tag);
  }
  if (!rootSeen || !rootClosed || stack.length)
    throw new Error("Malformed or incomplete GPX document.");
  if (points.length < 2)
    throw new Error(
      tcx
        ? "This activity has no usable GPS route. Export an activity with a route map; steps, heart rate and workout totals cannot recreate a route."
        : "GPX must contain at least two timed track points.",
    );
  const filtered = filterRidePoints(points);
  if (filtered.length < 2)
    throw new Error("GPX does not contain enough reliable GPS fixes.");
  return {
    id: options.id ?? `import-${filtered[0].timestamp}-${filtered.length}`,
    name:
      options.name ??
      (name || (tcx ? "Imported Fitbit / TCX ride" : "Imported ride")),
    startedAt: filtered[0].timestamp,
    endedAt: filtered[filtered.length - 1].timestamp,
    points: filtered,
    vehicleId: options.vehicleId ?? "default",
    source: "import",
    importFormat: tcx ? "tcx" : "gpx",
    importWarnings: tcx
      ? [
          "Only recorded GPS, timestamps, altitude and speed are imported. Heart rate, calories and workout totals are not imported.",
          ...(skippedPositions
            ? [
                `${skippedPositions} samples had no position. GPS gaps remain disconnected.`,
              ]
            : []),
          ...(filtered.length < points.length
            ? [
                `${points.length - filtered.length} unreliable or out-of-order GPS samples were excluded.`,
              ]
            : []),
        ]
      : undefined,
    notes: "",
    isFavorite: false,
  };
}

export function exportGpx(input: Ride, options: GpxExportOptions = {}): string {
  const ride = options.privacy
    ? trimRideForPrivacy(
        input,
        options.privacy.trimMeters ?? 300,
        options.privacy.zones ?? [],
      )
    : input;
  const points = filterRidePoints(ride.points);
  if (points.length < 2)
    throw new Error(
      "At least two visible GPS points are needed to export this ride. Try a longer ride or adjust privacy settings.",
    );
  if (points.length > MAX_GPX_POINTS)
    throw new Error("A GPX export supports up to 50,000 points.");
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="Apex Ride" xmlns="${GPX_NAMESPACE}" xmlns:ride="https://apexride.app/gpx/1">`,
    `  <trk><name>${escapeXml(ride.name.slice(0, 200))}</name>`,
  ];
  let currentSegment: number | undefined;
  for (const point of points) {
    if (point.segment !== currentSegment) {
      if (currentSegment != null) lines.push("    </trkseg>");
      lines.push("    <trkseg>");
      currentSegment = point.segment;
    }
    lines.push(
      `      <trkpt lat="${point.latitude.toFixed(7)}" lon="${point.longitude.toFixed(7)}">`,
    );
    if (point.altitude != null)
      lines.push(`        <ele>${point.altitude.toFixed(2)}</ele>`);
    lines.push(
      `        <time>${new Date(point.timestamp).toISOString()}</time>`,
    );
    const extensions: string[] = [];
    for (const key of ["speed", "heading", "accuracy", "lean"] as const) {
      if (point[key] != null)
        extensions.push(`<ride:${key}>${point[key]}</ride:${key}>`);
    }
    if (extensions.length)
      lines.push(`        <extensions>${extensions.join("")}</extensions>`);
    lines.push("      </trkpt>");
  }
  lines.push("    </trkseg>", "  </trk>", "</gpx>");
  const xml = lines.join("\n");
  if (xml.length > MAX_GPX_CHARACTERS)
    throw new Error(
      "GPX export exceeds the 10 MB file limit. Split the ride into smaller tracks.",
    );
  return xml;
}
