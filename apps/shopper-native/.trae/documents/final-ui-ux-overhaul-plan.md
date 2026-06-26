# Final UI/UX Overhaul Plan

## Summary

This plan covers the final visual and structural redesign for the six requested product areas: checkout, cart line items, loyalty and wallet surfaces, authentication flow, orders list/detail, and the address book plus address drawer. The implementation should stay strictly within React Native and Expo primitives, preserve existing business logic, and focus changes on layout, styling, interaction feedback, and bidirectional correctness.

The current codebase already contains strong foundations: a Cairo-based typography system, shared spacing/radius/shadow tokens, RTL helpers in `src/utils/layout.ts`, responsive helpers in `src/utils/responsive.ts`, and partially redesigned feature screens. The work is therefore not a blind rewrite of every screen. It is a controlled overhaul that removes inconsistent patterns, upgrades shared UI layers, and applies those upgrades consistently across the target files.

No relevant installed Skill materially improves this implementation plan, so the planning workflow proceeds without loading a separate Skill.

## Current State Analysis

### Shared design system

- `src/shared/theme/tokens.ts` already defines the Cairo font family, spacing, radius, shadows, gradients, and layout constants.
- `src/utils/layout.ts` already provides `isRtl()`, `flexRow()`, `textAlignStart()`, directional chevron constants, and logical edge helpers.
- `src/utils/responsive.ts` already provides `useScreenLayout()` with responsive page padding and breakpoint-aware sizing, but many target screens still rely on `theme.layout.pagePaddingH` instead of screen-aware spacing.

### Checkout

- `app/checkout.tsx` is already a thin orchestrator that delegates most UI to `src/features/checkout/components/*`.
- `src/features/checkout/components/checkout.styles.ts`, `DetailsStep.tsx`, and `ReviewStep.tsx` already contain a premium direction, but sticky footer spacing, press states, and logical alignment are still not fully unified.
- The screen currently uses `KeyboardAvoidingView`, absolute CTA positioning, and section cards, which is a good base for a full premium finish rather than a full architectural rewrite.

### Cart

- `app/(tabs)/cart.tsx` and `src/features/cart/cart.styles.ts` already contain redesigned cart cards and a custom quantity stepper.
- The product detail page in `app/product/[id].tsx` contains a stronger stepper pattern with more explicit button hierarchy and centered touch targets. That should become the visual reference for cart parity.
- The cart experience is therefore partially modernized, but not yet fully aligned with the product-detail interaction language the user requested.

### Loyalty and wallet

- `src/features/loyalty/components/wallet/wallet.styles.ts` is already a strong shared styling hub for the wallet family, and it is imported across multiple wallet components.
- The loyalty routes in `app/*.tsx` are mostly thin wrappers; the true implementation lives in `src/features/loyalty/screens/*`.
- A clear consistency gap remains:
  - several screens still hardcode text or locale behavior based on `IS_RTL` instead of the active language,
  - loyalty headers are split between `SubScreenHeader` and `WalletSharedViews.ScreenHeader`,
  - empty/error/unauth/loading panels are visually similar but not unified enough to feel like one premium ecosystem.

### Authentication

- `app/(auth)/login.tsx` and `app/(auth)/register.tsx` are already heavily redesigned.
- `src/features/auth/components/PhoneVerifyModal.tsx` already supports OTP code entry, resend timers, change-number flow, and `KeyboardAvoidingView`.
- The remaining gap is not missing structure, but inconsistent logical text alignment, limited differentiation between value-direction and text-direction, and incomplete unification of pressed states and keyboard behavior.

### Orders

- `src/features/orders/screens/OrdersScreen.tsx` and `src/features/orders/components/OrderCard.tsx` are already redesigned with premium cards and status presentation.
- `app/order/[id].tsx` and `src/features/orders/components/order-detail.styles.ts` are also redesigned, but detail alignment still contains hardcoded directional assumptions such as `align="right"` in contexts that should be logical-start driven.
- `theme.layout.pagePaddingH` is still used in orders styles, which is precisely the static-padding issue called out in the request.

### Addresses

- `app/addresses.tsx` already provides a premium list screen, and `src/features/addresses/components/AddressCard.tsx` is already modernized.
- `src/features/addresses/components/AddressFormDrawer.tsx` already contains a multi-step form flow, progress display, discard modal, and `KeyboardAvoidingView`.
- The main gaps are structural density, RTL-safe logical edges, and footer/navigation/input grouping refinement. This file should be refactored for layout clarity, not rewritten from scratch at the state-management level.

