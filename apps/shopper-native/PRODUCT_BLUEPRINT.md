# United Pharmacy — V2 Production Blueprint (`shopper-native`)

Build-ready specification. Source of truth is the approved V2 vision; this document is its
implementation contract. Grounded in the actual Expo Router routes, the `@/shared/kit` design
system, existing feature modules, and the installed native stack. **Functional parity is
mandatory** — every existing route in §1.9 is preserved and re-homed, nothing is deleted.

Design law: **one ink, one accent, light-first, gradients rationed to the splash only.**

---

## 0. Conventions & shared registries

So that §4 specifies (not repeats) per-screen states, the following named patterns are defined
once and referenced everywhere as `[CODE]`.

**Token references** use real symbols: `kit.color.*`, `kit.radius.*`, `kit.sp(n)` (= `n*4`),
`kit.type.*`, `kit.shadow.*`, and `theme.animation.*` (durations/springs/easings).

**State pattern registry**
| Code | Pattern | Implementation |
|---|---|---|
| `L-SKEL(layout,n)` | Skeleton matching the final layout, `n` cells, subtle shimmer, entrance stagger ≤ 2 | `components/ui/Skeleton` + FlashList placeholder |
| `L-BTN` | In-control busy spinner; control disabled, label hidden | `kit/Button loading` / `IconButton` busy |
| `L-OVERLAY` | Blocking translucent overlay for irreversible waits (payment) | `shared/ui/LoadingOverlay` |
| `E-EMPTY(icon,title,body,cta)` | Calm illustration + 1 line + 1 primary action; never a dead end | `components/ui/EmptyState` |
| `X-INLINE(msg,retry)` | Inline error row + retry; **no blocking alert** | inline `ErrorState` row |
| `X-FULL(msg,retry,contact)` | Full-screen error; **total failure only**; retry + "Call pharmacy" | `ErrorBoundary` / route error |
| `O-BANNER` | Persistent top offline banner; cached reads shown; writes queue or block with reason | NetInfo + RQ persist |
| `P-FALLBACK` | Render available fields; em-dash placeholders for missing; never a blank card | per-card |

**Haptic tokens** (`H-*`) defined in §5.7; **motion tokens** (`M-*`) in §7.

**Route notation:** expo-router paths, e.g. `(tabs)/index`, `prescriptions/[id]/refill`.

---

## 1. Complete Information Architecture

Five tab destinations + global overlay surfaces. The new **Meds** tab is assembled entirely from
existing feature modules (`prescriptions`, `dependents`, `health-profile`, `insurance`,
`reminders`) — no new backend.

```
ROOT (app/_layout — providers: SafeArea, Query+persist, i18n/RTL, PharmacyBootstrap, ErrorBoundary)
│
├── Splash  ............................. SplashOverlay (once per cold launch; video; shared-element exit)
├── Onboarding  ......................... onboarding (guest-allowed; 3 beats; skippable)
│
├── (tabs)  ............................. (tabs)/_layout — 5-tab bar, persistent header bag + search
│   │
│   ├── Home  ........................... (tabs)/index  ["Today" dashboard]
│   │   ├── Now strip (active order)  ... → Order Tracking
│   │   ├── Needs-you cards  ............ → Rx Detail / Rx Refill / Dependent action
│   │   ├── Quick care (Scan/Refill/Pharmacist/Reorder)
│   │   └── Commerce below fold  ........ Categories · Deals · Featured · Pharmacist card
│   │
│   ├── Meds  ........................... (tabs route: meds) — segmented hub
│   │   ├── Prescriptions  .............. prescriptions/index (list)
│   │   │   ├── Rx Detail  .............. prescriptions/[id]/index
│   │   │   ├── Refill  ................. prescriptions/[id]/refill
│   │   │   ├── Add → Scan  ............. prescriptions/scan (camera + ML Kit OCR)
│   │   │   ├── Add → Manual  ........... prescriptions/manual
│   │   │   ├── Add → Entry chooser  .... prescriptions/add
│   │   │   └── Transfer  ............... prescriptions/transfer
│   │   ├── Reminders  .................. (reminders view; ReminderRow take/snooze)
│   │   ├── Family (Dependents)  ........ dependents (profile switcher + per-member meds)
│   │   ├── Interactions  .............. (InteractionBanner surfaced from profile meds)
│   │   ├── Health Profile  ............ health-profile (allergies, conditions)
│   │   └── Insurance  ................. insurance (cards, coverage, claims)
│   │
│   ├── Shop  ........................... (tabs)/products  [catalog]
│   │   ├── Category  ................... category/[id]
│   │   ├── Product Detail  ............. product/[id]  (Rx-gate, interaction check, alts)
│   │   ├── Deals  ...................... deals
│   │   ├── Featured  ................... featured
│   │   └── Campaigns  .................. campaigns
│   │
│   ├── Orders  ......................... (tabs)/orders
│   │   └── Order Detail / Tracking  .... order/[id]  (timeline + live map + reorder)
│   │
│   └── Profile  ........................ (tabs)/profile
│       ├── Account → Edit  ............. edit-profile
│       ├── Account → Password  ......... change-password
│       ├── Addresses  ................. addresses
│       ├── Payment methods  ........... payment (managed)
│       ├── Loyalty Hub  ............... loyalty
│       │   ├── Tiers  ................. tiers
│       │   ├── Wallet  ................ wallet
│       │   ├── Coupons  ............... coupons
│       │   ├── Gifts  ................. gifts
│       │   ├── Points history  ........ loyalty-history
│       │   ├── Redemptions  ........... redemption-history
│       │   └── Invite  ................ invite
│       ├── Wishlist / Favorites  ...... favorites
│       ├── Notifications inbox  ....... notifications
│       │   └── Preferences  ........... notification-preferences
│       ├── Settings  .................. (language · appearance · privacy · biometric · units)
│       └── Help  ...................... faq · about · terms · privacy
│
├── GLOBAL OVERLAYS (above tabs)
│   ├── Global Search  ................. (tabs)/search  → presented as full-screen modal
│   ├── Cart  ......................... (tabs)/cart  → header-bag slide-up sheet + full surface
│   ├── Checkout  ..................... checkout → payment (segmented flow)
│   ├── Profile Switcher  ............. dependents sheet (me / member …)
│   └── Auth stack  ................... (auth)/login · register · forgot-password · verify-phone
│                                        reset-password · auth-callback · change-password
│
└── DEV ONLY  ......................... __preview/components (component gallery; excluded from prod nav)
```

### 1.9 Route-parity map (proof no functionality is removed)
Every current route → V2 home:

| Existing route | V2 location |
|---|---|
| `(tabs)/index` | Home tab |
| `(tabs)/products` | Shop tab |
| `(tabs)/orders` | Orders tab |
| `(tabs)/profile` | Profile tab |
| `(tabs)/cart` | Cart sheet/surface (global) |
| `(tabs)/search` | Global Search modal |
| `prescriptions/index,[id],[id]/refill,add,manual,scan,transfer` | Meds › Prescriptions |
| `dependents`*, `health-profile`*, `insurance`* (feature modules) | Meds › Family / Health / Insurance |
| `category/[id]`, `product/[id]`, `deals`, `featured`, `campaigns` | Shop |
| `order/[id]`, `orders` | Orders |
| `checkout`, `payment` | Checkout flow |
| `loyalty`,`tiers`,`wallet`,`coupons`,`gifts`,`loyalty-history`,`redemption-history`,`invite` | Profile › Loyalty Hub |
| `addresses`,`edit-profile`,`change-password`,`favorites` | Profile › Account |
| `notifications`,`notification-preferences` | Profile › Notifications |
| `faq`,`about`,`terms`,`privacy` | Profile › Help |
| `onboarding`,`(auth)/*`,`reset-password`,`auth-callback` | Global overlays |
| `about`/`campaigns`/`invite` etc. | retained as listed |

\* exposed today via feature modules / stack; promoted to first-class Meds destinations.

---

## 2. Complete Navigation Architecture

### 2.1 Global navigation
- **Tab bar** (`(tabs)/_layout`): 5 items — Home · Meds · Shop · Orders · Profile. White bar,
  hairline top separator, single teal accent (`kit.color.accent`), active = filled icon + black
  label + 28×3 teal indicator; inactive = outline icon + `inkFaint` label. Height `BAR_H 62` +
  safe-area. Badges: Orders (active deliveries), Profile (unread notifications), Meds (refills due).
- **Persistent header actions** (every tab root): brand mark (start), **Search** entry (opens
  Global Search modal), **Bag** (cart count badge → Cart sheet). Notifications bell on Home only.
- **Profile switcher**: avatar in Meds/Home header opens the dependent switcher sheet; selected
  member scopes Meds + reminders + interaction checks.

