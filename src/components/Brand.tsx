import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Row, Txt } from "./ui";
import { colors as c, fonts as f } from "../theme";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Row style={{ gap: 10 }}>
      <View
        style={{
          height: 38,
          width: 38,
          backgroundColor: c.lime,
          borderRadius: 11,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Svg width={25} height={25} viewBox="0 0 32 32">
          <Path d="M4 25 16 5 28 25H20L16 18 12 25Z" fill={c.ink} />
          <Path d="M15 25 18 21 22 28H14Z" fill={c.ink} />
        </Svg>
      </View>
      {!compact && (
        <Row style={{ gap: 5 }}>
          <Txt
            style={{
              fontSize: 25,
              fontFamily: f.displayBold,
              letterSpacing: -1.5,
            }}
          >
            apex
          </Txt>
          <Txt
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: c.muted,
              marginTop: 6,
            }}
          >
            MOTO
          </Txt>
        </Row>
      )}
    </Row>
  );
}