### External implementation constraints

The implementation should follow the current React Native guidance used by the existing architecture:

- `I18nManager.isRTL` should drive layout adjustments and logical edge handling, especially for absolute-positioned or animated elements.
- `KeyboardAvoidingView` should explicitly set `behavior`, and `keyboardVerticalOffset` should be used when the screen has fixed headers or bottom controls.
- `Pressable` should be used with deliberate `pressed` feedback, `hitSlop`, and `pressRetentionOffset` where precision matters for small icon targets.

These points align with the official React Native guidance and match the direction already visible in this repository.

## Proposed Changes

### 1. Shared interaction and bidirectional foundation

#### Files

- `src/utils/layout.ts`
- `src/shared/motion/PressableScale.tsx`
- target screen files listed below

#### What

Tighten the shared direction and interaction rules before polishing individual screens.

#### Why

The biggest remaining defects are not feature logic defects. They are consistency defects:

- some screens use logical RTL helpers correctly,
- some still hardcode alignment or physical edges,
- some use `PressableScale`,
- some use static `Pressable`,
- some treat values and labels identically even when the readable direction should differ.

Without a shared foundation pass, every screen-level overhaul will drift.

#### How

- Audit all target files for:
  - `left`, `right`, `paddingLeft`, `paddingRight`, `marginLeft`, `marginRight`,
  - `align="right"` and hardcoded `textAlign`,
  - icon choices that should rely on `BACK_CHEVRON`, `FORWARD_CHEVRON`, `BACK_ARROW`, `FORWARD_ARROW`.
- Keep layout direction on `isRtl()` and `flexRow()`.
- Move text content decisions to `t(...)` and `i18n.language`, not `IS_RTL`.
- Introduce a clear pattern for value-only fields:
  - coupon codes,
  - OTP cells,
  - order IDs,
  - price and quantity clusters,
  - phone values where LTR reading improves clarity.
- Standardize press feedback by intent:
  - cards and tappable rows use `PressableScale`,
  - icon buttons use `Pressable` with `pressed` background/border feedback,
  - text links use opacity/tint feedback,
  - destructive actions use visibly distinct pressed states.

### 2. Checkout flow overhaul

#### Files

- `app/checkout.tsx`
- `src/features/checkout/components/checkout.styles.ts`
- `src/features/checkout/components/DetailsStep.tsx`
- `src/features/checkout/components/ReviewStep.tsx`
- `src/features/checkout/components/SectionCard.tsx`
- `src/features/checkout/components/SummaryRow.tsx`
- `src/features/checkout/components/PaymentMethodCards.tsx`

#### What

Complete the premium checkout pass by refining section hierarchy, sticky CTA behavior, logical alignment for price rows, and pressed states throughout the details and review steps.

#### Why

The current structure is already feature-oriented and should be preserved. The remaining work is to finish the “conversion-critical” polish:

- shipping, payment, and order summary must read as fully premium sections,
- the bottom CTA must feel visually anchored and safe-area aware,
- price and currency alignment must remain readable in both RTL and LTR.

#### How

- Keep `app/checkout.tsx` as the orchestration shell.
- Move visual changes into feature components and shared checkout styles rather than inflating the route file.
- Upgrade the sticky CTA bar in `checkout.styles.ts`:
  - compute scroll bottom padding based on actual footer height and safe area,
  - strengthen active/disabled/blocked states,
  - ensure price cluster and CTA cluster align correctly in both directions.
- Improve `SectionCard` and `SummaryRow` usage so all sections share one consistent visual grammar.
- Review `DetailsStep.tsx` and `ReviewStep.tsx` for:
  - logical-start text alignment,
  - safer branch/action row handling,
  - tighter spacing between input groups,
  - clearer payment selection states,
  - better address summary readability,
  - more robust summary-row handling for discount and currency placement.
- Preserve existing checkout logic, form schema, pricing calculations, delivery rules, and manual payment behavior.

### 3. Cart line-item rebuild aligned to product detail

#### Files

- `app/(tabs)/cart.tsx`
- `src/features/cart/cart.styles.ts`
- reference only: `app/product/[id].tsx`

#### What

Bring the cart line-item layout and quantity stepper fully in line with the premium interaction language already established on the product detail page.

#### Why

The cart is already upgraded, but the request specifically calls out the line items and quantity controls as still feeling legacy compared with the product page. The product detail stepper is the closest in-repo reference for the desired premium feel.