### 2.2 Local navigation
- **Meds**: top `SegmentedControl` — Prescriptions · Reminders · Family · Insurance. Health Profile
  reached from Family/▸ overflow.
- **Shop**: sticky category chip-rail; "All products" → grid; search entry in header.
- **Orders**: segmented Active · Past filter.
- **Profile**: sectioned list (Account · Loyalty · Activity · Preferences · Help), each row pushes.
- **Loyalty Hub**: segmented Overview · Wallet · Rewards · History.

### 2.3 Context navigation (quick actions)
- **Rx card** long-press / overflow → action sheet: Refill · Transfer · Reminders · Archive.
- **Product card** long-press → Add to cart · Save to wishlist · Share.
- **Order card** → Track · Reorder · Get invoice.
- **Address/Payment rows** → Edit · Set default · Delete (destructive confirm dialog).
- Implemented via `shared/components/AppSheet` (+`appSheetStore`) / gorhom action sheets.

### 2.4 Modal architecture
| Type | Surfaces | Mechanism |
|---|---|---|
| Full-screen modal | Global Search, Rx Scan camera, Onboarding, Auth stack, Checkout | `expo-router` modal group, `presentation:"modal"` |
| Sheet (detented) | Cart, Profile switcher, Filters/Sort, Address picker, Delivery-slot picker, Add-dependent, Coupon apply | `@gorhom/bottom-sheet`, `bottomSheetRadius 28` |
| Dialog (centered) | Destructive confirm, **blocking interaction warning** (severe), session expiry | `AppSheet` centered variant / RN modal |
| Toast | Add-to-cart, copy, sync-complete | top transient, auto-dismiss 2.5 s |

### 2.5 Back navigation
- **iOS**: interactive edge-swipe pop on stacks; nav-bar back button (label = previous title);
  modals dismiss with downward drag; sheets dismiss via drag-to-detent-0 / scrim tap.
- **Android**: **predictive back** enabled (`react-native-screens` + `android:enableOnBackInvokedCallback`);
  shared-axis preview while dragging; hardware back pops stack / dismisses sheet / closes modal in
  that priority; on tab root, back → Home, second back → exit (standard).
- **RTL**: edge-swipe and shared-axis direction mirror under `I18nManager.isRTL`; chevrons flip
  (existing chevron convention honored).
- Cart/Checkout guard: back from Payment step returns to Review, not out of checkout; unsaved-edit
  dialog on Edit screens.

### 2.6 Sheet architecture
- **Engine** `@gorhom/bottom-sheet`; app-driven sheets via `shared/components/AppSheet` + `appSheetStore`.
- **Catalog & detents** Cart (55% / 92%) · Profile switcher (auto-height) · Filters/Sort (auto) ·
  Address picker (75%) · Delivery-slot (auto) · Add-dependent (90%, keyboard-aware) · Coupon apply
  (auto) · Action sheets (auto) · Severe-interaction = centered **dialog**, not a sheet.
- **Behavior** grabber handle; backdrop scrim fade to .5; pan-down + scrim-tap dismiss (suppressed on
  destructive confirm); input sheets raise above keyboard; primary action pinned in a safe-area footer;
  snap with `M-SHEET`.
- **Stacking** max one sheet at a time; a second request replaces or pushes within; dialogs render above sheets.
- **A11y** `accessibilityViewIsModal`, focus trap, first control focused on open, scrim labeled "dismiss",
  focus restored to the invoking control on close.

### 2.7 RTL navigation behavior
- **Locale** Arabic default → `I18nManager.forceRTL(true)`; all layout via `flexRow(isRtl())` /
  `textAlignStart` — no hard-coded left/right.
- **Stack** push enters from the start edge (right in RTL), pops to start; iOS edge-swipe originates
  right; Android predictive-back preview mirrors direction.
- **Tabs & focus** visual order right→left; screen-reader/focus order follows reading order.
- **Icons** chevrons/back glyphs flip (existing chevron convention; `FORWARD_CHEVRON` honored).
- **Pagers/rails** onboarding + carousels use `shared/motion/rtlPager` to avoid the documented
  double-mirror bug; horizontal `FlatList`/FlashList rails rely on OS `I18nManager` and **never** use `inverted`.
- **Language switch** toggling AR/EN flips RTL → triggers layout reflow; a restart prompt is shown where
  `forceRTL` parity changes.

---

## 3. Complete User Journey Maps

Format per journey: **Entry · Intent · Flow · Decision points · Success · Failure · Recovery · Exit.**

### 3.1 First launch (cold, no account)
- **Entry** app icon → native splash → `SplashOverlay`.
- **Intent** understand value, reach usable app fast.
- **Flow** splash (brand→video→handoff) → Onboarding 3 beats → Home (guest).
- **Decision** Skip onboarding? Sign in now or continue as guest?
- **Success** lands on Home as guest; catalog + scan available without account.
- **Failure** video decode fail → `useSplashSequence` load-timeout skips to app (already built).
- **Recovery** n/a (always proceeds).
- **Exit** Home `(tabs)/index`.

### 3.2 Guest browsing → conversion
- **Entry** Home/Shop as guest. **Intent** browse, maybe buy.
- **Flow** browse → add to cart → Checkout → at Review, account is *offered after* placing or via
  light phone-OTP; guest order allowed with phone capture.
- **Decision** guest checkout vs sign in; Rx item present → must auth + valid Rx.
- **Success** order placed; post-order "save your details" prompt.
- **Failure** Rx-gated item blocks guest → `X-INLINE` explains "prescription required".
- **Recovery** route to Scan/Sign-in inline, return to cart preserved (zustand `cart` store).
- **Exit** Order confirmation → Tracking.

### 3.3 Authentication (phone-first)
- **Entry** Profile/Sign-in, or auth-gate from Rx/checkout. **Intent** access account.
- **Flow** `(auth)/login` → phone → OTP (`verify-phone`/`PhoneVerifyModal`) → session; returnees
  → biometric unlock.
- **Decision** OTP vs password; new vs existing number → register branch.
- **Success** authenticated; returns to gated intent (deep-link back).
- **Failure** wrong/expired OTP → `X-INLINE` + resend timer; rate-limit lock.
- **Recovery** resend, change number, `forgot-password`.
- **Exit** previous intent or Profile.

### 3.3a Registration (new account)
- **Entry** Login → "Create account", or Onboarding CTA.
- **Intent** create a minimal account fast.
- **Flow** `(auth)/register` → name + phone → OTP (`verify-phone`) → session (status: new) → progressive
  profile (address captured at first checkout, health profile at first Rx).
- **Decision points** phone already registered → route to Login; OTP channel (SMS/WhatsApp); accept terms.
- **Success** account created; returns to the gated intent or Home; welcome state shown.
- **Failure** duplicate phone → `X-INLINE` + "Sign in instead"; invalid name/phone → inline validation;
  OTP fail → resend/lock.
- **Recovery** switch to Login, edit number, resend OTP.
- **Exit** Home or prior intent (deep-link back).

### 3.4 Prescription scan (OCR)
- **Entry** Home Quick-care "Scan", or Meds › Add › Scan (`prescriptions/scan`). **Intent** digitize a paper Rx.
- **Flow** camera (`expo-camera`) → capture → ML Kit `text-recognition` → `OcrReviewForm` review/edit
  fields → confirm → Rx created (status `active`).
- **Decision** retake? edit extracted fields? assign to which family member?
- **Success** Rx saved, appears in list with `STATUS_TONE`; offered "set reminders / refill now".
- **Failure** OCR low confidence / no text → `X-INLINE("couldn't read", retry)` + Manual fallback.
- **Recovery** Retake, switch to `prescriptions/manual`, or Transfer.
- **Exit** Rx Detail `prescriptions/[id]`.

### 3.5 Prescription refill (2-tap)
- **Entry** Home needs-you card, Rx Detail, or Rx list. **Intent** reorder a medication.
- **Flow** Refill CTA → `prescriptions/[id]/refill` (price + insurance applied + ETA) → confirm → order.
- **Decision** member, quantity/refills-left, delivery slot, insurance vs cash.
- **Success** order created → Tracking; refills-left decremented; `H-SUCCESS`.
- **Failure** expired Rx (`expired`) → refill disabled, explains; out of refills → transfer/contact.
- **Recovery** request new Rx / transfer / call pharmacist.
- **Exit** Order Tracking.

### 3.6 Family management
- **Entry** Meds › Family, or profile switcher. **Intent** manage another person's meds.
- **Flow** switcher → add dependent (name, relation, DOB) → that member's Rx/reminders/interactions scope.
- **Decision** add member; assign Rx to member; caregiver permissions.
- **Success** member added; meds scoped per member; Home needs-you aggregates across members.
- **Failure** duplicate/invalid member → `X-INLINE`.
- **Recovery** edit/remove member.
- **Exit** Meds scoped to selected member.

