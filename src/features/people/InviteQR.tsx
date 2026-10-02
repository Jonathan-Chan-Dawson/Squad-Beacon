import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import QRCode from "qrcode";
export function InviteQR({ username }: { username: string }) {
  const qr = useMemo(
    () =>
      QRCode.create(
        "squadbeacon://invite?username=" + encodeURIComponent(username),
        { errorCorrectionLevel: "M" },
      ),
    [username],
  );
  const size = qr.modules.size;
  let path = "";
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++)
      if (qr.modules.get(row, col))
        path += "M" + (col + 4) + " " + (row + 4) + "h1v1h-1z";
  return (
    <View
      style={{
        alignSelf: "center",
        padding: 8,
        backgroundColor: "white",
        borderRadius: 18,
      }}
      accessibilityLabel={"Invitation QR code for @" + username}
    >
      <Svg
        width={220}
        height={220}
        viewBox={"0 0 " + (size + 8) + " " + (size + 8)}
      >
        <Rect width={size + 8} height={size + 8} fill="white" />
        <Path d={path} fill="#172C29" />
      </Svg>
    </View>
  );
}
