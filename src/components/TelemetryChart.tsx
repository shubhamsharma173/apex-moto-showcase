import React from "react";
import { View } from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import { TelemetrySample } from "../domain/display";
import { colors as c, formatClock } from "../theme";
import { Row, Txt } from "./ui";

export function TelemetryChart({
  samples,
  color = c.lime,
  height = 140,
  unit = "",
  duration = 0,
  cursor = 0,
}: {
  samples: TelemetrySample[];
  color?: string;
  height?: number;
  unit?: string;
  duration?: number;
  cursor?: number;
}) {
  const valid = samples.filter((p) => p.y != null);
  const min = Math.min(0, ...valid.map((p) => p.y!)),
    max = Math.max(1, ...valid.map((p) => p.y!));
  let path = "",
    open = false;
  for (const p of samples) {
    if (p.y == null) {
      open = false;
      continue;
    }
    const x = p.x * 500,
      y = height - 8 - ((p.y - min) / (max - min)) * (height - 20);
    path += `${open ? "L" : "M"}${x},${y} `;
    open = true;
  }
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="small" color={c.muted}>
        {valid.length
          ? `Scale: ${min.toFixed(1)} to ${max.toFixed(1)} ${unit}`
          : "No measurements available"}
      </Txt>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 500 ${height}`}
        preserveAspectRatio="none"
        aria-hidden
      >
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
        <Path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {duration > 0 && (
          <Line
            x1={Math.max(0, Math.min(1, cursor / duration)) * 500}
            x2={Math.max(0, Math.min(1, cursor / duration)) * 500}
            y1={0}
            y2={height}
            stroke={c.text}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}
      </Svg>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt variant="small" color={c.muted}>
          0:00
        </Txt>
        <Txt variant="small" color={c.muted}>
          {formatClock(duration)}
        </Txt>
      </Row>
    </View>
  );
}