### 3.7 Product discovery
- **Entry** Shop tab / Global Search / Home commerce. **Intent** find a product or remedy.
- **Flow** search (keyword/photo/voice) or browse category → Product Detail → interaction check →
  add to cart.
- **Decision** Rx-required gate; interaction warning; choose alternative.
- **Success** item in cart; `H-IMPACT-MED`.
- **Failure** out of stock → notify-me; Rx-required without Rx → route to Scan.
- **Recovery** alternatives list, back-in-stock alert.
- **Exit** continue shopping or Cart.

### 3.8 Checkout
- **Entry** Cart → Checkout. **Intent** complete purchase fast.
- **Flow** `checkout`: Deliver (address+slot) → Pay (`payment`, method+insurance) → Review → Place.
- **Decision** address (saved/map-pick), slot, payment method, insurance apply, promo.
- **Success** `L-OVERLAY` during charge → success choreography → Order Tracking; cart cleared.
- **Failure** payment decline / address invalid / item went OOS → `X-INLINE` at the offending step.
- **Recovery** edit step in place; retry payment; remove OOS item.
- **Exit** Order confirmation/Tracking.

### 3.9 Order tracking
- **Entry** Home Now-strip, Orders, post-checkout, or push/Live Activity. **Intent** "where are my meds".
- **Flow** `order/[id]`: status timeline + live courier map + ETA + contact.
- **Decision** contact courier, view invoice, reorder.
- **Success** delivered state; prompt review/loyalty points.
- **Failure** delivery exception → status surfaces issue + contact.
- **Recovery** chat/call support, reschedule.
- **Exit** Orders list / reorder.

### 3.10 Loyalty
- **Entry** Profile › Loyalty, post-order points toast. **Intent** track/redeem rewards.
- **Flow** Hub Overview (balance + tier ring) → earn ways → Rewards catalog → redeem → Wallet voucher.
- **Decision** redeem now vs save; tier-up actions.
- **Success** voucher in Wallet; `H-SUCCESS` + count-up; usable at checkout.
- **Failure** insufficient points / out-of-stock gift → `X-INLINE`.
- **Recovery** earn-more suggestions.
- **Exit** Wallet / back to Hub.

### 3.11 Insurance
- **Entry** Meds › Insurance, or Checkout Pay step. **Intent** apply coverage to a purchase/refill.
- **Flow** add insurance card → coverage shown → at Pay, "apply insurance" → covered amount computed.
- **Decision** which policy; cash vs insured.
- **Success** discounted total at checkout; claim recorded.
- **Failure** policy invalid/expired/not covered → `X-INLINE` + cash fallback.
- **Recovery** edit policy, contact insurer/pharmacist.
- **Exit** back to Checkout with total updated.

---

## 4. Complete Screen Catalog

Per screen: **Purpose · Hierarchy · Layout (header/search/nav/cards/content/actions/footer) ·
Interaction · Motion · A11y · Loading · Empty · Error · Offline · Partial.** States reference §0.
Layout positions assume RTL-first (start = right) via `flexRow`/`textAlignStart`.

### 4.1 Splash — `SplashOverlay`
- **Purpose** branded launch + trust; hand off to Home.
- **Hierarchy** brand mark > wordmark > video > skip.
- **Layout** full-bleed; centered brand stack (rings+logo+wordmark); Skip pill top-trailing (safe-area).
- **Interaction** Skip → end; tap-to-unmute (if audio added).
- **Motion** `M-SPLASH`: native→brand spring reveal→video→shared-element logo handoff; reduced-motion fades.
- **A11y** decorative hidden; only Skip exposed (`accessibilityViewIsModal`).
- **Loading** is the loading screen. **Empty** n/a. **Error** video fail → load-timeout exit (built).
- **Offline** plays (bundled asset). **Partial** n/a.

### 4.2 Onboarding — `onboarding`
- **Purpose** sell outcomes (meds handled / family / verified originals); reach Home.
- **Hierarchy** art > headline > dots > CTA.
- **Layout** full-bleed art; headline+subline lower-third; progress dots above CTA; Skip top-trailing.
- **Interaction** horizontal paging (RTL `rtlPager`), swipe/tap-next, Skip, final CTA (Continue as guest / Sign in).
- **Motion** `M-PAGE-SHARED-AXIS` + parallax art; `M-REDUCED` static.
- **A11y** each beat a page; `accessibilityRole:"adjustable"` pager; CTAs labeled.
- **Loading** none (static assets). **Empty/Partial** n/a. **Error** asset fail → solid brand bg fallback. **Offline** works.

### 4.3 Login / Register / Verify — `(auth)/login` · `register` · `verify-phone`
- **Purpose** phone-first auth; minimal friction.
- **Hierarchy** brand > field(s) > primary CTA > alternate path.
- **Layout** brand mark top; single field block centered-upper; primary `kit Button(full)`; secondary ghost below; legal micro footer.
- **Interaction** autofocus; numeric keypad; OTP 6-box auto-advance + paste + SMS autofill; biometric prompt for returnees; `kit Button loading` on submit.
- **Motion** field focus ring (`brandGlow`); error shake `M-ERROR`; success `M-SUCCESS`→deep-link back.
- **A11y** labeled fields, error `accessibilityLiveRegion`, 44pt targets, Dynamic Type.
- **Loading** `L-BTN`. **Empty** n/a. **Error** `X-INLINE` (bad OTP/credentials) + resend timer. **Offline** `O-BANNER` + submit blocked w/ reason. **Partial** n/a.

### 4.4 Home — `(tabs)/index`
- **Purpose** anticipatory "Today": surface what needs the user, then commerce.
- **Hierarchy** greeting/brand > Now (active order) > Needs-you (ranked) > Quick care > Categories > Deals > Featured > Pharmacist.
- **Layout**
  - Header: brand (start), notifications + bag (end); greeting + time icon; flat `kit.color.canvas` (no gradient — done).
  - Search: pill below greeting (opens Global Search), accent "sparkles" badge (solid — done).
  - Now strip: full-width status card (or calm "all good").
  - Needs-you: vertical actionable cards (refill due / Rx review / dependent / expiring).
  - Quick care: 4-up icon row (Scan · Refill · Pharmacist · Reorder).
  - Commerce: category chip-rail → Deals (FlashList) → Featured (snap rail) → Pharmacist card.
  - Footer: bottom padding 100 (clears tab bar).
- **Interaction** pull-to-refresh (parallel queries); 2-tap refill; swipe order card → tracking; card press → detail.
- **Motion** entrance stagger ≤ 2 (`M-LIST-IN`); live-status dot pulse; `H-SELECT` on quick-care.
- **A11y** **urgency-first reading order** (needs-you before commerce); each card a labeled button.
- **Loading** `L-SKEL(home, sections)` (product rails skeleton). **Empty** guest/no-activity → commerce-forward fallback + `E-EMPTY` for needs-you ("you're all caught up"). **Error** per-section `X-INLINE` + retry (independent queries). **Offline** `O-BANNER`; cached catalog + cached Rx/orders shown. **Partial** `P-FALLBACK` per card.

### 4.5 Global Search — `(tabs)/search` (modal)
- **Purpose** intent-aware search: keyword, photo (OCR), voice; with safety signals.
- **Hierarchy** field > recent/trending chips > results.
- **Layout** top search field (autofocus) with camera + mic affordances; below: recent + trending chips when empty; results list (FlashList rows: thumb · name/dose · price · stock · Rx-required badge · "safe with your meds ✓/⚠").
- **Interaction** debounced query; scan opens camera→OCR→query; voice dictation; chip tap fills; row → Product.
- **Motion** results fade/translate-in (`M-LIST-IN`); modal present/dismiss `M-MODAL`.
- **A11y** field labeled; result rows announce name+price+stock+safety; scan/mic labeled buttons.
- **Loading** `L-SKEL(rows,6)`. **Empty** pre-query → chips; no-results → `E-EMPTY("no matches", suggest categories)`. **Error** `X-INLINE`. **Offline** search cached catalog only + `O-BANNER`. **Partial** `P-FALLBACK` rows (price/stock dashed).

