onboarding-archive/ — Non-destructive snapshot of onboarding screen and deps

This folder is a copy-only archive for reference and experimentation. It is NOT
imported by the live project and should not be added under `app/` (Expo Router
will treat files in `app/` as routes).

Included files (snapshot of originals):
- app_onboarding.tsx         (copy of app/onboarding.tsx)
- rtlPager.ts                (copy of src/shared/motion/rtlPager.ts)
- Text.tsx                   (copy of src/shared/ui/Text.tsx)
- PressableScale.tsx         (copy of src/shared/motion/PressableScale.tsx)
- AppLogo.tsx                (copy of src/shared/components/AppLogo.tsx)
- onboardingKey.ts           (copy of src/lib/onboardingKey.ts)
- kit_tokens.ts              (copy of src/shared/kit/tokens.ts)
- theme_index.ts             (partial theme index barrel)
- layout.ts                  (canonical src/utils/layout.ts)

Notes:
- Purpose: quick local editing / prototyping without touching the active
  codebase. These files may be restructured or modified freely here.
- If you want more files included (e.g. full theme submodules), tell me which
  exact paths and I will add them to this archive.