#### How

- Keep the current `FlatList` and store-selector architecture in `cart.tsx`.
- Rework line-item composition to make image, title, total price, quantity control, and remove action feel more deliberate and balanced.
- Update `cart.styles.ts` stepper styles to match the product detail intent:
  - clearer plus/minus hierarchy,
  - perfectly centered icons inside touch targets,
  - strong active/disabled states,
  - balanced numeric value cell.
- Audit `Pressable` usage for:
  - remove,
  - clear cart,
  - checkout button,
  - branch/free-delivery/trust rows if interactive.
- Ensure price and currency placement remain readable and aligned in both RTL and LTR.

### 4. Loyalty hub and wallet ecosystem unification

#### Files

- `src/features/loyalty/screens/LoyaltyHubScreen.tsx`
- `src/features/loyalty/screens/LoyaltyWalletScreen.tsx`
- `src/features/loyalty/screens/TiersScreen.tsx`
- `src/features/loyalty/screens/CampaignsScreen.tsx`
- `src/features/loyalty/screens/CouponsScreen.tsx`
- `src/features/loyalty/screens/RedemptionHistoryScreen.tsx`
- `src/features/loyalty/components/wallet/wallet.styles.ts`
- `src/features/loyalty/components/SubScreenHeader.tsx`
- `src/features/loyalty/components/wallet/WalletSharedViews.tsx`

#### What

Convert the wallet-related experience into one coherent premium digital wallet system with a shared header model, shared panel model, shared interaction rules, and language-correct content formatting.

#### Why

This area gives the highest leverage because multiple screens are already close to the desired look and share common foundations. Fixing the shared layer compounds across the wallet ecosystem.

#### How

- Use `wallet.styles.ts` as the main shared visual foundation for wallet-family surfaces.
- Expand it to support shared wallet ecosystem patterns where useful:
  - section cards,
  - coupon/reward/redemption cards,
  - empty/error/unauth panels,
  - group headers,
  - utility rows,
  - premium chip and badge variants.
- Unify the header model by choosing one canonical loyalty sub-screen header:
  - extend `SubScreenHeader` to support any wallet-only needs,
  - migrate wallet screens off the duplicate header implementation in `WalletSharedViews` where practical.
- Replace hardcoded copy and locale-specific formatting in screen files with `t(...)` and language-aware helpers.
- Keep gradients, shadows, and premium palette choices, but standardize their use so hub, wallet, tiers, campaigns, coupons, and redemption history feel related.
- Ensure icons and directional affordances always respect `I18nManager.isRTL`.
- Preserve data-fetching and mutation hooks exactly as they are.

### 5. Authentication screen-level finishing pass

#### Files

- `app/(auth)/login.tsx`
- `app/(auth)/register.tsx`
- `src/features/auth/components/PhoneVerifyModal.tsx`
- reference only: `src/features/auth/styles/auth.styles.ts`

#### What

Finish the auth redesign at the screen level by tightening layout precision, interaction states, logical alignment, and OTP modal usability.

#### Why

These screens are already redesigned and should not be torn down. The work here is a finishing pass that makes them feel mathematically precise and fully production-hardened.

#### How

- Keep the existing multi-step flow in `register.tsx` and social/auth flow in `login.tsx`.
- Audit both screens for:
  - content width consistency,
  - spacing rhythm between fields and feedback areas,
  - consistent pressed behavior on icon buttons and links,
  - logical-start alignment for descriptive text.
- Improve error treatment so banners, inline errors, and step transitions feel consistent.
- In `PhoneVerifyModal.tsx`:
  - keep resend/verify/change-number logic untouched,
  - improve focused, filled, disabled, and error OTP cell states,
  - refine timer/value presentation for RTL/LTR clarity,
  - tune `KeyboardAvoidingView` and vertical offset behavior,
  - ensure the sheet footer remains visible above the keyboard.

### 6. Orders list and order detail premium pass

#### Files

- `src/features/orders/screens/OrdersScreen.tsx`
- `src/features/orders/components/orders.styles.ts`
- `src/features/orders/components/OrderCard.tsx`
- `src/features/orders/components/order-detail.styles.ts`
- `src/features/orders/components/OrderDetailHelpers.tsx`
- `app/order/[id].tsx`

#### What

Finish the order-tracking experience by removing static padding assumptions, normalizing directional behavior, and refining the receipt-like presentation of order details.

#### Why