### 4.6 Product Detail — `product/[id]`
- **Purpose** decide + add safely; enforce Rx gate + interaction check.
- **Hierarchy** image > name/dose > price/stock > safety > description/alternatives > sticky add.
- **Layout** image hero (shared element); title+dose; price + stock pill; **Rx-required gate** banner if applicable; **interaction result** (`InteractionBanner` inline if profile match); originals-verified line; description; alternatives rail; sticky bottom bar: quantity `Stepper` + `kit Button(primary,full)` Add to cart.
- **Interaction** qty stepper; add (gated by Rx/stock); wishlist toggle; alternative → swap; image zoom.
- **Motion** image shared-element from card; add → fly-to-bag + `H-IMPACT-MED`; sticky bar elevates on scroll.
- **A11y** price/stock/Rx-gate spoken; gate explains *why*; stepper buttons labeled ±.
- **Loading** `L-SKEL(product)`. **Empty** n/a. **Error** `X-FULL` if product fetch fails. **Offline** cached product viewable; add queues w/ note. **Partial** `P-FALLBACK` (price/stock dashed, add disabled until known).

### 4.7 Meds hub — (Prescriptions·Reminders·Family·Insurance)
- **Purpose** the care command center.
- **Hierarchy** member switcher > segmented control > section content.
- **Layout** header: profile switcher (avatar+name), add (＋); `SegmentedControl`; content per segment:
  - **Prescriptions**: `RxCard(list)` rows (status pill, next-refill, Refill CTA).
  - **Reminders**: grouped by Today/Upcoming; `ReminderRow` (check, name, time, Take/Snooze).
  - **Family**: member list + add; each → that member's meds.
  - **Insurance**: policy cards + add; coverage summary.
- **Interaction** segment switch; member switch (scopes all); Rx row → detail; long-press → quick actions; reminder take/snooze.
- **Motion** segment underline slide (`M-EMPHASIZE`); member switch cross-fades content; `H-SELECT`.
- **A11y** segmented `accessibilityRole:"tablist"`; member switch announces scope; status pills text+icon.
- **Loading** `L-SKEL(rows,4)`. **Empty** per-segment `E-EMPTY` ("No prescriptions yet — scan your first"). **Error** `X-INLINE` + retry. **Offline** cached Rx list shown; add/refill queue w/ note. **Partial** `P-FALLBACK` Rx cards.

### 4.8 Rx Scan — `prescriptions/scan`
- **Purpose** OCR a paper Rx.
- **Hierarchy** camera > guide frame > capture > review.
- **Layout** full-bleed `expo-camera`; guide rectangle; capture button bottom-center; flash/flip top; member chip top.
- **Interaction** capture → ML Kit recognize → `OcrReviewForm`; retake; manual fallback link.
- **Motion** capture flash; frame settle; review sheet rises (`M-SHEET`).
- **A11y** camera labeled; capture 44pt+; review fields labeled; announce OCR confidence.
- **Loading** recognition `L-BTN`/inline spinner. **Empty** n/a. **Error** `X-INLINE("couldn't read", retry|manual)`. **Offline** OCR is on-device → works; save queues. **Partial** review form pre-fills found fields only (`P-FALLBACK`).

### 4.9 Rx Detail — `prescriptions/[id]/index`
- **Purpose** full medication record + actions.
- **Hierarchy** name/status > dose/schedule > refills/next > prescriber > reminders > interactions > actions.
- **Layout** header (name + status pill); meta grid (dose, schedule, refills-left, next-refill, prescriber); reminders block; interaction block (`InteractionBanner` if any); actions: Refill (primary), Transfer, Set reminders, Archive.
- **Interaction** Refill → refill flow; toggle reminders; archive (confirm dialog).
- **Motion** status pill change animates; refill press `H-IMPACT-MED`.
- **A11y** dose/schedule never truncate (Dynamic Type reflow); status text+icon; actions labeled.
- **Loading** `L-SKEL(detail)`. **Empty** n/a. **Error** `X-FULL`. **Offline** cached record; refill queues. **Partial** `P-FALLBACK` meta dashes.

### 4.10 Rx Refill — `prescriptions/[id]/refill`
- **Purpose** confirm a refill into an order.
- **Hierarchy** med summary > quantity/refills > insurance/price > delivery > confirm.
- **Layout** med summary card; quantity stepper; insurance toggle (computed price); delivery slot row; price breakdown; sticky `kit Button(primary,full)` Confirm refill.
- **Interaction** qty; insurance apply; slot pick (sheet); confirm.
- **Motion** price recompute count; `L-OVERLAY` on submit; `M-SUCCESS`.
- **A11y** price changes announced; confirm labeled with total.
- **Loading** `L-OVERLAY`. **Empty** n/a. **Error** `X-INLINE` (expired/out-of-refills disables + explains). **Offline** queue w/ "sends when online". **Partial** `P-FALLBACK` price ("—" until quote).

### 4.11 Cart — `(tabs)/cart` (sheet + surface)
- **Purpose** review basket, enforce Rx, proceed.
- **Hierarchy** items > Rx flags > totals/insurance > checkout.
- **Layout** sheet (detents: half/full) or full surface; item rows (thumb, name, qty stepper, price, swipe-remove); Rx-required flag per item; promo field; insurance preview; totals; sticky `kit Button(primary,full)` Checkout.
- **Interaction** qty edit; swipe-remove; promo apply; Rx flag → resolve (scan/select); checkout (auth/Rx gate).
- **Motion** add → item slides in + badge bump; remove → collapse; sheet detents `M-SHEET`.
- **A11y** steppers labeled; totals announced on change; Rx flag explained.
- **Loading** `L-SKEL(rows,3)`. **Empty** `E-EMPTY("Cart's empty", "Browse products")` + suggestions. **Error** `X-INLINE` (price/stock revalidation). **Offline** view cached; checkout blocked w/ reason. **Partial** `P-FALLBACK` (price recheck on reconnect).

### 4.12 Checkout — `checkout` + Payment `payment`
- **Purpose** complete purchase in ≤ 3 steps; returnees < 30 s.
- **Hierarchy** step indicator > active step content > totals (persistent) > primary action.
- **Layout** top `StepIndicator` (Deliver · Pay · Review); per step:
  - Deliver: address (saved selector / map-pick) + delivery slot.
  - Pay: method cards (`PaymentMethodCards`) + insurance apply + promo.
  - Review: line items + totals + place button.
  - Persistent totals bar bottom; primary CTA contextual (Next / Place order).
- **Interaction** inline step edit; address sheet; slot sheet; method select; place → charge.
- **Motion** step change `M-EMPHASIZE`; `L-OVERLAY` charge; `M-SUCCESS` calm (no confetti).
- **A11y** each step labeled section; totals announced; errors inline at offending field.
- **Loading** `L-OVERLAY` (charge), `L-BTN` (next). **Empty** n/a (guarded by cart). **Error** `X-INLINE` at step (decline/invalid/OOS). **Offline** block place w/ `O-BANNER`; preserve entered data. **Partial** `P-FALLBACK` (totals "—" until quote).

### 4.13 Orders — `(tabs)/orders`
- **Purpose** list orders, jump to tracking, reorder.
- **Hierarchy** segmented Active/Past > order cards.
- **Layout** segmented filter; `OrderCard` rows (id, date, status pill, item summary, total, ▸); active orders pinned on top with live status.
- **Interaction** card → tracking; long-press → Reorder/Invoice; pull-refresh.
- **Motion** status pill transitions; press scale.
- **A11y** status text+icon; cards labeled with id+status+total.
- **Loading** `L-SKEL(rows,4)`. **Empty** `E-EMPTY("No orders yet","Start shopping")`. **Error** `X-INLINE`. **Offline** cached orders + `O-BANNER`. **Partial** `P-FALLBACK`.

### 4.14 Order Tracking — `order/[id]`
- **Purpose** reassure: live status, map, ETA, contact, reorder.
- **Hierarchy** status headline/ETA > map > timeline > items > actions.
- **Layout** header status + ETA; live map (`react-native-maps`, courier marker) for out-for-delivery; vertical status timeline (placed→preparing→out→delivered); item summary; actions: Contact courier, Invoice, Reorder, Help.
- **Interaction** call/chat courier; reorder; view invoice.
- **Motion** timeline node advance animates; courier marker interpolates; status change `H-SUCCESS` on delivered.
- **A11y** timeline as ordered list; status changes `accessibilityLiveRegion`; map has text alternative (ETA/stage).
- **Loading** `L-SKEL(timeline)`. **Empty** n/a. **Error** `X-FULL`. **Offline** last-known status + `O-BANNER` ("live updates paused"). **Partial** `P-FALLBACK` (map omitted if no geo; timeline still shown).

### 4.15 Loyalty Hub — `loyalty` (+ `tiers`,`wallet`,`coupons`,`gifts`,`loyalty-history`,`redemption-history`,`invite`)
- **Purpose** track points/tier, redeem, manage wallet.
- **Hierarchy** balance/tier > earn ways > rewards > wallet/history.
- **Layout** segmented Overview · Wallet · Rewards · History.
  - Overview: points balance + tier progress ring (`tiers`); earn-ways list; invite (`invite`).
  - Wallet (`wallet`): vouchers/coupons (`coupons`), gift cards (`gifts`).
  - Rewards: redeemable catalog (`gifts`/redeem) → `redemption-history`.
  - History: `loyalty-history` points ledger.
