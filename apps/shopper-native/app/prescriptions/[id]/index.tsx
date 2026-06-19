/**
 * Prescription detail route — thin wrapper over the real PrescriptionDetail
 * screen. The long-standing ComingSoon stub is gone.
 */

import React from "react";
import { useLocalSearchParams } from "expo-router";
import { PrescriptionDetail } from "@/features/prescriptions";

export default function Page(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PrescriptionDetail id={id} />;
}