Orders are visually close to premium already. The remaining issues are the exact ones the request highlights:

- static padding reliance,
- status clarity,
- premium receipt readability,
- final RTL correctness.

#### How

- Replace remaining direct reliance on `theme.layout.pagePaddingH` in orders screens with responsive padding from `useScreenLayout()` where appropriate.
- Keep existing status badge architecture, but standardize badge spacing, color contrast, and row balance between list and detail screens.
- Refine `OrderCard.tsx` and list styles so the card density and internal spacing match the rest of the final UI system.
- In `app/order/[id].tsx` and `OrderDetailHelpers.tsx`:
  - replace hardcoded alignment with logical alignment,
  - keep value clusters readable with explicit value-direction rules,
  - improve item row, address block, payment block, and summary block hierarchy,
  - make the breakdown feel like a premium receipt, not just stacked rows.
- Preserve current hooks and business logic for order detail loading and navigation.

### 7. Address book and address drawer structural overhaul

#### Files

- `app/addresses.tsx`
- `src/features/addresses/components/AddressFormDrawer.tsx`
- `src/features/addresses/components/AddressCard.tsx`

#### What

Keep the strong existing data flow, but restructure the drawer and list interactions so the address experience feels lighter, cleaner, and fully logical-direction safe.

#### Why

The list screen is already modernized, but the drawer is still the biggest structural risk because it is large, dense, and step-based. Fixing the layout without disturbing the form logic is the correct strategy.

#### How

- Preserve the current multi-step state flow in `AddressFormDrawer.tsx`.
- Refactor layout groups inside the drawer:
  - make the recipient and address sections feel like a native list-form,
  - reduce visual overwhelm through clearer grouping and spacing,
  - improve alignment of step pills, progress, toggles, and footer navigation.
- Replace physical edge usage with logical edge helpers or `paddingStart`/`paddingEnd`.
- Audit all controls for polished feedback:
  - close,
  - next,
  - previous,
  - submit,
  - discard-confirm actions,
  - label chips and switches.
- Keep `app/addresses.tsx` largely architecturally intact, but align its header actions and list-row interactions with the final system.
- Keep address store integration and CRUD behavior unchanged.

## Assumptions & Decisions

- Business logic, API behavior, data fetching, forms, and store interactions remain unchanged unless a small UI-driven refactor is necessary to support the redesign safely.
- Route files such as `app/loyalty.tsx`, `app/wallet.tsx`, and similar thin wrappers are not the main targets unless minor header or fallback parity changes are needed.
- Shared feature files should absorb most of the visual changes so the redesign scales across related screens.
- Language selection and text content must always come from i18n, while layout direction continues to come from RTL helpers.
- Numeric and code-like values may intentionally use LTR presentation where that improves readability, even on RTL screens.
- The product detail quantity stepper is the in-repo visual reference for cart stepper quality.
- `wallet.styles.ts` should be treated as a high-leverage shared styling file for wallet-family screens, but not forced to own unrelated hub-specific patterns that already belong elsewhere.

## Verification Steps

### Code quality

- Run `npm run typecheck`.
- Run `npm run lint`.

### UI and behavior review

- Verify each target flow in both Arabic and English:
  - checkout,
  - cart,
  - loyalty hub and wallet,
  - login,
  - register,
  - OTP modal,
  - orders list,
  - order detail,
  - addresses list,
  - address drawer.
- Confirm all directional icons, price rows, badges, and summary rows read correctly in RTL and LTR.
- Confirm every interactive element has visible pressed feedback and acceptable touch targets.
- Confirm keyboard behavior on auth forms, OTP modal, checkout inputs, and address drawer.
- Confirm sticky or bottom-anchored actions do not overlap content or the keyboard.
- Confirm list rows and cards preserve responsiveness on phone and tablet breakpoints through `useScreenLayout()` where adopted.

### Regression focus

- Checkout:
  - section rendering,
  - payment selection,
  - summary values,
  - sticky CTA state handling.
- Cart:
  - quantity updates,
  - remove behavior,
  - max-quantity feedback.
- Loyalty:
  - loading, empty, unauth, and error states,
  - coupon redemption flow,
  - redemption cancellation flow,
  - tier progress.
- Auth:
  - login,
  - signup,
  - OTP resend and verification.
- Orders:
  - order list navigation,
  - detail loading,
  - item navigation to product detail.
- Addresses:
  - add,
  - edit,
  - set default,
  - delete,
  - unsaved-changes confirmation.