- **Interaction** redeem (confirm); apply voucher; invite share; tier-up CTA.
- **Motion** points count-up + `H-SUCCESS`; ring fill `M-EMPHASIZE`; **no slot-machine**.
- **A11y** balance/tier announced; ring has text value; redeem labeled with cost.
- **Loading** `L-SKEL`. **Empty** per-segment `E-EMPTY`. **Error** `X-INLINE`. **Offline** cached balance + `O-BANNER`; redeem blocked. **Partial** `P-FALLBACK`.

### 4.16 Profile — `(tabs)/profile`
- **Purpose** account home + entries to everything personal.
- **Hierarchy** identity > sections (Account · Loyalty · Activity · Preferences · Help).
- **Layout** header: avatar + name + member switcher; sectioned `ListRow`s: Edit profile (`edit-profile`), Addresses (`addresses`), Payment (`payment`), Change password (`change-password`); Loyalty entry; Wishlist (`favorites`); Notifications (`notifications`); Settings; Help (`faq`,`about`,`terms`,`privacy`); Sign out.
- **Interaction** rows push; sign out (confirm); switch member.
- **Motion** row press scale; push `M-PAGE`.
- **A11y** rows labeled w/ value where shown; section headers as headings.
- **Loading** `L-SKEL(rows)`. **Empty** guest → "Sign in" hero. **Error** `X-INLINE`. **Offline** cached profile + `O-BANNER`. **Partial** `P-FALLBACK`.

### 4.17 Settings (within Profile)
- **Purpose** preferences + system behavior.
- **Layout** grouped rows: Language (AR/EN + RTL), Appearance (Light/Dark/System), Notifications (→ `notification-preferences`, quiet hours), Privacy (`privacy`), Biometric lock, Units, About (`about`), Legal (`terms`/`privacy`).
- **Interaction** toggles/selects; language change re-lays RTL (restart prompt if needed).
- **Motion** toggle spring; theme switch cross-fade.
- **A11y** every control labeled + state; high priority for screen-reader clarity.
- **Loading/Empty/Partial** n/a (local). **Error** `X-INLINE` (save fail). **Offline** local-only settings work.

### 4.18 Notifications — `notifications` (+ `notification-preferences`)
- **Purpose** actionable inbox: orders, refills, offers.
- **Hierarchy** grouped sections > items (read/unread) > inline actions.
- **Layout** grouped list (Orders · Refills · Offers); item row (icon, title, time, unread dot, inline action e.g. "Refill"); preferences entry (gear) → `notification-preferences` (channels + quiet hours).
- **Interaction** tap → deep target; inline action; swipe dismiss; mark all read.
- **Motion** swipe reveal; read fade.
- **A11y** unread state announced; inline actions labeled.
- **Loading** `L-SKEL(rows)`. **Empty** `E-EMPTY("You're all caught up")`. **Error** `X-INLINE`. **Offline** cached + `O-BANNER`. **Partial** `P-FALLBACK`.

### 4.19 Help — `faq` · `about` · `terms` · `privacy`
- **Purpose** support + legal; pharmacist as hero.
- **Layout** Help landing: **"Talk to a pharmacist" (chat/call)** primary card; searchable FAQ list (`faq`); links to About/Terms/Privacy (static content screens).
- **Interaction** search FAQ; expand answers; start chat/call.
- **Motion** accordion expand `M-EMPHASIZE`.
- **A11y** FAQ as expandable list; contact 44pt+.
- **Loading** `L-SKEL` (FAQ). **Empty** no-results `E-EMPTY`. **Error** `X-INLINE`. **Offline** cached FAQ + static legal; chat blocked w/ reason. **Partial** n/a.

### 4.20 Utility / content screens (compact, full-field)
`addresses`, `edit-profile`, `change-password`, `payment`, `coupons`, `gifts`, `campaigns`,
`deals`, `featured`, `category/[id]`, `favorites`, `about`, `terms`, `privacy`, `invite`,
`reset-password`, `auth-callback`, `forgot-password`.
- **Purpose** as named (forms / lists / static / catalog sub-views).
- **Layout** standard: `AppHeader` (title + back) → content (form fields / FlashList grid / scroll text) → sticky primary action where applicable.
- **Interaction** forms = inline-validated fields + `kit Button loading` submit; lists = FlashList + filters; static = scroll.
- **Motion** `M-PAGE` in; field focus ring; `M-SUCCESS`/`M-ERROR` on submit.
- **A11y** labeled fields/links, 44pt, Dynamic Type, RTL.
- **Loading** forms `L-BTN`; lists `L-SKEL(grid/rows)`; static none.
- **Empty** lists `E-EMPTY`; forms n/a.
- **Error** `X-INLINE` (forms/lists); `X-FULL` only on total content failure.
- **Offline** lists cached + `O-BANNER`; form submit queues/blocks w/ reason; static always available.
- **Partial** lists `P-FALLBACK`; forms prefill known fields.

### 4.21 Native iOS / Android behavior (per-screen matrix)

Supplies the **Native iOS behavior** and **Native Android behavior** field for every screen in §4.
Behaviors reference this registry:

**iOS registry** — `iOS-POP` interactive edge-swipe pop · `iOS-MODAL` sheet present + grabber ·
`iOS-LARGE` large-title list root · `iOS-HAPTIC` Taptic (§5.7) · `iOS-LIVE` Live Activity / Dynamic
Island · `iOS-CAM` AVFoundation (expo-camera) · `iOS-MAP` Apple Maps · `iOS-AUTOFILL` OTP/contact
autofill · `iOS-KB` keyboard-avoid.
**Android registry** — `AND-BACK` predictive back + shared-axis preview · `AND-RIPPLE` bounded ripple ·
`AND-M3` Material-3 surfaces/nav · `AND-NOTIF` channels + ongoing notification · `AND-CAM` CameraX ·
`AND-MAP` Google Maps · `AND-SMS` SMS-Retriever autofill · `AND-INSET` edge-to-edge insets/cutout.

| Screen | iOS | Android |
|---|---|---|
| Splash | `iOS-HAPTIC`(none); status bar hidden, native→JS handoff | `AND-INSET`; splash-screen API handoff |
| Onboarding | `iOS-POP` off; paged | `AND-BACK` exits to system; paged |
| Login/Register/Verify | `iOS-AUTOFILL`,`iOS-KB`,`iOS-HAPTIC` | `AND-SMS`,`AND-RIPPLE`,`AND-INSET` |
| Home | `iOS-LARGE` optional,`iOS-HAPTIC` | `AND-M3`,`AND-RIPPLE`,`AND-NOTIF`(badges) |
| Global Search | `iOS-MODAL`,`iOS-CAM`,`iOS-KB` | `AND-CAM`,`AND-BACK`,`AND-RIPPLE` |
| Product | `iOS-POP`,`iOS-HAPTIC`(add) | `AND-BACK`,`AND-RIPPLE`,`AND-M3` |
| Meds hub | `iOS-POP`,`iOS-HAPTIC`(segment) | `AND-BACK`,`AND-M3`(tabs),`AND-RIPPLE` |
| Rx Scan | `iOS-CAM`,`iOS-MODAL`,`iOS-HAPTIC` | `AND-CAM`,`AND-BACK`,`AND-INSET` |
| Rx Detail | `iOS-POP`,`iOS-HAPTIC` | `AND-BACK`,`AND-RIPPLE` |
| Rx Refill | `iOS-MODAL`(slot),`iOS-HAPTIC`,`iOS-KB` | `AND-BACK`,`AND-RIPPLE` |
| Cart | `iOS-MODAL`(sheet),`iOS-HAPTIC` | `AND-BACK`(dismiss),`AND-RIPPLE` |
| Checkout/Payment | `iOS-KB`,`iOS-HAPTIC`,`iOS-MODAL`(pickers) | `AND-BACK`(step-guard),`AND-RIPPLE`,`AND-M3` |
| Orders | `iOS-POP`,`iOS-HAPTIC` | `AND-BACK`,`AND-RIPPLE` |
| Order Tracking | `iOS-LIVE`(out-for-delivery),`iOS-MAP`,`iOS-POP` | `AND-NOTIF`(ongoing),`AND-MAP`,`AND-BACK` |
| Loyalty Hub | `iOS-POP`,`iOS-HAPTIC`(redeem) | `AND-BACK`,`AND-RIPPLE`,`AND-M3` |
| Profile | `iOS-POP`,`iOS-LARGE` | `AND-BACK`,`AND-RIPPLE`,`AND-M3` |
| Settings | `iOS-POP`,`iOS-HAPTIC`(toggle) | `AND-BACK`,`AND-RIPPLE`; theme/locale reflow |
| Notifications | `iOS-POP`; swipe actions | `AND-BACK`,`AND-NOTIF`,`AND-RIPPLE`; swipe actions |
| Help | `iOS-POP`,`iOS-MODAL`(chat) | `AND-BACK`,`AND-RIPPLE` |
| Utility/content | `iOS-POP`,`iOS-KB`(forms) | `AND-BACK`,`AND-RIPPLE`,`AND-INSET` |

