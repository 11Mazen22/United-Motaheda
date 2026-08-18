/**
 * BranchAddressCard — read-only two-tier branch location card (NativeWind).
 */

import React, { memo } from "react";
import { View } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { BRANCH_ADDRESSES, type BranchAddress } from "@/data/branchAddresses";

interface BranchAddressCardProps {
  branch: BranchAddress;
}

export const BranchAddressCard = memo(function BranchAddressCard({
  branch,
}: BranchAddressCardProps) {
  return (
    <View className="mb-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
      <UIText className="text-right text-base font-bold text-teal-700">
        {branch.title}
      </UIText>
      <UIText className="mt-1.5 text-right text-sm text-slate-500">
        {branch.address}
      </UIText>
    </View>
  );
});

interface BranchAddressListProps {
  branches?: readonly BranchAddress[];
}

export const BranchAddressList = memo(function BranchAddressList({
  branches,
}: BranchAddressListProps) {
  const items = branches ?? BRANCH_ADDRESSES;
  return (
    <View className="gap-0">
      {items.map((b) => (
        <BranchAddressCard key={b.title} branch={b} />
      ))}
    </View>
  );
});
