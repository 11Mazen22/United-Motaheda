/**
 * Static branch addresses for display cards (about, contact, etc.).
 * Distinct from delivery Branch selectors — read-only marketing copy.
 */

export interface BranchAddress {
  title: string;
  address: string;
}

export const BRANCH_ADDRESSES: readonly BranchAddress[] = [
  {
    title: "United Pharmacies - Gardenia City",
    address: "Shop B1, City Walk Mall, Gardenia City Compound, New Cairo",
  },
  {
    title: "United Pharmacies - Maadi",
    address: "1 Palestine St., inside Bandar Mall, New Maadi, Cairo",
  },
  {
    title: "United Pharmacies - Masakin Al-Dabbat 1",
    address: "Building 336, Fatima El-Zahraa St., off Al-Mithaq St., Nasr City",
  },
  {
    title: "United Pharmacies - Masakin Al-Dabbat 2",
    address: "Building 2004, Fatima El-Zahraa St., off Al-Mithaq St., 10th District, Nasr City",
  },
  {
    title: "United Pharmacies - Ismailia St. No. 14",
    address: "14 Ismailia St., off Al-Mithaq St., Zahraa Nasr City",
  },
  {
    title: "United Pharmacies - Ismailia St. No. 13",
    address: "13 El Ismaileya St., off Al-Mithaq St., Zahraa Nasr City",
  },
] as const;