All screens additionally honor `iOS-HAPTIC`/§5.7 on their primary action and the RTL rules of §2.7.

---

## 5. Complete Design System (implementation-ready)

### 5.1 Colors — `kit.color.*`
| Token | Light | Dark (target) | Usage rule |
|---|---|---|---|
| `canvas` | `#F6F8FB` | `#0B0F14` | App background only |
| `surface` | `#FFFFFF` | `#141A21` | Cards, sheets, bars |
| `well` | `#EFF3F8` | `#1C242D` | Sunken inputs/image stages |
| `ink` | `#0A1220` | `#EAF0F6` | Primary text, primary button bg, selected |
| `inkSoft` | `#4A5568` | `#A9B4C2` | Secondary text |
| `inkFaint` | `#5E6A7C` | `#7C8898` | Tertiary text / placeholder / disabled (AA ≥ 4.5:1) |
| `line` | `rgba(10,18,32,.07)` | `rgba(255,255,255,.09)` | Hairline separators |
| `lineStrong` | `rgba(10,18,32,.14)` | `rgba(255,255,255,.18)` | Focused control border |
| `accent` | `#0E7E74` | `#2CCCBD` | THE accent — selection + meaning, sparingly |
| `accentDeep` | `#0A5F58` | `#0A5F58` | Pressed / gradient-deep |
| `accentTint` | `#E6F4F2` | `rgba(44,204,189,.14)` | Tinted accent fills (secondary btn) |
| `success`/`Tint` | `#15803D`/`#EAF7EF` | brighten +1 | Positive status |
| `warn`/`Tint` | `#B45309`/`#FEF3E2` | brighten +1 | Caution |
| `danger`/`Tint` | `#B3261E`/`#FCEEED` | brighten +1 | Destructive/error |
| `onInk` | `#FFFFFF` | `#0A1220` | Text/icon on ink/accent |

**Rules:** never use raw hex in components — token only. One accent per screen. No gradient fills
except the splash. Status color always paired with icon + text.

### 5.2 Typography — Cairo, `kit.type.*`
Families: `Cairo_400Regular` `Cairo_600SemiBold` `Cairo_700Bold` `Cairo_800ExtraBold` `Cairo_900Black` (no 500).

| Token | Size/Line | Weight | Usage |
|---|---|---|---|
| `display` | 32 / 42 | 900 Black | One per screen — hero title |
| `title` | 22 / 30 | 900 Black | Section/sheet title |
| `heading` | 16 / 24 | 700 Bold | Card title, list header |
| `body` | 14 / 22 | 400 Regular | Running copy |
| `label` | 12 / 18 | 700 Bold | Buttons, chips, eyebrows |
| `micro` | 10 / 15 | 700 Bold | Badges, captions |

**Rules:** `includeFontPadding:false`; never letter-space Arabic; hierarchy via weight+color, not
size proliferation; `maxFontSizeMultiplier` ≥ 1.4 on body/medical text, reflow not truncate.

### 5.3 Spacing — `kit.sp(n) = n*4`
Scale steps: 4,8,12,16,20,24,32,40,48,64. Page padding `pagePaddingH = 20`. Section rhythm `sp(6)=24`
between blocks, `sp(8)=32` between major sections. Touch target min 44.

### 5.4 Radius — `kit.radius.*`
`control 14` (inputs/buttons) · `card 20` · `sheet 28` (`layout.bottomSheetRadius`) · `pill 999`
(chips/badges/segmented) · brand mark squircle ratio `0.24`.

### 5.5 Elevation — `kit.shadow.*`
| Token | Offset | Opacity | Radius | Elev | Usage |
|---|---|---|---|---|---|
| `raised` | 0,2 | .06 | 10 | 2 | Resting cards, primary button |
| `floating` | 0,12 | .10 | 28 | 8 | Sheets, search pill, FAB |
Dark mode: elevation = surface lightening + `line` border, not shadow.

### 5.6 Motion tokens — `theme.animation.*` (see §7 for application)
Durations: `instant 80 · fast 150 · normal 250 · slow 380 · verySlow 600`.
Springs: `snappy{18,400,.8} · default{16,280,1} · gentle{20,180,1.2} · bouncy{10,320,.9} · stiff{24,500,.7} · press{22,420,.7}`.
Easings: `standard[.2,0,0,1] · decelerate[0,0,.2,1] · accelerate[.4,0,1,1] · sharp[.4,0,.6,1] · smoothOut[.32,.72,0,1] · emphasize[.16,1,.3,1]`.

### 5.7 Haptics — `H-*` (expo-haptics)
| Token | API | Trigger |
|---|---|---|
| `H-SELECT` | `selectionAsync` | tab switch, toggle, chip, stepper, segment |
| `H-IMPACT-LIGHT` | `impactAsync(Light)` | primary button press |
| `H-IMPACT-MED` | `impactAsync(Medium)` | add to cart, refill confirm |
| `H-SUCCESS` | `notificationAsync(Success)` | order placed, payment ok, Rx saved, points earned |
| `H-WARN` | `notificationAsync(Warning)` | interaction detected, low stock |
| `H-ERROR` | `notificationAsync(Error)` | failed payment, validation |
**Rule:** one haptic per discrete user-meaningful event; `Platform.OS !== "web"` guard; Android maps lighter.

---

## 6. Complete Component Inventory

Per component: **Purpose · Anatomy · Variants · States · A11y · Motion · Native · Acceptance.**
Source of truth = `@/shared/kit` + `@/shared/ui`; legacy `components/ui/*` is being retired into these.

### 6.0 Behavior contracts (the **Behavior** field for every component)
| Component | Behavior contract |
|---|---|
| Button | blocks re-entrancy while `loading`; press fires once; disabled swallows press; spring returns on press-out |
| IconButton | single-fire; disabled no-op; min 44 hit area |
| Input/Field | controlled value; validate on blur + on submit; error clears on edit; numeric/OTP enforce length + auto-advance |
| GlobalSearch | debounce ≤250 ms; cancel in-flight on new query; scan/voice feed the same query pipe; results virtualized |
| Card | pressable variant fires once + lifts; non-pressable inert |
| ProductCard | memoized; add disabled when OOS/Rx-gated; add fires fly-to-bag once |
| RxCard | memo on (prescription,variant); refill disabled when `expired`; status drives pill |
| OrderCard | tap→tracking; status drives pill; reorder via context |
| StatusPill | pure render from status enum; no interaction |
| Stepper | clamps [min,max]; disables ± at bounds; long-press repeat optional; emits on change |
| SegmentedControl | one active; tap switches + slides indicator; ignores tap on active |
| Sheet | one-at-a-time; pan/scrim dismiss (guarded for destructive); keyboard-aware; restores focus |
| EmptyState | always renders exactly one primary action |
| ErrorState/Boundary | inline retry re-runs the failed query; full variant only on unrecoverable; never alert-blocks recoverable |
| Skeleton | matches final layout dims; shimmer loop; auto-replaced on data; hidden from a11y |
| Toast | queue, auto-dismiss 2.5 s, swipe-dismiss, non-blocking |
| ProgressRing/Bar | animates to value; exposes numeric value; never color-only |
| ProfileSwitcher | switching re-scopes Meds/reminders/interactions; persists selection |
| OrderTimeline/LiveTracker | nodes advance on status; marker interpolates; degrades to timeline-only without geo |
| InteractionBanner | severe → blocking confirm before proceed; Add-anyway de-emphasized (ghost) |

### 6.1 Button — `kit/Button`
- **Purpose** the single strongest (or supportive) action.
- **Anatomy** pill container · optional leading/trailing icon · label · optional spinner.
- **Variants** `primary`(ink) · `secondary`(accentTint) · `ghost`(text) · `danger`(dangerTint).
- **States** default · pressed(scale .97) · disabled(well/inkFaint) · loading(spinner, blocked).
- **A11y** role button; label = visible or `accessibilityLabel`; `state.disabled`/`busy`; ≥44 via hitSlop on sm.
- **Motion** `PressableScale` spring `press`; reduced-motion aware.
- **Native** `H-IMPACT-LIGHT` on press (caller).
- **Acceptance** sizes lg54/md46/sm38; `full` stretches; icon respects RTL start/end; loading hides label + disables; never renders raw hex.

