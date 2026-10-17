import React, { useMemo } from "react";
import Svg, {
  Polyline,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Path,
} from "react-native-svg";
import { RidePoint } from "../domain/ride";
import { routeBounds } from "../domain/map";
import { colors as c } from "../theme";
export function projectPoints(
  points: readonly RidePoint[],
  w = 500,
  h = 300,
  pad = 24,
) {
  if (!points.length) return [];
  const [west, south, east, north] = routeBounds(points)!;
  const cos = Math.cos((points[0].latitude * Math.PI) / 180);
  const origin = points[0].longitude;
  const xs = points.map(
      (p) => (origin + ((p.longitude - origin + 540) % 360) - 180) * cos,
    ),
    ys = points.map((p) => -p.latitude);
  const minX = west * cos,
    minY = -north,
    dx = Math.max(0.00001, (east - west) * cos),
    dy = north - south;
  const scale = Math.min((w - pad * 2) / dx, (h - pad * 2) / dy);
  return points.map((p, i) => ({
    x: (xs[i] - minX) * scale + (w - dx * scale) / 2,
    y: (ys[i] - minY) * scale + (h - dy * scale) / 2,
    segment: p.segment ?? 0,
  }));
}
export function RouteShape({
  points,
  color = c.lime,
  width = 500,
  height = 300,
  markerIndex,
  grid = false,
}: {
  points: readonly RidePoint[];
  color?: string;
  width?: number;
  height?: number;
  markerIndex?: number;
  grid?: boolean;
}) {
  const pts = useMemo(
    () => projectPoints(points, width, height, 26),
    [points, width, height],
  );
  const segments = useMemo(() => {
    const all: { x: number; y: number }[][] = [];
    pts.forEach((p, i) => {
      if (!i || p.segment !== pts[i - 1].segment) all.push([]);
      all.at(-1)!.push(p);
    });
    return all;
  }, [pts]);
  const current = pts[Math.min(markerIndex ?? 0, pts.length - 1)];
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden={true}
    >
      {grid &&
        Array.from({ length: 12 }, (_, i) => (
          <React.Fragment key={i}>
            <Line
              x1={i * 50}
              y1={0}
              x2={i * 50}
              y2={height}
              stroke={c.line}
              strokeWidth={0.5}
            />
            <Line
              x1={0}
              y1={i * 50}
              x2={width}
              y2={i * 50}
              stroke={c.line}
              strokeWidth={0.5}
            />
          </React.Fragment>
        ))}
      {segments.map((s, i) => (
        <React.Fragment key={i}>
          <Polyline
            points={s.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={12}
            opacity={0.08}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Polyline
            points={s.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </React.Fragment>
      ))}
      {!!pts.length && (
        <>
          <Circle
            cx={pts[0].x}
            cy={pts[0].y}
            r={5}
            fill={c.green}
            stroke={c.bg}
            strokeWidth={2}
          />
          <Circle
            cx={pts.at(-1)!.x}
            cy={pts.at(-1)!.y}
            r={5}
            fill={c.text}
            stroke={c.bg}
            strokeWidth={2}
          />
        </>
      )}
      {markerIndex != null && current && (
        <>
          <Circle
            cx={current.x}
            cy={current.y}
            r={14}
            fill={c.lime}
            opacity={0.18}
          />
          <Circle
            cx={current.x}
            cy={current.y}
            r={6}
            fill={c.lime}
            stroke={c.bg}
            strokeWidth={2}
          />
        </>
      )}
    </Svg>
  );
}
export function Sparkline({
  values,
  color = c.lime,
  filled = true,
  height = 100,
}: {
  values: number[];
  color?: string;
  filled?: boolean;
  height?: number;
}) {
  const max = Math.max(...values, 1),
    min = Math.min(...values, 0),
    delta = max - min || 1;
  const coords = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1 || 1)) * 500},${height - 8 - ((v - min) / delta) * (height - 20)}`,
    )
    .join(" ");
  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`0 0 500 ${height}`}
      preserveAspectRatio="none"
      aria-hidden={true}
    >
      <Defs>
        <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.23} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {[0.25, 0.5, 0.75].map((p) => (
        <Line
          key={p}
          x1={0}
          x2={500}
          y1={height * p}
          y2={height * p}
          stroke={c.line}
          strokeDasharray="3 7"
        />
      ))}
      {filled && (
        <Path
          d={`M0,${height} L${coords} L500,${height} Z`}
          fill="url(#area)"
        />
      )}
      <Polyline
        points={coords}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}
