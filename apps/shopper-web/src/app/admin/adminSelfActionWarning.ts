// Shared "you're about to modify your own account" warning text, previously
// duplicated verbatim inside the AdminConfirmDialog `description` builder in
// StaffManager and UsersManager. Kept out of adminShared.tsx to avoid merge
// risk while that file is being touched elsewhere.

/**
 * Returns the self-action warning suffix (with a leading space) when
 * `isSelf` is true, or an empty string otherwise — matching the previous
 * inline `selfWarning` logic exactly.
 */
export function buildSelfActionWarning(isArabic: boolean, isSelf: boolean): string {
  if (!isSelf) return "";
  return isArabic
    ? " أنت على وشك تعديل حسابك الخاص — قد تفقد صلاحياتك الحالية فورًا."
    : " You're about to modify your own account — you may lose your current access immediately.";
}