### 6.2 IconButton — `kit/Button`
- **Purpose** chrome action (back, filter, close, bag).
- **Anatomy** circular hairline (or filled ink) + glyph.
- **Variants** `surface` (hairline) · `ink` (filled).
- **States** default · pressed(.92) · disabled.
- **A11y** required `accessibilityLabel`; 44 default.
- **Motion** scale spring. **Native** optional `H-SELECT`.
- **Acceptance** glyph = 42% of size; RTL-safe; ≥44.

### 6.3 Input / Field — (`components/ui/Input` → kit-aligned)
- **Purpose** text/number entry.
- **Anatomy** label · field(well bg, line border) · leading icon · trailing affordance · helper/error.
- **Variants** text · numeric/OTP · search · multiline.
- **States** default · focus(lineStrong + `brandGlow`) · filled · error(danger + msg) · disabled.
- **A11y** label association; `accessibilityLabel`+`hint`; error `liveRegion`; Dynamic Type.
- **Motion** focus ring fade; error shake (`M-ERROR`).
- **Native** correct `keyboardType`/`textContentType` (OTP autofill, tel); RTL text align start.
- **Acceptance** height 52; 44 target; never color-only error.

### 6.4 GlobalSearch — (new, wraps Input)
- **Purpose** intent-aware search entry + results host.
- **Anatomy** field + camera + mic; results FlashList; chips.
- **Variants** entry-pill (in headers) · full modal.
- **States** empty(chips) · typing(debounced) · results · no-results · scanning.
- **A11y** field labeled; results announce name/price/stock/safety; scan/mic labeled.
- **Motion** modal `M-MODAL`; results `M-LIST-IN`.
- **Native** camera (`expo-camera`)+ML Kit OCR; voice dictation.
- **Acceptance** debounce ≤ 250 ms; FlashList virtualized; RTL.

### 6.5 Card — `shared/ui/Card`
- **Purpose** content container.
- **Anatomy** surface + radius `card` + optional `raised` + padding.
- **Variants** flat · raised · accent-tinted.
- **States** static · pressable(lift). **A11y** group; pressable→button.
- **Motion** press lift (`cardLifted`). **Native** —.
- **Acceptance** uses tokens; no nested heavy shadows.

### 6.6 ProductCard — `components/ProductCard`
- **Purpose** product cell.
- **Anatomy** image · name · price · badge(hot/new) · stock · add affordance.
- **Variants** grid · horizontal-rail(fixed 162).
- **States** default · pressed · OOS(disabled add) · Rx-required(badge).
- **A11y** labeled name+price+stock; add labeled.
- **Motion** image shared-element to detail; add fly-to-bag.
- **Native** `H-IMPACT-MED` on add.
- **Acceptance** memoized; stable onPress; RTL.

### 6.7 RxCard — `shared/components/RxCard`
- **Purpose** prescription summary.
- **Anatomy** med icon · name · dose/doctor · `StatusPill` · next-refill · Refill button.
- **Variants** `active`(hero, full CTA) · `list`(row, secondary CTA).
- **States** by `RxStatus`: ready·active·expiring·expired(disabled refill).
- **A11y** name+status label; status text+icon; refill labeled.
- **Motion** status change; refill `H-IMPACT-MED`.
- **Acceptance** memo comparator (prescription+variant); kit Button; no dead status branches.

### 6.8 OrderCard — `features/orders/.../OrderCard`
- **Purpose** order summary + status.
- **Anatomy** id/date · `StatusPill` · item summary · total · chevron.
- **Variants** active(live) · past.
- **States** by order status (placed→delivered).
- **A11y** id+status+total label. **Motion** pill transition.
- **Acceptance** status text+icon; reorder action.

### 6.9 StatusPill — (new, generalized)
- **Purpose** encode status (Rx/order/stock).
- **Anatomy** tinted pill + icon + label.
- **Variants** success·neutral·warning·error (maps `STATUS_TONE`).
- **States** static. **A11y** label includes status word (not color-only).
- **Acceptance** tint+strong-color pair from tokens; icon mandatory.

### 6.10 Stepper — (new)
- **Purpose** quantity control.
- **Anatomy** − · value · + .
- **States** default · min(−disabled) · max(+disabled).
- **A11y** ± labeled ("decrease/increase quantity"); value announced.
- **Motion** value tick; `H-SELECT`. **Acceptance** ≥44 targets; clamps.

### 6.11 SegmentedControl — (new)
- **Purpose** local section switch (Meds, Orders, Loyalty).
- **Anatomy** pill track + segments + sliding indicator.
- **States** per-segment selected. **A11y** `tablist`/`tab`+selected.
- **Motion** indicator slide `M-EMPHASIZE`; `H-SELECT`. **Acceptance** RTL order; ≥44.

### 6.12 Sheet — `AppSheet` / `@gorhom/bottom-sheet`
- **Purpose** contextual surface (cart, pickers, actions).
- **Anatomy** handle · content · optional footer action.
- **Variants** detented(half/full) · action-sheet · centered-dialog.
- **States** open/closed/dragging. **A11y** focus trap; scrim dismiss labeled; `accessibilityViewIsModal`.
- **Motion** `M-SHEET` rise/settle; scrim fade. **Native** drag, scrim, Android back dismiss.
- **Acceptance** radius 28; safe-area footer; reduced-motion respects.

### 6.13 EmptyState — `components/ui/EmptyState`
- **Purpose** `E-EMPTY` pattern. **Anatomy** icon/illus · title · body · primary action.
- **A11y** heading + actionable. **Acceptance** always one action; context copy; never bare.

### 6.14 ErrorState / ErrorBoundary — `shared/components/ErrorBoundary`
- **Purpose** `X-INLINE`/`X-FULL`. **Variants** inline row · full screen.
- **Anatomy** icon · message · retry · (full) contact pharmacy.
- **A11y** `liveRegion` announce; retry 44. **Acceptance** no blocking alert for recoverable.

### 6.15 Skeleton — `components/ui/Skeleton`
- **Purpose** `L-SKEL`. **Anatomy** shimmering token-shaped blocks matching final layout.
- **Motion** subtle shimmer; stagger ≤2. **A11y** `accessibilityElementsHidden`; announce "loading".
- **Acceptance** matches real layout dimensions; no spinner-for-content.

### 6.16 Toast — (new)
- **Purpose** transient confirm (add-to-cart, copy, synced).
- **Anatomy** icon · message · optional action.
- **A11y** `liveRegion polite`; non-blocking. **Motion** slide-in/out. **Acceptance** auto-dismiss 2.5 s; queue.

### 6.17 ProgressRing/Bar — (new)
- **Purpose** tier progress, upload, step progress.
- **A11y** text value alongside; `accessibilityValue`. **Motion** fill `M-EMPHASIZE`. **Acceptance** value never color-only.

### 6.18 ProfileSwitcher — (new, wraps `dependents`)
- **Purpose** switch active member (scopes Meds).
- **Anatomy** avatar row + add member.
- **A11y** announces "viewing meds for {name}". **Motion** content cross-fade; `H-SELECT`.
- **Acceptance** scopes Rx/reminders/interactions; persists selection.

### 6.19 OrderTimeline + LiveTracker — (new)
- **Purpose** order status timeline + live map.
- **Anatomy** vertical node list + `react-native-maps` + ETA.
- **A11y** ordered list; map text alternative; status `liveRegion`.
- **Motion** node advance; marker interpolate. **Native** Live Activity / ongoing notification mirror.
- **Acceptance** degrades to timeline-only without geo (`P-FALLBACK`).

### 6.20 InteractionBanner — `shared/components/InteractionBanner`
- **Purpose** drug-interaction safety surface.
- **Variants** card · full(actions). **States** mild·moderate·severe (tone map).
- **Anatomy** severity strip · drug-pair · summary/detail/watch-list · actions(Ask pharmacist/Cancel/Add-anyway).
- **A11y** severity in text; actions labeled; **Add-anyway de-emphasized (ghost)**.
- **Acceptance** kit Button; severe = blocking dialog before proceed.

---

## 7. Complete Motion System (implementation-level)

All values from §5.6. Reanimated 4 + worklets. Global rule: every entrance checks
`useReducedMotion()` → `M-REDUCED` (opacity only, no translate/scale).

