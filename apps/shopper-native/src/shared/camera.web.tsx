/**
 * camera.web.tsx — web stub for expo-camera's CameraView, mirroring the
 * pattern established by maps.web.tsx / DeliveryMap.web.tsx.
 *
 * requestPermission flips `granted` to true (rather than staying stuck at
 * "denied") so the permission-gated UI is still reachable for visual
 * verification on web, even though there's no real camera feed behind it.
 */
import React, { forwardRef, useImperativeHandle, useState } from "react";
import { View, type ViewProps } from "react-native";

export interface CameraViewHandle {
  takePictureAsync: (options?: unknown) => Promise<{ uri: string }>;
}

export interface CameraViewWebProps extends ViewProps {
  facing?: string;
  enableTorch?: boolean;
  onBarcodeScanned?: (event: { data: string }) => void;
  barcodeScannerSettings?: unknown;
}

export const CameraView = forwardRef<CameraViewHandle, CameraViewWebProps>(
  function CameraView({ style, facing: _facing, enableTorch: _enableTorch, onBarcodeScanned: _onBarcodeScanned, barcodeScannerSettings: _barcodeScannerSettings, ...rest }, ref) {
    useImperativeHandle(ref, () => ({
      takePictureAsync: async () => ({ uri: "" }),
    }));
    return <View {...rest} style={[{ flex: 1, backgroundColor: "#000" }, style]} />;
  },
);

export function useCameraPermissions(): [{ granted: boolean }, () => void] {
  const [granted, setGranted] = useState(false);
  return [{ granted }, () => setGranted(true)];
}