| Token | Spec |
|---|---|
| `M-PAGE` (push/pop) | iOS native slide + parallax + interactive pop; Android shared-axis X 300 ms `emphasize` + predictive-back. RTL mirror. |
| `M-MODAL` | present: translateY 100%→0, `smoothOut`, 380 ms; dismiss 250 ms `accelerate`; scrim 0→.5. |
| `M-SHEET` | gorhom detents; rise `smoothOut`; spring settle `gentle`; scrim fade 250 ms. |
| `M-TAB` | content cross-fade 150 ms; indicator spring `{22,320,.7}`; icon scale .88→1.06, lift −2; `H-SELECT`. |
| `M-SHARED` | splash logo→Home logo; product image→detail; Rx card→detail. Reanimated shared transitions; match size+position; 380 ms `emphasize`. |
| `M-LIST-IN` | fade+translateY 8→0, 250 ms `decelerate`, **stagger ≤2** then static. |
| `M-EMPHASIZE` | attention shifts (segment, step, ring, accordion) `emphasize`, 250–380 ms. |
| `M-SUCCESS` | checkmark stroke draw 380 ms + container scale .96→1 spring `default`; `H-SUCCESS`; **no confetti**. |
| `M-ERROR` | translateX shake ±6 → 0, one cycle 150 ms `sharp`; `H-ERROR`; inline message fade-in. |
| `M-LOAD` | skeleton shimmer loop 1200 ms linear; pull-refresh accent tint; `L-OVERLAY` fade 200 ms. |
| `M-PRESS` | `PressableScale` spring `press` to .97 (.92 icon). |
| `M-SPLASH` | native→brand reveal (logo spring `{18,140,1}`, rings delayed spring, wordmark `gentle`)→video→`M-SHARED` handoff; reduced-motion fades (already implemented). |
| `M-REDUCED` | global: opacity-only, durations halved, no spring overshoot. |

Performance: animations on UI thread (worklets); no JS-driven layout animations on lists; avoid
simultaneous >2 entrance animations at cold start (home contract).

---

## 8. Complete Accessibility Framework (enforceable)

| Domain | Rule (pass/fail) |
|---|---|
| **WCAG** | AA minimum app-wide; AAA for body/medical text where practical. Text contrast ≥ 4.5:1 (large ≥ 3:1); UI/icon ≥ 3:1. CI lint flags any token pair below threshold (e.g. old `inkFaint` would fail). |
| **RTL** | All layouts via `flexRow(isRtl())`/`textAlignStart`; no hard-coded left/right; chevrons flip; gesture/transition directions mirror; verified under `I18nManager.isRTL`. |
| **Dynamic Type** | All text scales with OS; `maxFontSizeMultiplier` ≥ 1.4 on body & medical strings; layouts reflow (wrap/scroll), **truncation of dose/qty/refill/price is a defect**. |
| **Screen-reader order** | Logical, urgency-first (Home: needs-you before commerce); decorative hidden (`accessibilityElementsHidden`/`importantForAccessibility`); status as text not color; live regions for async status (order, OTP, errors). |
| **Touch targets** | ≥ 44×44 (hitSlop where visual < 44); spacing ≥ 8 between adjacent targets. |
| **Reduced motion** | `useReducedMotion()` → `M-REDUCED` everywhere; no parallax/shared-element travel; splash already compliant. |
| **Reduced transparency** | blur/glass surfaces fall back to solid `surface`; scrims to higher opacity solid. |
| **Color independence** | every semantic state pairs color with icon + text; passes grayscale review. |
| **Labels** | every interactive element has `accessibilityRole` + label; icon-only controls require explicit label; forms associate label+error+hint. |

Enforcement: a11y lint in CI; manual VoiceOver + TalkBack pass per screen in QA; RTL snapshot tests;
contrast unit test over the token table.

---

## 9. Complete Native Implementation Blueprint

### 9.1 iOS
- **Navigation** native stack (`react-native-screens`); interactive edge-swipe pop; large-title
  optional on list roots; modal sheets with grabber; tab bar = system blur-capable but solid (Clinical Calm).
- **Haptics** full Taptic per §5.7 (`H-*`); selection feedback on pickers/segments.
- **Gestures** edge-swipe back; sheet drag detents; pull-to-refresh; long-press quick actions (peek).
- **Dynamic Island / Live Activities** **Order out-for-delivery** → Live Activity (status + ETA) +
  Dynamic Island compact (courier icon + ETA) / expanded (mini map + stage); **refill ready for pickup**
  → Live Activity. Start on order dispatch, end on delivered.
- **Other** Wallet pass for loyalty (future); Siri shortcut "refill {med}" (future); widgets: next refill / active order.

### 9.2 Android
- **Predictive back** enabled (`android:enableOnBackInvokedCallback=true`); shared-axis back preview;
  hardware/gesture back maps pop→dismiss-sheet→close-modal.
- **Material 3** navigation bar styling for the tab bar; ripple on pressables (bounded);
  Material dynamic-color **not** adopted (brand integrity — fixed teal); elevation via shadow tokens.
- **Adaptive layouts** content max-width `480` centering on tablets/foldables; two-pane (list+detail)
  on ≥ 600dp for Meds/Orders (future); respect display cutouts + insets.
- **Notifications** channels: Orders, Refill reminders (high, with quiet hours), Offers (low);
  ongoing notification mirrors order tracking; refill reminders are full-screen-intent-free, respectful;
  inline actions ("Refill", "Snooze").

### 9.3 Expo architecture
- **Routing** expo-router file-based; groups `(auth)`/`(tabs)`; modals via `presentation:"modal"`;
  typed routes.
- **State** server state = TanStack Query (+ persist via MMKV/AsyncStorage, already wired); client/UI
  state = Zustand (`cart`, `prescriptionsStore`, app sheet); i18n via i18next with RTL bootstrap.
- **Data/offline** Query persistence for catalog, Rx list, orders → readable offline; NetInfo drives
  `O-BANNER`; **mutations (refill, order, add-dependent) queue** with optimistic UI where safe and a
  clear "will send when online" state; writes that must be live (payment) are blocked offline with reason.
- **Performance budgets** cold start TTI < 2.5 s after splash; list scroll 60 fps via FlashList
  (no `inverted`; RTL handled by OS); ≤ 2 staggered entrance animations at cold start; images via
  `expo-image` (bundled = sync, remote = cached); avoid scroll-linked JS bridge work.
- **Build/quality** `tsc --noEmit` clean (native); no-console lint; patch-package for native fixes;
  EAS build; per-screen VoiceOver/TalkBack + RTL QA gate before release.

### 9.4 Testing implications
- **Unit (Jest):** token contrast test over the §5.1 table (the old `inkFaint` value must fail);
  cart/price math; `RxStatus`→`STATUS_TONE` map; OCR field parser; zustand stores (`cart`,
  `prescriptionsStore`); Query selectors.
- **Component (RNTL):** render each §6 component across States (default/disabled/loading/error/empty);
  assert a11y role+label present; RTL snapshot; Dynamic-Type (xxl) snapshot.
- **Integration:** mocked-Supabase journey tests — auth, scan→review→save, refill→order,
  cart→checkout→order, apply-insurance.
- **E2E (Detox or Maestro):** the 11 journeys of §3 on iOS + Android, including guest + RTL locale.
- **Visual regression:** RTL, Dynamic Type 1.4×, and dark-mode snapshots per screen.
- **Performance:** assert cold-start TTI < 2.5 s; list 60 fps; **≤ 2 cold-start entrance animations**;
  bundle-size budget (existing `bundle-check`).
- **Accessibility:** automated a11y lint + manual VoiceOver/TalkBack pass per screen.

### 9.5 QA acceptance criteria (release gate — all must pass)
1. `tsc --noEmit` clean (native) and no-console lint passes.
2. All 11 §3 journeys pass on iOS + Android, guest and authenticated.
3. Every interactive element has role + label; icon-only controls have explicit labels.
4. Contrast: every §5.1 text pair ≥ 4.5:1 (UI ≥ 3:1).
5. RTL parity: no clipped Arabic glyphs; nav/gestures/chevrons mirrored; no `inverted` lists.
6. Dynamic Type to 1.4×: no truncation of dose/qty/refill/price (medical-text defect class).
7. Reduced-motion: all transitions fall back to `M-REDUCED`; splash compliant.
8. Offline: `O-BANNER` shows; reads from cache; mutations queue or block with a stated reason;
   payment blocked offline with reason.
9. Android predictive-back verified on every stack + sheet/modal dismiss order.
10. iOS Live Activity / Dynamic Island starts on dispatch, ends on delivered.
11. Splash→Home shared-element handoff with no opacity flash or size pop.
12. Lists hold 60 fps; crash-free sessions ≥ 99.5%.

---

*End of blueprint. Every existing route (§1.9) is preserved; every screen, component, motion, and
native behavior above is specified against the real `kit` tokens and Expo stack so design,
engineering, QA, and PM can proceed without further strategic input.*
