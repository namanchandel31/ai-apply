## Log (newest first)

### 2026-06-22 — Close button hover-only background
- **Prompt:** Default close X grey with no bg; on hover show 44×44 grey circle and black X.
- **Outcome:** close-btn transparent by default; hover shows muted background + foreground icon color.

### 2026-06-22 — Close X icon 28px
- **Prompt:** Make the X icon 28×28.
- **Outcome:** close-icon size updated to 28×28px.

### 2026-06-22 — Close button 44px
- **Prompt:** Make close button 44×44 instead of 32×32.
- **Outcome:** close-btn size updated to 44×44px.

### 2026-06-22 — Close X icon 24px
- **Prompt:** Make the X icon in the close button 24×24.
- **Outcome:** close-icon size updated to 24×24px.

### 2026-06-22 — Remove current plan from extension popup
- **Prompt:** Remove the current plan section from extension popup.
- **Outcome:** Removed plan card from popup.html; cleaned popup.js and plan CSS.

### 2026-06-22 — Close button 32px
- **Prompt:** Make close icon 32 by 32.
- **Outcome:** close-btn size updated to 32×32px.

### 2026-06-22 — Extension popup close button
- **Prompt:** Add circular grey close (X) button to the right of OneTap logo in header.
- **Outcome:** Header close-btn closes injected panel via postMessage; v0.2.3.

### 2026-06-22 — Connected status at bottom of popup
- **Prompt:** Reposition Connected at the bottom.
- **Outcome:** Moved status row below plan/toggle in connected view; centered at bottom; v0.2.2.

### 2026-06-22 — Extension popup vertical center (360px panel)
- **Prompt:** Contents should be vertically center aligned.
- **Outcome:** Fixed 360px embedded panel; html/body flex justify-content center; iframe height locked; v0.2.1.

### 2026-06-22 — Extension popup fit content height
- **Prompt:** Disconnect gone but panel still top-aligned with empty bottom space.
- **Outcome:** Removed fixed 400px panel; iframe resizes to content height so panel hugs content; v0.2.0.

### 2026-06-22 — Remove disconnect from extension popup
- **Prompt:** Remove the disconnect button from the extension popup.
- **Outcome:** Removed disconnect button from popup.html and popup.js handler.

### 2026-06-22 — Extension popup vertical center (fix)
- **Prompt:** Vertical center still not visible after prior change.
- **Outcome:** Set embedded flag in inline head script; fixed 400px panel/body height; body flex align-items center; stop iframe shrink; v0.1.9.

### 2026-06-22 — Extension popup vertical center
- **Prompt:** Vertically center popup content and elements.
- **Outcome:** Embedded shell uses flex center; min panel height 400px; connected view column centered; v0.1.8.

### 2026-06-22 — Fix extension panel toggle on icon click
- **Prompt:** Extension panel sometimes doesn't appear after first click.
- **Outcome:** Removed toggle-close on icon click; icon always opens panel; persistent page controller via sendMessage; v0.1.7.

### 2026-06-22 — Extension popup 16px via injected panel
- **Prompt:** Still no visible 16px corner radius on extension popup after CSS change.
- **Outcome:** Replaced default_popup with toolbar click → injected floating panel (16px radius + shadow); iframe resize messaging; v0.1.6.

### 2026-06-22 — Extension popup 16px corner radius
- **Prompt:** Extension popup should have 16px corner radius.
- **Outcome:** Outer popup clip on html only (--popup-radius: 16px); removed redundant shell/body radius; bump v0.1.5.

### 2026-06-22 — Fix Connect Extension ID mismatch guidance
- **Prompt:** Connect Extension fails with "extension not installed" despite install.
- **Outcome:** Logs confirmed env targets hnhmh… but no listener (Web Store vs local unpacked ID). Clearer error, dev setup panel, local Load unpacked instructions on settings page.

### 2026-06-22 — Debug Connect Extension failure
- **Prompt:** Connect Extension errors with "extension not installed or disabled" despite install.
- **Outcome:** Added runtime instrumentation to extensionBridge/settingsExtension to capture extension ID, origin, and Chrome lastError.

### 2026-06-22 — Extension install link font size
- **Prompt:** Make "Don't have the extension yet? Install from the Chrome Web Store" 14px.
- **Outcome:** Switched install helper copy from text-sm (12px) to text-base (14px).

### 2026-06-22 — Simplify extension settings page
- **Prompt:** Remove two-step install/connect on profile extension page; one Connect button + install link below.
- **Outcome:** settingsExtension.tsx is a single card with primary Connect Extension CTA and Chrome Web Store install link.

### 2026-06-22 — Recommended chip absolute on plan cards
- **Prompt:** Absolute-position Recommended chip so plan titles align across cards.
- **Outcome:** Recommended badge top-right on card; titles start at same vertical position.

### 2026-06-22 — OneTap Managed AI recommended plan
- **Prompt:** Make OneTap Managed AI recommended and highlighted on subscription page.
- **Outcome:** getRecommendedPlanSlug prefers managed/onetap_llm; recommended card gets primary border/ring highlight.

### 2026-06-22 — Subscription page UX overhaul
- **Prompt:** Address subscription page critique (except trial quota on page): status model, single recommended plan, typography, CTAs, tabs, pricing copy, included-only features.
- **Outcome:** Usage-based free trial status card; Recommended badge on one plan; text-base typography; Upgrade CTAs; Plan & billing tab; / month pricing; included features only.

### 2026-06-22 — Remove trial usage from subscriptions page
- **Prompt:** Remove Free trial / Applications Sent progress block from subscription page.
- **Outcome:** Removed TrialUsageProgress from subscriptions.tsx.

### 2026-06-22 — Remove Applied from profile trial quota
- **Prompt:** Remove Applied line from profile menu free trial stats.
- **Outcome:** Dropdown shows trial total and remaining only.

### 2026-06-22 — Profile menu trial quota font size
- **Prompt:** Match trial quota lines font size to Free trial label (size only, not weight).
- **Outcome:** Trial usage lines use text-sm instead of text-xs.

### 2026-06-22 — Free trial quota in profile menu
- **Prompt:** Show trial application total, applied, and remaining in profile dropdown for free trial users.
- **Outcome:** UserMenu fetches usage quota and displays counts under Your plan when on free trial.

### 2026-06-22 — Settings page back-to-title spacing
- **Prompt:** 120px gap between back button and page title/description on settings pages.
- **Outcome:** SetupPageShell back button margin-bottom set to 120px.

### 2026-06-22 — Hide top nav on internal pages
- **Prompt:** Apply/Applications tabs should not show on profile menu internal pages; use existing back buttons.
- **Outcome:** Header nav only renders on /dashboard and /applications; hidden on setup, extension, referrals, subscriptions, admin.

### 2026-06-22 — Remove referral code section
- **Prompt:** Remove Your referral code input and related UI from referrals page.
- **Outcome:** Removed referral code block and copy handler; updated How it works bullet to invite link only.

### 2026-06-22 — Referrals How it works heading size
- **Prompt:** Bump font size of "How it works" on referrals page.
- **Outcome:** Heading updated to text-xl font-semibold.

### 2026-06-22 — Referrals page typography
- **Prompt:** Match Referrals page font sizes to onboarding card (How it works, bullets, rest).
- **Outcome:** Bumped referral card copy from text-sm/text-xs to text-base; aligned card padding with onboarding.

### 2026-06-22 — Minimal install box when extension present
- **Prompt:** When extension installed, step 1 shows only title + status; remove extra copy/version.
- **Outcome:** Installed state is title + "Extension installed" status badge only; not-installed keeps short copy + install button.

### 2026-06-22 — Connect step status row
- **Prompt:** Add single Status line (Not connected) to step 2 connect box.
- **Outcome:** Step 2 shows Status badge (Connected / Not connected) above Connect Extension button.

### 2026-06-22 — Extension settings connect box simplification
- **Prompt:** Reduce gap between boxes; step 2 should only show Connect Extension button.
- **Outcome:** space-y-8 → space-y-4; removed connection status/version rows from step 2.

### 2026-06-22 — Extension settings install detection
- **Prompt:** Replace dev-only install copy with Chrome Web Store flow; detect install status and show Install button when missing.
- **Outcome:** Step 1 pings extension for installed/not-installed, offers Install Chrome Extension + auto-detect on tab return; dev unpacked notes only in DEV. Step 2 connect disabled until installed.

### 2026-06-22 — Extension settings page typography and alignment
- **Prompt:** Bigger body text (~14px) and left-align both boxes on Chrome Extension settings page.
- **Outcome:** Removed mx-auto centering; normalized section copy and code to text-sm (14px).

### 2026-06-22 — Remove profile name editing
- **Prompt:** Remove optional name change from user profile menu.
- **Outcome:** Removed Edit profile menu item and ProfileEditSheet from UserMenu.

### 2026-06-22 — Tab-return install detection + waiting UI
- **Prompt:** Page froze after opening Web Store; proceed when user returns to tab, show install progress, and open connect tab only on detected install.
- **Outcome:** Replaced interval polling with visibilitychange/focus detection (with short SW wake retries). On return: ping → if installed open connect tab + complete onboarding (confetti); if not detected, still continue so page never freezes. Added "Waiting for installation…" button state + manual "Already installed? Continue" fallback. New event extension_installed_detected.

### 2026-06-22 — Detect install before connect page
- **Prompt:** Don’t open connect page immediately; open it only after extension install is detected.
- **Outcome:** Install now opens only Chrome Web Store, then polls extension availability and opens `/settings/extension` + completes onboarding once detected.

### 2026-06-22 — Extension install advances onboarding
- **Prompt:** After clicking Install Chrome Extension, don’t leave onboarding stuck; continue flow and open connect page.
- **Outcome:** Install now opens Chrome Web Store + Settings Extension connect page and triggers onboarding completion (confetti then dashboard).

### 2026-06-20 — Consistent onboarding step spacing
- **Prompt:** Equal heading, description, and content spacing across all three onboarding steps.
- **Outcome:** Shared layout classes in onboardingFlow; resume, email, and embedded extension use space-y-4 sections with matching headline/description spacing.

### 2026-06-20 — Extension step description copy
- **Prompt:** Change extension subheading to "Apply directly from LinkedIn posts in one click."
- **Outcome:** Updated embedded ExtensionInstallPrompt description.

### 2026-06-20 — Onboarding card heading size (xl)
- **Prompt:** Bump card headings more.
- **Outcome:** Step card h2 headings increased from text-lg to text-xl.

### 2026-06-20 — Onboarding card heading size
- **Prompt:** Bump font size for step card headings (resume, Gmail, extension) above body copy.
- **Outcome:** Card h2 headings use text-lg font-semibold instead of text-base font-medium.

### 2026-06-20 — Remove duplicate extension skip/footer
- **Prompt:** Remove skip button and footer copy below Install Chrome Extension in embedded onboarding (duplicate of bottom skip section).
- **Outcome:** Embedded ExtensionInstallPrompt shows only the install button; skip + reassurance remain in onboarding card footer.

### 2026-06-20 — Install Chrome Extension button label
- **Prompt:** Rename "Add to Chrome" to "Install Chrome Extension".
- **Outcome:** Updated ExtensionInstallPrompt primary button label.

### 2026-06-20 — Extension step font sizes
- **Prompt:** Match extension step body copy font size to skip reassurance text (text-base).
- **Outcome:** Updated embedded ExtensionInstallPrompt description, benefits, and footer from text-sm/text-xs to text-base.

### 2026-06-20 — Onboarding step indicator labels
- **Prompt:** Step 2 → Connect Gmail, step 3 → Install Extension in step indicator.
- **Outcome:** Updated ONBOARDING_STEPS labels in onboardingFlow.

### 2026-06-20 — Get Started for Free CTA label
- **Prompt:** Change website Get Started buttons to Get Started for Free.
- **Outcome:** Updated hero and nav CTA button labels.

### 2026-06-20 — Gmail skip copy wording tweak
- **Prompt:** Update skip reassurance to connect Gmail later from Settings wording.
- **Outcome:** Applied revised skip reassurance copy on email step.

### 2026-06-20 — Skip reassurance font size
- **Prompt:** Match skip reassurance font size to Gmail step body copy.
- **Outcome:** Changed skip copy from text-sm to text-base.

### 2026-06-20 — Gmail skip reassurance copy update
- **Prompt:** Update skip reassurance to optional Gmail / connect later from Settings wording.
- **Outcome:** Replaced email-step skip copy with user-provided message.

### 2026-06-20 — Skip reassurance copy near Gmail step
- **Prompt:** Add assurance copy near Skip explaining why Gmail is needed for auto-apply and that setup can wait.
- **Outcome:** Step-specific reassurance text above Skip for now on email and extension steps.

### 2026-06-20 — Remove duplicate email skip button
- **Prompt:** Remove Skip for now button below app password on Gmail step.
- **Outcome:** Dropped email-step skip button and helper text; bottom Skip for now remains.

### 2026-06-20 — Explore dashboard → Skip for now
- **Prompt:** Replace Explore Dashboard button with Skip for now.
- **Outcome:** Renamed secondary onboarding action button label.

### 2026-06-20 — Compact Gmail connect UI in onboarding
- **Prompt:** Remove Email Configuration card copy; show only Connect Gmail and App Password outline buttons.
- **Outcome:** Added EmailStatusCard compact variant for onboarding with two action buttons only.

### 2026-06-20 — Gmail welcome copy: Link → Connect
- **Prompt:** Change "Link the Gmail account…" to "Connect the Gmail account…"
- **Outcome:** Updated email step welcome subtitle wording.

### 2026-06-20 — Wider onboarding layout
- **Prompt:** Make the onboarding box wider for all three steps.
- **Outcome:** Increased onboarding container from max-w-lg to max-w-xl.

### 2026-06-20 — Gmail permission copy wording
- **Prompt:** Change permission line to "We request a send-only permission and cannot read your inbox."
- **Outcome:** Updated second paragraph wording; kept send-only phrase highlighted.

### 2026-06-20 — Gmail permission copy as second paragraph
- **Prompt:** Split send-only permission line into its own paragraph.
- **Outcome:** Gmail step now has two paragraphs: connect copy, then highlighted permission note.

### 2026-06-20 — Shorten Gmail privacy copy
- **Prompt:** Update Gmail step body to end at "we cannot read your inbox."
- **Outcome:** Trimmed permission copy; kept send-only phrase highlighted.

### 2026-06-20 — Highlight send-only permission line
- **Prompt:** Highlight "We request a send-only permission" in Gmail onboarding copy.
- **Outcome:** Emphasized that phrase with foreground font-medium styling.

### 2026-06-20 — Gmail step copy tweak
- **Prompt:** Update Gmail step body to "Gmail Account" / "own email address" wording.
- **Outcome:** Applied exact send-only permission copy user provided.

### 2026-06-20 — Gmail step send-only permission copy
- **Prompt:** Replace Gmail step body with send-only permission messaging.
- **Outcome:** Updated email step description to explain send-only access and inbox privacy.

### 2026-06-20 — Clearer Gmail onboarding copy
- **Prompt:** Second step (Gmail) copy is vague; make it simple and action-focused.
- **Outcome:** Rewrote welcome line, headline, body, and skip note for the email connection step.

### 2026-06-20 — Hide resume parsing status in onboarding
- **Prompt:** Remove "Still reading your resume in the background" and similar parsing copy from step 2.
- **Outcome:** Removed all user-facing resume parsing banners, stalled warnings, and background-processing notes; upload toast is now "Resume uploaded".

### 2026-06-20 — Remove resume dropzone hint copy
- **Prompt:** Remove "We extract skills and experience to personalize emails" from upload step.
- **Outcome:** Resume dropzone uses default PDF format hint only.

### 2026-06-20 — Extension step indicator not pre-completed
- **Prompt:** Step 3 (Extension) shows green before user reaches it; should look like other steps.
- **Outcome:** Step indicator marks extension complete only when onboarding flow is actually complete, not from stale localStorage dismiss.

### 2026-06-20 — Remove OneTap AI onboarding callout
- **Prompt:** Remove "You're on OneTap AI…" callout from resume upload step.
- **Outcome:** Dropped managed-AI banner from onboarding resume step.

### 2026-06-20 — Tighter resume step headline spacing
- **Prompt:** Reduce space between resume headline and body copy in onboarding.
- **Outcome:** Grouped headline + description with `mt-1.5` gap instead of separate `mt-5` block.

### 2026-06-20 — Onboarding layout order
- **Prompt:** Adjust position of description below welcome and step indicator.
- **Outcome:** Reordered onboarding header to Welcome → steps (1–3) → step description → action card.

### 2026-06-20 — Onboarding resume step copy
- **Prompt:** Resume upload onboarding copy is weak (e.g. "Two steps left"); redo with value-focused messaging.
- **Outcome:** Rewrote welcome, step headlines, and resume upload intro to explain why the resume matters instead of counting steps.

### 2026-06-20 — Get Started links to signup
- **Prompt:** Get Started on website should go to signup (Continue with Google), not scroll to pricing.
- **Outcome:** Hero and nav Get started CTAs now route to `/signup` instead of `#pricing`.

### 2026-06-20 — Commit and push current branch
- **Prompt:** git push and commit
- **Outcome:** Started git status/diff/log checks, then staged, committed, and pushed current branch changes.

### 2026-06-20 — Extension prompt after email skip
- **Prompt:** Skipping Gmail during onboarding skips the Chrome extension install page; it should appear whether email is connected or skipped
- **Outcome:** Persist email-step skip + extension-pending in sessionStorage; always run celebration → extension after email step resolves; pending flag overrides stale localStorage dismiss.

### 2026-06-20 — Signup, plans, and password reset
- **Prompt:** Build signup (name/email), show plan selection after submit, integrate Razorpay subscribe flow, and add forgot-password email reset.
- **Outcome:** Added Supabase email auth screens (signup/login/forgot/reset), protected `/pricing` flow with Razorpay order+verification APIs, and subscription access gating before onboarding/dashboard.

### 2026-06-20 — Extension prompt vertical buttons
- **Prompt:** Place extension step buttons vertically
- **Outcome:** Add to Chrome and Skip for now stack full-width in a column on all breakpoints.

### 2026-06-20 — Larger extension callout text
- **Prompt:** Make handwritten “Install the extension…” callout bigger
- **Outcome:** Callout font 1.125rem→1.5rem; column width 6.75rem→8.25rem.

### 2026-06-20 — Larger OneTap highlight ring
- **Prompt:** Ellipse covering button — make it slightly bigger
- **Outcome:** Increased highlight ring inset so it frames the OneTap button instead of overlapping it.

### 2026-06-20 — Card full width; callout absolute right
- **Prompt:** Restore card width/layout; move handwritten text/arrow outside via absolute positioning only
- **Outcome:** Card back to full `max-w-lg` width; callout absolutely positioned right of card, outside UI.

### 2026-06-20 — Callout right of LinkedIn card
- **Prompt:** Move install-extension text to right of card; reposition hand-drawn highlight like screenshot
- **Outcome:** Side-by-side layout: card left, Caveat callout + left-pointing arrow right; ring on OneTap button; prompt `max-w-xl`.

### 2026-06-20 — Callout text outside LinkedIn card
- **Prompt:** Move handwritten extension callout outside the post UI card
- **Outcome:** Callout + arrow sit above the card; hand-drawn ring stays on OneTap button inside.

### 2026-06-20 — OneTap button callout on LinkedIn visual
- **Prompt:** Highlight OneTap button with hand-drawn circle + handwritten note about extension on every job post
- **Outcome:** Caveat font, sketch ring + arrow + callout on `LinkedInApplyVisual` (extension prompt).

### 2026-06-20 — Remove globe icon on LinkedIn post
- **Prompt:** Remove globe/visibility icon next to post timestamp
- **Outcome:** Dropped globe icon and dot from onboarding visual and landing feed posts.

### 2026-06-20 — OneTap post button radius
- **Prompt:** Add corner radius to OneTap button on LinkedIn post visual
- **Outcome:** `m-li-post-onetap` uses explicit `12px` radius (works outside `.mindoo-site` on onboarding).

### 2026-06-20 — Wider extension LinkedIn visual
- **Prompt:** Make the extension prompt LinkedIn visual wider
- **Outcome:** Removed `max-w-[18rem]` cap so the post card spans the full prompt width.

### 2026-06-20 — Extension prompt layout reorder
- **Prompt:** Fix extension step order: heading, para, visual, bullets; static website-style LinkedIn visual
- **Outcome:** Single-column stack; `LinkedInApplyVisual` uses landing `m-li-post` styles (no animation).

### 2026-06-20 — Swap Gmail step buttons
- **Prompt:** Swap Connect Gmail and Skip for now button positions
- **Outcome:** Skip for now left/first; Connect Gmail right/second on step 3.

### 2026-06-20 — Gmail step intro typography
- **Prompt:** Step 3 intro line should match font size/color of previous onboarding steps
- **Outcome:** `text-sm` → `text-base text-muted-foreground` on Gmail intro paragraph.

### 2026-06-20 — Restore Gmail app password copy
- **Prompt:** Bring back original app-password callout copy on onboarding step 3
- **Outcome:** Restored full paragraph + padding/button sizing in the generate-password box.

### 2026-06-20 — Compact Gmail onboarding step
- **Prompt:** Step 3 copy too long; skip button below fold — tighten copy, keep skip in first viewport
- **Outcome:** Shorter intro + compact app-password box; Connect/Skip side-by-side; one-line Setup note.

### 2026-06-20 — Skippable onboarding Gmail step
- **Prompt:** Email/SMTP step skippable; clear copy for non-tech users; skip button; connect later in Setup for Auto apply
- **Outcome:** Optional step 3 with skip UI; onboarding completes after AI+resume; backend no longer requires email for `onboardingRequired`.

### 2026-06-20 — Onboarding Gmail app password link
- **Prompt:** SMTP step link buried in paragraph; make it specific and clearly placed
- **Outcome:** Dedicated callout box + full-width “Open Google App Passwords” button above the form fields.

### 2026-06-20 — Onboarding provider select placeholder
- **Prompt:** OpenAI first in provider list looked like placeholder; only Groq/Gemini supported — use “Select your model provider”
- **Outcome:** Updated onboarding `SelectValue` placeholder; sorted supported providers first; muted placeholder styling on select trigger.

### 2026-06-20 — Confirm Razorpay cleanup task completion
- **Prompt:** Perform any needed follow-up after subagent completion without repeating its result.
- **Outcome:** Added required log entry; no additional follow-up needed at this point.

### 2026-06-20 — Remove payment route crash path
- **Prompt:** Fix `Cannot find module '../routes/paymentRoutes'` from `src/api/createApp.js` and remove Razorpay remnants without touching unrelated work.
- **Outcome:** Identified unconditional payment route require as crash root cause and started focused backend/frontend cleanup plus startup verification.

### 2026-06-20 — Remove Razorpay remnants after rollback
- **Prompt:** Server crashes with `Cannot find module '../routes/paymentRoutes'`; remove everything related to Razorpay for now.
- **Outcome:** Logged the issue and started a full cleanup to remove Razorpay imports/routes and restore app startup.

### 2026-06-20 — Onboarding providers: Groq not Grok
- **Prompt:** Grok is not supported; Groq is
- **Outcome:** `AVAILABLE_PROVIDER_IDS` → gemini + groq; grok marked coming soon.

### 2026-06-20 — Onboarding model provider defaults
- **Prompt:** OpenAI was default but unsupported; placeholder “Please select a model provider”; only Gemini and Grok available; rest “Coming soon”
- **Outcome:** No default provider in onboarding; `remoteProviders` allows only gemini/grok; coming-soon on all others.

### 2026-06-20 — Nav “How it Works” link
- **Prompt:** Add “How it Works” to navigation; link to three-step setup section
- **Outcome:** Nav item scrolls to `#how-it-works` (`MindooSetupSection`); section id updated; headline → “Set up in two minutes.”

### 2026-06-20 — Scrolled nav pill padding (tighter)
- **Prompt:** Reduce scrolled nav left/right padding more
- **Outcome:** Outer inset 0.75rem→0.375rem, inner padding 1rem→0.625rem.

### 2026-06-20 — Scrolled nav pill padding
- **Prompt:** Reduce left/right padding in the navigation’s scrolled (2nd) state
- **Outcome:** Tightened scrolled pill: outer inset 1.5rem→0.75rem, inner padding 1.5rem→1rem via `--m-nav-pill-inset` / `--m-nav-pill-inner-padding`.

### 2026-06-20 — Fix extension prompt blank screen
- **Prompt:** Local server shows no content on extension install step
- **Outcome:** Replaced invalid `Chrome` lucide import (broke module load); fixed empty onboarding state when all steps complete.

### 2026-06-20 — Paid landing copy + Razorpay trust
- **Prompt:** Fix free/paid inconsistencies across site; Razorpay in pricing; remove free messaging
- **Outcome:** Hero/bottom CTAs → pricing; removed beta/free copy; setup + BYOK providers aligned; pricing Razorpay note + Subscribe CTAs; billing/payment FAQs; `#get-started` section id.

### 2026-06-20 — Post-onboarding Chrome extension prompt
- **Prompt:** After onboarding’s three steps, add a skippable Chrome extension install screen with benefits and LinkedIn Apply visual
- **Outcome:** Added `ExtensionInstallPrompt` + `LinkedInApplyVisual` after celebration; shared `CHROME_EXTENSION_URL`; skip persists via localStorage; then routes to dashboard.

### 2026-06-20 — Landing copy audit (free vs paid)
- **Prompt:** Audit whole site for free/paid inconsistencies; remove free messaging; add Razorpay trust in pricing; report conflicts first
- **Outcome:** Audited live landing + related pages; reported explicit “free” CTAs, waitlist leftovers, setup/plan mismatches, provider list drift, and missing payment flow copy.

### 2026-06-20 — Remove encrypted API keys from pricing
- **Prompt:** Remove "Encrypted API keys, never shared" from pricing
- **Outcome:** Dropped that bullet from BYOK plan features in `MindooPricingSection`.

### 2026-06-20 — Nav default state in container
- **Prompt:** Default nav content should be within container, not edge-to-edge
- **Outcome:** Default nav uses `--m-padding` + `--m-container` max-width; scrolled pill state unchanged.

### 2026-06-20 — Smooth nav scroll transition + wider pill
- **Prompt:** Nav transition jittery; scrolled pill should be wider with smooth animation between full-width and floating states
- **Outcome:** Reworked nav: wrapper padding drives pill width, links animate via transform only, pill max 68rem, removed container/padding toggles.

### 2026-06-20 — Nav links right by default, center on scroll
- **Prompt:** Default: links + sign-in far right; on scroll: links center, get started appears
- **Outcome:** Hero nav flex layout switches from right-clustered links to centered pill layout when scrolling.

### 2026-06-20 — Remove Problem from nav
- **Prompt:** Remove problem from the navigation
- **Outcome:** Dropped Problem link from `MindooNav` desktop and mobile menus.

### 2026-06-20 — Nav default state no horizontal padding
- **Prompt:** Default nav state should have no left/right padding
- **Outcome:** Removed horizontal padding from `.m-padding-global` and `.m-nav-inner` until scroll; pill state restores padding.

### 2026-06-20 — Mobbin-style fixed floating nav
- **Prompt:** Nav should stay fixed/floating and visible everywhere on page like Mobbin
- **Outcome:** Nav at page root with z-index 100; scroll-started updates on every scroll so pill + CTAs appear reliably.

### 2026-06-20 — Extension button auto width
- **Prompt:** Download Chrome extension button should be auto width, not full width
- **Outcome:** `.m-feature-row-copy .mh-hero-btn` uses `align-self: flex-start` and `width: auto`.

### 2026-06-20 — Problem last tab only (revert broad fix)
- **Prompt:** Only fix last tab Google bg + fade gradient; revert transparent-all-tabs change
- **Outcome:** Restored default inactive tab styling; only `.is-last` tab + favicon use `#dde6ef`; fade gradient reverted to original.

### 2026-06-20 — Problem browser tab color match
- **Prompt:** Last tab in problem section doesn't match toolbar background
- **Outcome:** Inactive tabs transparent; fade gradient aligned to frame; favicon bg matches toolbar/active tab.

### 2026-06-20 — Fixed landing nav
- **Prompt:** Navigation should also be fixed and sticky in nature
- **Outcome:** Switched `.m-nav-wrap` to `position: fixed`; scroll hide/show moves entire bar; pointer-events pass-through when hidden.

### 2026-06-20 — Mobbin-style landing nav
- **Prompt:** Match Mobbin nav — no buttons at top, pill + CTAs on scroll, hide on scroll down
- **Outcome:** Refactored landing nav CSS: transparent bar at top, floating pill on scroll, action buttons fade in, nav hides when scrolling down.

### 2026-06-20 — Extension button matches hero
- **Prompt:** Download Chrome extension button should match hero section
- **Outcome:** Reuses `mh-hero-btn mh-hero-btn-primary`; removed custom extension button styles.

### 2026-06-20 — Chrome extension download button
- **Prompt:** Add Download Chrome extension button in extension section with Web Store link
- **Outcome:** Added CTA linking to OneTap Chrome Web Store listing in the LinkedIn extension feature row.

### 2026-06-20 — Smooth nav scroll
- **Prompt:** Nav clicks scroll instantly; should be smooth
- **Outcome:** Nav anchors use `mindooScrollTo`; global hash click handler; smooth scroll on landing; scroll-margin for sticky nav.

### 2026-06-20 — Vend Sans for logo and nav
- **Prompt:** OneTap logo and navigation on website (and elsewhere) should use Vend Sans
- **Outcome:** `OneTapBrand` wordmark uses `font-heading`; landing nav links and app shell nav tabs use Vend Sans.

### 2026-06-20 — Remove pricing feature line
- **Prompt:** Remove No provider account or token bills from pricing
- **Outcome:** Dropped that bullet from OneTap AI plan features.

### 2026-06-20 — Footer visibility fix
- **Prompt:** I don't see any footer
- **Outcome:** Moved footer into `main` above fixed hero bg; added `z-index: 1`; spacing via section gap.

### 2026-06-20 — Tighter hero heading–paragraph gap
- **Prompt:** Reduce gap between hero heading and paragraph
- **Outcome:** Reduced `.mh-hero-intro` gap from `1.5rem` to `1rem`.

### 2026-06-20 — Setup section 200px top padding
- **Prompt:** Two minutes to set up section should have 200px top padding
- **Outcome:** Set `padding-top: 200px` on `.m-setup`.

### 2026-06-20 — Single-line site footer
- **Prompt:** Add a single-line footer at the bottom of the website
- **Outcome:** Polished `MindooFooter` (© OneTap · Privacy · Support · Sign in); border-top bar styles; removed legacy footer CSS.

### 2026-06-20 — Equal 200px section spacing
- **Prompt:** Section spacing should be equal throughout, make it 200
- **Outcome:** `--m-section-gap: 200px`; removed extra padding on problem, showcase, setup, and FAQ sections.

### 2026-06-20 — Body copy font-weight 400
- **Prompt:** Make body font weight 400 for descriptions and paragraphs sitewide
- **Outcome:** Landing `--m-body-text-weight` and base weight 400; app `body`/`p` set to 400.

### 2026-06-20 — Pricing OneTap AI feature copy
- **Prompt:** "Fastest onboarding: apply same day" is dumb
- **Outcome:** Replaced with "No provider account or token bills" on OneTap AI plan.

### 2026-06-20 — Landing green to brand blue
- **Prompt:** Pricing and everywhere on landing — replace green accent with blue
- **Outcome:** Pricing highlights, badges, feature bullets, and primary CTAs now use `#2563eb` / `#1d4ed8`.

### 2026-06-20 — FAQ de-pricing after pricing section
- **Prompt:** FAQ starting with cost question is dumb right below pricing
- **Outcome:** Removed pricing/plan duplicate questions; FAQ leads with privacy, Gmail, extension, and setup.

### 2026-06-20 — CTA button copy
- **Prompt:** CTA should be get started for free
- **Outcome:** Updated bottom CTA button to “Get started for free →”.

### 2026-06-20 — CTA section brand blue
- **Prompt:** Stop drafting applications at 11pm section — green is random, use our blue
- **Outcome:** CTA card gradient and button use brand blue `#2563eb` instead of lime green.

### 2026-06-20 — Remove em dashes from site copy
- **Prompt:** remove the em dash from whole website's copy
- **Outcome:** Replaced em dashes with commas, periods, or colons across landing, FAQ, login, onboarding, dashboard, and app UI strings.

### 2026-06-20 — FAQ label removed, extra top spacing
- **Prompt:** remove — FAQ —; add more space between faq and section above
- **Outcome:** Dropped FAQ label; added `padding-top: 4rem` on `.m-faq` above pricing gap.

### 2026-06-20 — FAQ aligned with pricing plans
- **Prompt:** update faq answers and questions based on pricing section updated
- **Outcome:** Rewrote pricing-related FAQ for ₹99 BYOK and ₹149 OneTap AI plans; removed free-beta copy.

### 2026-06-20 — Faster FAQ expand/collapse
- **Prompt:** expanding and collapsing should be faster
- **Outcome:** FAQ height transition 0.35s → 0.2s.

### 2026-06-20 — FAQ icon plus/minus
- **Prompt:** plus icon bigger; expanded becomes minus
- **Outcome:** FAQ toggle icon 1.75rem; open state shows `−` instead of rotated `+`.

### 2026-06-20 — FAQ block height animation
- **Prompt:** the height of the block should have animation
- **Outcome:** Replaced `<details>` with state-driven accordion so grid row transition animates full item height.

### 2026-06-20 — FAQ expand animation
- **Prompt:** expanding a faq is instant, it shouldn't be that way
- **Outcome:** Added grid height + opacity transition on FAQ answer body; + icon rotates to × on open.

### 2026-06-20 — Pricing two-plan update
- **Prompt:** Remove — Pricing —; 2 plans — BYOK ₹99/mo, OneTap LLM ₹149/mo; unlimited apps, differentiated benefits
- **Outcome:** Rewrote `MindooPricingSection` with Bring your own AI and OneTap AI tiers; removed pricing label.

### 2026-06-20 — Less space before setup cards
- **Prompt:** Reduce space between heading and the 3 setup cards
- **Outcome:** Reduced `.m-setup-inner` gap from `4rem` to `clamp(2rem, 4vw, 2.5rem)`.

### 2026-06-20 — Reduce setup visual height slightly
- **Prompt:** Not that much height — reduce a little
- **Outcome:** Tuned `.m-setup-visual-wrap` min-height to `clamp(15rem, 26vw, 18rem)`.

### 2026-06-20 — Setup visual height fix
- **Prompt:** Setup mockups clipped — increase height
- **Outcome:** Replaced fixed aspect-ratio with `min-height: clamp(18rem, 32vw, 22rem)` and `overflow: visible` on `.m-setup-visual-wrap`.

### 2026-06-20 — Setup step visuals
- **Prompt:** Work on visuals for the 3 setup blocks
- **Outcome:** Added `SetupStepVisual` mini mockups (model form, PDF dropzone, Gmail SMTP) replacing gradient placeholders in `MindooSetupSection`.

### 2026-06-20 — Restore upload resume description
- **Prompt:** Bring back same description copy (upload resume step)
- **Outcome:** Restored body to “Upload a PDF once. OneTap tailors every email from your experience.”

### 2026-06-20 — Simplify upload resume step
- **Prompt:** Upload résumé — make resume simple
- **Outcome:** Title is now “Upload resume”; body shortened to “PDF only. Upload once.”

### 2026-06-20 — Shorter setup card descriptions
- **Prompt:** Description text should be shorter
- **Outcome:** Trimmed each setup step body to one short sentence in `MindooSetupSection`.

### 2026-06-20 — Simpler setup card headlines
- **Prompt:** Headlines should be easy and simple; context belongs in descriptions
- **Outcome:** Shortened setup step titles to Choose model, Upload résumé, Connect Gmail; kept detailed body copy.

### 2026-06-20 — Setup section copy refresh
- **Prompt:** Update 3 setup blocks — model provider/API keys, resume formats, SMTP
- **Outcome:** Reordered steps to match onboarding; refreshed titles and body copy in `MindooSetupSection`.

### 2026-06-20 — Setup headline one line
- **Prompt:** Make Three minutes to set up. After that, one click. into one line
- **Outcome:** Removed `m-ch-20` width cap; added `.m-setup-heading` with `white-space: nowrap` on primary line.

### 2026-06-20 — More setup top padding
- **Prompt:** More top padding in Get started in minutes / Three minutes to set up section
- **Outcome:** Increased `.m-setup` padding-top to `clamp(6rem, 12vw, 12rem)`.

### 2026-06-20 — Space before setup section
- **Prompt:** Increase space between BYOK feature row and Get started in minutes setup section
- **Outcome:** Added `padding-bottom: clamp(4rem, 8vw, 8rem)` on `.m-feature-showcase`.

### 2026-06-20 — More setup section top padding
- **Prompt:** more (setup section top padding)
- **Outcome:** Increased `.m-setup` padding-top to `clamp(4rem, 8vw, 8rem)`.

### 2026-06-20 — Setup section top padding
- **Prompt:** Add top padding for Get started in minutes / Three minutes to set up section
- **Outcome:** Added `padding-top: clamp(2rem, 5vw, 4rem)` on `.m-setup`.

### 2026-06-20 — Even more feature row spacing
- **Prompt:** more (feature section gaps)
- **Outcome:** Increased `.m-feature-showcase-inner` gap to `clamp(10rem, 18vw, 16rem)`.

### 2026-06-20 — More feature row spacing
- **Prompt:** more space (between three feature sections)
- **Outcome:** Increased `.m-feature-showcase-inner` gap to `clamp(8rem, 14vw, 12rem)`.

### 2026-06-20 — Feature row spacing
- **Prompt:** More space between the three two-column feature sections (Chrome extension, tracking, privacy)
- **Outcome:** Increased `.m-feature-showcase-inner` gap to `clamp(6rem, 11vw, 9rem)`; removed extra tracking-row margin for even spacing.

### 2026-06-20 — Feature showcase top padding
- **Prompt:** Add more top padding for Apply directly from LinkedIn section
- **Outcome:** Added `padding-top: clamp(2rem, 5vw, 4rem)` on `.m-feature-showcase`.

### 2026-06-20 — Problem section top padding
- **Prompt:** Add more top padding for the problem section (Apply challenge headline)
- **Outcome:** Added `padding-top: clamp(2rem, 5vw, 4rem)` on `.m-problem`.

### 2026-06-20 — Interactive BYOK provider list
- **Prompt:** Model list should be interactable — hover and check update on click, nothing else
- **Outcome:** `ModelProviderVisual` uses local state; rows are buttons with hover/selected styles; trigger syncs on selection.

### 2026-06-20 — Scale up BYOK model visual
- **Prompt:** Make the visual slightly bigger
- **Outcome:** Increased BYOK provider dropdown max-width, type, padding, and icon sizes (~15%).

### 2026-06-20 — Merge BYOK model labels
- **Prompt:** Merge chooseModel and modelProvider into one — choose your model provider
- **Outcome:** Single label above the dropdown in `ModelProviderVisual`; removed separate heading.

### 2026-06-20 — Gemini selected in BYOK visual
- **Prompt:** make gemini checked
- **Outcome:** Default selected provider in `ModelProviderVisual` is now Gemini (trigger + checkmark).

### 2026-06-20 — BYOK check icon on right
- **Prompt:** check icon on right
- **Outcome:** Moved selected-provider checkmark to the right side of each dropdown row.

### 2026-06-20 — Remove Coming soon from BYOK list
- **Prompt:** remove the coming soon from the list
- **Outcome:** Dropped Coming soon labels and disabled styling from `ModelProviderVisual` provider rows.

### 2026-06-20 — BYOK model provider visual
- **Prompt:** Your AI. Your data. Private by default — visual like model provider dropdown; remove background box border
- **Outcome:** Added `ModelProviderVisual` (Choose Model / provider list with logos); BYOK row uses borderless transparent visual container like feed/track rows.

### 2026-06-20 — Shorter feed pause time
- **Prompt:** reduce the pause time
- **Outcome:** Feed hold segments 16%→12%, scroll 4%→3%, cycle 20s→14s (~1.7s pause per card).

### 2026-06-20 — Tracking row bottom spacing
- **Prompt:** Increase the space between Manage and track every job application and next section
- **Outcome:** Added extra `margin-bottom` on the tracking feature row via `:has(.m-feature-row-visual--track)`.

### 2026-06-20 — LinkedIn post shadow clip fix
- **Prompt:** Shadow of posts is cutting off / getting clipped
- **Outcome:** Feed visual `overflow: visible`; window uses horizontal shadow-bleed padding so box-shadows render fully.

### 2026-06-20 — Feed animation revert to pure CSS
- **Prompt:** JS scroll made feed much worse
- **Outcome:** Removed all JS animation/drift; restored CSS keyframe carousel with seamless 100%→0% loop via duplicate post set.

### 2026-06-20 — LinkedIn post card styling match
- **Prompt:** update corner radius and shadows of linkedin post visual's post as same as tracking graphic
- **Outcome:** `.m-li-post` now uses `1rem` radius and same border/shadow tokens as `.m-iso-track-panel`.

### 2026-06-20 — Tracking graphic nudge left (more)
- **Prompt:** more (shift graphic left)
- **Outcome:** Increased tracking visual `margin-left` to `-20%` desktop / `-8%` mobile.

### 2026-06-20 — Tracking graphic nudge left
- **Prompt:** send the graphic little left
- **Outcome:** Increased negative `margin-left` on tracking table visual (`-14%` desktop, `-4%` mobile).

### 2026-06-20 — Realistic tracking table data
- **Prompt:** Use realistic data in the graphic; match is zero for everything
- **Outcome:** Swapped mock rows for Stripe/Notion/Linear/etc. with varied match scores (72–91%), pipeline statuses, and timestamps.

### 2026-06-20 — Tracking visual bleed outside container
- **Prompt:** it's okay if the visual goes a little outside of the container
- **Outcome:** Widened tracking table visual (~112–118%) with negative margin on flipped row; showcase/container overflow set to visible.

### 2026-06-20 — Flat applications tracking visual
- **Prompt:** remove isomeric view, keep it normal
- **Outcome:** Removed 3D perspective/rotation from tracking table; flat front-facing panel with status popover overlay.

### 2026-06-20 — Bigger isometric tracking visual
- **Prompt:** make it bigger
- **Outcome:** Scaled up isometric table — full column width, larger type/padding, `scale(1.08)`, taller scene min-heights.

### 2026-06-20 — Seamless feed loop (JS scroll)
- **Prompt:** Feed feels like it ends and restarts; Sarah jitter; easing worse
- **Outcome:** Replaced CSS keyframe slideshow with JS rAF scroll — hold per card, ease between cards, invisible wrap via duplicate set.

### 2026-06-20 — Isometric table faces right
- **Prompt:** face it right
- **Outcome:** Flipped tracking isometric to `rotateY(16deg)` and repositioned status popover for right-facing perspective.

### 2026-06-20 — Isometric applications tracking visual
- **Prompt:** Tracking section should show isometric UI like real dashboard (role, company, status, etc.)
- **Outcome:** Added `ApplicationsIsometricVisual` with 3D-tilted applications table, status popover, and sample rows; wired into tracking feature row.

### 2026-06-20 — Sarah Chen feed jitter fix v2
- **Prompt:** Sarah Chen post still jitters when coming into view
- **Outcome:** Drift keyed by `post.id` with smooth decay (no snap-to-zero on handoff); linear scroll segments; eager avatar load on first loop set.

### 2026-06-20 — Like icon via Lucide
- **Prompt:** Like icon on posts still broken
- **Outcome:** Replaced custom thumbs-up SVG with `ThumbsUp` from `lucide-react` for action bar and reaction badge.

### 2026-06-20 — DiceBear feed avatars
- **Prompt:** Use https://www.dicebear.com/ for user avatars
- **Outcome:** Feed post avatars now load from DiceBear `notionists` style API, seeded by author name.

### 2026-06-20 — Fix feed like icon
- **Prompt:** Like icon in posts is broken — replace it
- **Outcome:** Replaced broken Like SVG and 👍 emoji with a shared `ThumbsUpIcon` for action bar and reaction badge.

### 2026-06-20 — Realistic feed profile photos
- **Prompt:** Use realistic profile pictures in LinkedIn feed posts
- **Outcome:** Added local portrait avatars in `client/public/feed-avatars/` and wired them into feed post cards.

### 2026-06-20 — Fix Sarah Chen feed jitter
- **Prompt:** Sarah Chen post animation jitters each cycle
- **Outcome:** Seamless 4-step loop duplicate; reset card drift on animation iteration; drift only on centered card.

### 2026-06-20 — White feed edge fade
- **Prompt:** Gradient should go full white to transparent so posts don't look cut off
- **Outcome:** Replaced opacity mask with white `--m-bg` overlay gradients on feed window top/bottom.

### 2026-06-20 — Softer LinkedIn feed peek fade
- **Prompt:** Top/bottom gradient fade too strong — peeking posts not visible
- **Outcome:** Shorter mask fade with 55% min visibility; removed JS opacity fade that doubled up on edges.

### 2026-06-20 — LinkedIn post viewport ease
- **Prompt:** Add ease-in when posts enter viewport and ease when leaving
- **Outcome:** Per-post opacity/translate easing in `LinkedInFeedScroll`; softer scroll timing curve.

### 2026-06-20 — Smooth LinkedIn feed card drift
- **Prompt:** Left/right card drift feels jittery — add ease like the original Beside example
- **Outcome:** Replaced discrete phase classes with continuous smoothstep drift + rAF exponential smoothing applied directly to card transforms.

### 2026-06-20 — LinkedIn feed card horizontal drift
- **Prompt:** Centered post should shift left on pause; shift right before scrolling up and out
- **Outcome:** rAF phase tracking on feed cards with `is-centered` / `is-exiting` translateX; reduced-motion skips drift.

### 2026-06-20 — LinkedIn feed content + peek-only fade
- **Prompt:** Posts need more content; paused center post should have no gradient — fade only on peeking top/bottom posts
- **Outcome:** Expanded post copy, taller cards (4-line clamp); replaced full-window fade overlays with window mask limited to peek zones.

### 2026-06-20 — Lighter body text color
- **Prompt:** Make problem lead and rest of body text slightly lighter
- **Outcome:** Updated `--m-body` to `#525252` and `--m-body-secondary` to `#666666`; closing line stays `#0d0d0d`.

### 2026-06-20 — Problem closing line black
- **Prompt:** One Tap workflow line should use full black color
- **Outcome:** Added `.m-problem-closing` with `#0d0d0d` on the final problem paragraph.

### 2026-06-20 — Problem lead above tabs
- **Prompt:** Bring first problem paragraph above the browser tabs visual
- **Outcome:** Moved lead copy above `ProblemBrowserBar`; remaining paragraphs stay below.

### 2026-06-20 — Swap cover letter and ChatGPT tabs
- **Prompt:** Replace the position of SWE cover letter and ChatGPT OpenAI tab
- **Outcome:** Swapped order of Google Docs and ChatGPT tabs in `ProblemBrowserBar`.

### 2026-06-20 — Problem tabs only + real favicons
- **Prompt:** Tabs only (no URL bar/mockup); use realistic favicons and tab data
- **Outcome:** Stripped browser chrome to tab strip; tab titles match real job-search pages; favicons loaded per domain.

### 2026-06-20 — White website background
- **Prompt:** Change website background color to white only
- **Outcome:** Landing tokens and app `--background` set to `#ffffff`; removed hero bg image/blue gradient overlay; neutral borders restored.

### 2026-06-20 — LinkedIn feed visual box removed
- **Prompt:** For "Apply directly from LinkedIn in one click", remove border and background from the HTML animation box
- **Outcome:** `.m-feature-row-visual--feed` is now borderless/transparent; scroll fades use `var(--m-bg)`.

### 2026-06-20 — Problem section browser tabs
- **Prompt:** Design a browser bar with many open tabs (email, Notion, JD, LinkedIn, etc.) for the problem section
- **Outcome:** Added `ProblemBrowserBar` with macOS-style crowded tab strip and wired it into `MindooProblemSection`.

### 2026-06-20 — Section spacing 120px
- **Prompt:** The space between each section should be 120 px
- **Outcome:** Added `--m-section-gap: 120px` on `main` flex gap; removed conflicting per-section padding and setup spacer divs.

### 2026-06-20 — Problem body full width
- **Prompt:** Paragraph/description text should take full wrapper width like the heading
- **Outcome:** Removed `36rem` and `44ch` max-width caps from `.m-problem-texts` and `.m-problem-p`.

### 2026-06-20 — Problem heading width fix
- **Prompt:** Problem headline still not breaking into two lines; parent wrapper fixed width
- **Outcome:** Removed `36rem` cap from `.m-problem-content` heading area; stacked both heading lines as blocks; moved width limit to `.m-problem-texts` only.

### 2026-06-20 — Problem heading line break
- **Prompt:** Split problem headline into two lines — first sentence on line 1, second on line 2
- **Outcome:** Stacked `SplitHeading` primary below tertiary; removed narrow `m-ch-22` cap on problem heading.

### 2026-06-20 — Body text medium weight
- **Prompt:** medium
- **Outcome:** Changed `--m-body-text-weight` from `400` to `500`.

### 2026-06-20 — Body text 15px regular
- **Prompt:** make it 15px and regular
- **Outcome:** Updated `--m-body-text-size` to `15px` and `--m-body-text-weight` to `400`.

### 2026-06-20 — Fix body text size to 14px
- **Prompt:** Body text rendered at 12px instead of 14px
- **Outcome:** Changed `--m-body-text-size` from `0.875rem` to `1rem` (14px with html root at 14px).

### 2026-06-20 — Unified landing body text class
- **Prompt:** Make all body text use the same 14px Inter style as hero lead via one controllable class
- **Outcome:** Added reusable `.m-body-text` and applied it across hero, problem, features, setup, pricing, FAQ, CTA, and footer body copy; removed conflicting per-section font-size overrides.

### 2026-06-20 — Smooth hero image merge
- **Prompt:** Make the hero image bottom blend into the website background with a linear gradient
- **Outcome:** Extended and softened the hero background gradient in `mindoo.css` so the image fades into `--m-bg` without a hard edge.

### 2026-06-20 — Hero background scroll fade
- **Prompt:** Fade hero background image when leaving hero section; restore when scrolling back
- **Outcome:** Fixed hero bg layer fades via `--hero-bg-opacity` driven by scroll position at the problem-section transition.

### 2026-06-20 — Reduce hero padding
- **Prompt:** Reduce the hero section top and stop padding a little bit.
- **Outcome:** Tightened `.mh-hero-stack-wrap` top/bottom padding in `mindoo.css`.

### 2026-06-20 — Landing container 70rem
- **Prompt:** make it 70 rem (container width)
- **Outcome:** Changed `--m-container` from `80rem` to `70rem` in `mindoo.css`.

### 2026-06-20 — Remove hero badge
- **Prompt:** Remove "Private beta · bring your own AI"
- **Outcome:** Removed badge from `HeroHeadline.tsx`.

### 2026-06-20 — Soft sky-blue background
- **Prompt:** change the beige to something soft blue like sky
- **Outcome:** Swapped beige tokens for soft sky blue (`#eff7fd` / `hsl(205 48% 95%)`) on landing and app backgrounds, with matching secondary surfaces and borders.

### 2026-06-20 — Hero video below copy again
- **Prompt:** Reposition the video at the same place where it was
- **Outcome:** Moved video back below CTAs full-width; text stays at 55% max-width in stacked hero layout.

### 2026-06-20 — Nav + hero landscape background
- **Prompt:** Use provided image as background for nav and hero, attached to top
- **Outcome:** Added `client/public/hero-bg.png` on `.mh-top-shell` with `background-position: top center`, cover sizing, and soft bottom fade into page bg.

### 2026-06-20 — Hero lead line break
- **Prompt:** “One Tap generates…” sentence should be on the second line
- **Outcome:** Split hero lead into two explicit lines with block spans.

### 2026-06-20 — Hero text column 55%
- **Prompt:** make the 65% 55
- **Outcome:** Hero grid updated to `55% / 45%` text and video columns.

### 2026-06-20 — Hero video restored + 65% text visible
- **Prompt:** Don't see layout changes; video is gone
- **Outcome:** Restored demo video in right column (35%); text column uses explicit 65% grid with full-width copy (removed 42ch cap); video stacks below on mobile.

### 2026-06-20 — Hero text column 65%
- **Prompt:** Make hero text contents width from 50% to 65%
- **Outcome:** Hero grid columns updated to `65fr / 35fr`.

### 2026-06-20 — Warmer beige background
- **Prompt:** I ask for beige color, not grey.
- **Outcome:** Retuned site background to cream beige (`#f5f0e3` / `hsl(43 42% 93%)`) with warmer secondary surfaces and tan borders on landing + app tokens.

### 2026-06-20 — Hero more top padding
- **Prompt:** Add more top padding for hero section
- **Outcome:** Increased hero `padding-top` from `clamp(4.5rem, 10vw, 7.5rem)` to `clamp(6rem, 14vw, 10rem)`.

### 2026-06-20 — Hero two-column layout
- **Prompt:** Hero text should take 50% container width — two columns, text left, empty right
- **Outcome:** Hero uses 50/50 grid; copy in left column, empty right slot; removed hero video from layout.

### 2026-06-20 — Hero rotate slot spacing fix
- **Prompt:** Rotating words clipped / next word peeking; need proper spacing in carousel viewport
- **Outcome:** Aligned `--rotate-step` with heading line-height, flex-centered word slots, taller viewport, `overflow: hidden` per word.

### 2026-06-20 — Hero rotate seamless loop
- **Prompt:** Rotation should loop continuously bottom-to-top without reversing when restarting
- **Outcome:** Cloned first word at end of track; after scrolling to duplicate, instant reset to index 0 so apply→track→manage→improve→apply loops in one direction only.

### 2026-06-20 — Button radius 12px
- **Prompt:** Make button corner radius 12px (was 8px)
- **Outcome:** Updated `--m-btn-radius` and app `Button` component to `12px`.

### 2026-06-20 — Hero rotate one-step + heading color
- **Prompt:** Rotating word should change one at a time (not jump 1→4); same color as heading not blue
- **Outcome:** Fixed carousel transform to move one `1.05em` step per index; rotating word uses `color: inherit`.

### 2026-06-20 — Hero dual CTAs + 8px button radius
- **Prompt:** Hero: Get started + Get a demo; all buttons ~8px radius not pill-shaped
- **Outcome:** Added hero action row; `--m-btn-radius: 0.5rem` on landing buttons; app `Button` uses `rounded-[8px]`.

### 2026-06-20 — Subtle beige site background
- **Prompt:** add a beige color background that is very subtle and soft to the whole website background
- **Outcome:** Shifted global `--background` and landing `--m-bg` tokens to warm off-white (`#faf8f5` / `hsl(32 24% 97%)`); aligned borders, muted surfaces, and hero shell to the same palette.

### 2026-06-20 — Hero rotating headline
- **Prompt:** Two-line hero with rotating apply/track/manage/improve like x.ai
- **Outcome:** `HeroHeadline` now shows “The fastest way to [word]” / “your job applications.” with vertical word carousel and reduced-motion fallback.

### 2026-06-20 — Inter body + Vend Sans headings
- **Prompt:** Rest of fonts apart from Vend Sans use Inter
- **Outcome:** Loaded Inter; `--m-font` / `--font-sans` set to Inter; headings stay Vend Sans only.

### 2026-06-20 — Hero top padding + smaller headline
- **Prompt:** More hero top padding and headline a little smaller
- **Outcome:** Top padding `clamp(4.5rem, 10vw, 7.5rem)`; headline `clamp(2rem, 4.25vw, 3.125rem)`.

### 2026-06-20 — Smaller hero headline
- **Prompt:** Make the hero section's headline a little smaller
- **Outcome:** Reduced `--mh-h1` from `clamp(2.625rem, 5.5vw, 4.125rem)` to `clamp(2.25rem, 4.75vw, 3.5rem)`.

### 2026-06-20 — More hero top padding
- **Prompt:** Add top padding for the hero section
- **Outcome:** Increased `.mh-hero-stack-wrap` top padding to `clamp(3.5rem, 8vw, 6rem)`.

### 2026-06-20 — Vend Sans for headings
- **Prompt:** For all headings, use Vend Sans
- **Outcome:** Loaded Vend Sans from Google Fonts; applied to landing heading tokens and app h1–h6 via `--m-heading-font` / `--font-heading`.

### 2026-06-20 — Hero in site container, tighter shell padding
- **Prompt:** Hero in container; widen only via less wrapper padding, not wider max-width
- **Outcome:** Hero uses `m-container` (80rem); `mh-top-shell` reduces horizontal padding for nav + hero vs rest of page.

### 2026-06-20 — Hero top padding
- **Prompt:** Add some top padding for the hero section
- **Outcome:** Increased `.mh-hero-stack-wrap` top padding from `clamp(1.5rem, 4vw, 3rem)` to `clamp(2.5rem, 6vw, 4.5rem)`.

### 2026-06-20 — Wider hero content
- **Prompt:** Increase hero section width so content goes a little wider
- **Outcome:** Hero container widened to 92rem with tighter side padding; intro max-width removed, lead widened to 72ch, h1 scale bumped slightly.

### 2026-06-20 — System UI font everywhere
- **Prompt:** Use system UI font for everything
- **Outcome:** Removed web font loads; landing and app now use system-ui stack for body, headings, and buttons.

### 2026-06-20 — Amigo-style heading font
- **Prompt:** Use Amigo.ai hero heading font for landing headings
- **Outcome:** Swapped Martina Plantijn for Playfair Display (Amigo’s Flecha fallback); updated heading tokens, hero h1, and CTA title with matching weight, tracking, and line-height.

### 2026-06-20 — Minimal CTA card + one-line footer
- **Prompt:** Footer one line only; bottom CTA like reference (card, lime button, short copy)
- **Outcome:** Rebuilt `MindooCtaSection` as centered card with gradient + dashboard link; replaced footer with single-line © and links.

### 2026-06-20 — CTA + footer below FAQ
- **Prompt:** Add a CTA section below FAQ and footer
- **Outcome:** Restored `MindooCtaSection` and `MindooFooter` on landing after FAQ; updated footer/nav links to current sections and real legal routes.

### 2026-06-20 — Trim landing below FAQ
- **Prompt:** Below FAQ, remove every section
- **Outcome:** Removed Solution, Steps, Trust, and CTA sections from landing; updated nav links to Features/Pricing/FAQ and CTA scroll target to pricing.

### 2026-06-20 — Setup section trust-style cards
- **Prompt:** Update setup section like trust section — image, title, and paragraph per card
- **Outcome:** Rebuilt `MindooSetupSection` with SplitHeading + three gradient visual cards matching `MindooTrustSection` layout.

### 2026-06-20 — FAQ section below pricing
- **Prompt:** Add FAQ below pricing — free/credit card, data privacy, supported models, etc.
- **Outcome:** Added `MindooFaqSection` with eight accordion Q&As covering pricing, privacy, BYOK providers/models, Gmail, extension, and review mode.

### 2026-06-20 — Global letter-spacing zero
- **Prompt:** Make letter spacing of every text on the website 0
- **Outcome:** Set `letter-spacing: 0` on body/headings in `index.css`, zeroed Tailwind tracking tokens, and reset all landing `mindoo.css` letter-spacing rules.

### 2026-06-20 — Pricing section (two free plans)
- **Prompt:** Below setup, pricing section — free to use, unlimited applications, 2 free plans
- **Outcome:** Added `MindooPricingSection` with Private beta + Core cards (both Free), feature bullets, and get-started CTAs styled like reference.

### 2026-06-20 — LinkedIn feed 3-card Beside layout
- **Prompt:** Match Beside hero — 3 cards visible (peek top/center/bottom), gradient fade, not one-at-a-time
- **Outcome:** Rebuilt feed viewport math, lead-card prepend for seamless loop, top/bottom gradient overlays, removed per-card opacity toggling.

### 2026-06-20 — Chrome extension LinkedIn feed animation
- **Prompt:** Beside-style scrolling/pausing card list for Chrome extension section; LinkedIn post replica with OneTap button on actions
- **Outcome:** Added `LinkedInFeedScroll` with 4 dummy hiring posts, scroll-pause CSS animation, and OneTap CTA beside Like/Comment/Repost/Send; wired into extension row in `MindooFeatureShowcaseSection`.

### 2026-06-20 — Setup section (3 cards)
- **Prompt:** After feature rows, setup section with title + 3 horizontal cards: upload résumé, model provider, Gmail
- **Outcome:** Added `MindooSetupSection` with centered “Three minutes to set up…” headline and three-column setup cards matching reference layout.

### 2026-06-20 — Feature showcase bullet points
- **Prompt:** Add three benefit bullet points below each feature row description (extension, tracking, BYOK)
- **Outcome:** Each showcase row now lists three product-specific bullets under the body copy with styled dot markers.

### 2026-06-20 — Feature showcase rows below problem
- **Prompt:** Below problem section, 3 two-column rows (copy + visual): Chrome extension, application tracking, BYOK/privacy
- **Outcome:** Added `MindooFeatureShowcaseSection` with alternating 2-col layout and mini UI visuals (extension, tracker, BYOK setup); wired into landing after problem section.

### 2026-06-20 — Auto apply toggle copy
- **Prompt:** Auto apply toggle needs a one-line descriptive label (Auto apply — let OneTap send from Gmail, etc.)
- **Outcome:** `AutoApplyToggle` now shows “Auto apply — …” with mode-specific Gmail copy on one line; walkthrough text updated.

### 2026-06-20 — Hero video full container width
- **Prompt:** The video should take the full width of the container
- **Outcome:** Moved video out of `mh-hero-intro` so it spans the full `mh-container` width instead of the narrower intro column.

### 2026-06-20 — Hero badge font size
- **Prompt:** Increase the font size of the text that says "Private Beta - Bring Your Own AI".
- **Outcome:** Bumped `.mh-hero-badge` from `0.8125rem` to `0.9375rem`.

### 2026-06-20 — Hero product demo video
- **Prompt:** Use provided screen recording below “Get started for free” as part of hero
- **Outcome:** Added `client/public/hero-demo.mov` (+ H.264 `hero-demo.mp4` for Chrome/Firefox) and autoplaying muted loop video in hero below the CTA with rounded frame and fade-in.

### 2026-06-20 — Hero badge–heading spacing
- **Prompt:** Increase the space between the heading and this element (badge pill)
- **Outcome:** Increased `.mh-hero-headline` gap from `0.35rem` to `1.25rem`.

### 2026-06-20 — Hero badge pill fixes
- **Prompt:** Badge letter-spacing zero, auto width (not full-width), blue dot instead of green
- **Outcome:** Badge uses `width: fit-content`, `letter-spacing: 0`, and brand-blue status dot.

### 2026-06-20 — Hero CTA letter-spacing
- **Prompt:** Make letter spacing in get started for free 0
- **Outcome:** Set `letter-spacing: 0` on `.mh-hero-waitlist-trigger`.

### 2026-06-20 — Hero CTA get started for free
- **Prompt:** or get started for free
- **Outcome:** Renamed hero CTA from “Try for free” to “Get started for free”.

### 2026-06-20 — Hero CTA try for free
- **Prompt:** Remove the waitlist button; say try for free
- **Outcome:** Replaced hero waitlist email flow with a “Try for free” link to `/login`; removed `HeroWaitlistInput.tsx`.

### 2026-06-20 — Wider hero content
- **Prompt:** Make the hero section's content width wider
- **Outcome:** Increased hero intro max-width to 68rem and lead copy to 62ch (from 52rem / 48ch).

### 2026-06-20 — Smaller hero heading
- **Prompt:** Hero section heading — make it smaller
- **Outcome:** Reduced `--mh-h1` from `clamp(3.25rem, 8vw, 6.25rem)` to `clamp(2.5rem, 5vw, 3.75rem)`.

### 2026-06-20 — Remove hero product mockup
- **Prompt:** delete the html element as well
- **Outcome:** Removed the hero demo block (`mh-hero-demo` / `ProductMockupFull`) and its CSS; hero is now copy + waitlist CTA only.

### 2026-06-20 — Hero lead mentions extension
- **Prompt:** Description should be easier to understand — paste JD, auto/review send, Chrome extension on LinkedIn
- **Outcome:** Rewrote hero lead to cover paste-a-JD flow (draft → auto-send or review) and one-click LinkedIn apply via Chrome extension.

### 2026-06-20 — Remove hero HTML animation
- **Prompt:** remove the html animation from hero section
- **Outcome:** Replaced `HeroApplyAnimation` with static `ProductMockupFull`; removed AutoApply toggle bar, `HeroApplyAnimation.tsx`, `useHeroApplyAnimation.ts`, and related `mh-anim-*` CSS.

### 2026-06-18 — Hero copy reflects product
- **Prompt:** Update hero copy to actual product — get hired faster, short OneTap description, one CTA, top pill like “bring your own AI”
- **Outcome:** Added private-beta badge pill, headline “Get hired faster”, product-accurate lead (paste JD → personalized email from résumé via your Gmail + BYOK), removed secondary CTA.

### 2026-06-18 — Paper-style landing hero
- **Prompt:** Update the website hero section like paper.design
- **Outcome:** Redesigned hero to Paper-style stacked layout — light shell, large lowercase headline (“Apply incredible”), two-line tagline, lead paragraph, dual CTAs (waitlist + “See how it works”), AutoApply toggle above full-width product demo below copy.

### 2026-06-18 — Auto-apply loader placement
- **Prompt:** Auto-apply processing loader appeared below JD input; should show centered in email preview panel like review mode
- **Outcome:** Auto-apply mode now renders a right-column preview panel with centered `LoadingTimer` (preparing/sending states) instead of placing the loader under the job description textarea.

### 2026-06-18 — User research script doc
- **Prompt:** Save OneTap MVP user interview script + scorecard for repeatable user research sessions
- **Outcome:** Added `docs/product/user-research-script.md` with pre-call brief, 7 core questions, live tasks, scorecard, synthesis template, and facilitation notes tailored to Apply/Applications/extension flows.

### 2026-06-18 — No-contact apply status / filter fix
- **Prompt:** JD pasted without email logs app but default status filter hides it; should be ready to review/review
- **Outcome:** Root cause: missing-contact applies correctly transition to `application_status=needs_review` but got no `tracker_status_id`, so the Status column showed the empty "Select status" placeholder and summary/review views missed them. Fixed by assigning `Email Ready` tracker status on needs_review (worker + backfill sync), inferring it in SSE cache patches, and rendering a "Needs review" label in the table instead of the tracker picker for those rows.

### 2026-06-18 — Trim sidebar metadata footer
- **Prompt:** Remove ID/orchestration/retries from details footer; show timestamps on one line.
- **Outcome:** Details section now only lists Created/Updated/Sent/Completed/Failed with date and time on a single line (e.g. `21 May 2026, 9:42 PM`).

### 2026-06-18 — Debug apply not showing after hard refresh
- **Prompt:** applied with auto apply on, hard refresh, still not in Applications tab
- **Outcome:** Backend/DB confirmed healthy (applications persist; GET /api/applications returns them). Root cause was client list fetch: `refetchOnMount: false` plus refresh firing before auth left stale/empty cache, and URL page/filter state (e.g. page>1 or status filter) hiding new rows after hard refresh. Fixed with `refetchOnMount: 'always'`, auth-gated refetch on Applications mount, sessionStorage flag to reset to page 1/clear filters after apply, and error UI when list fetch fails.

### 2026-06-18 — Simplify application details sidebar
- **Prompt:** Remove extra sidebar tabs; default to email with recipient on top; de-emphasize metadata at bottom.
- **Outcome:** Replaced tabbed ApplicationDetailsSheet with a single scrollable view—header keeps role/company/status/match score, email (To, subject, body) is primary content, errors show inline when present, and timestamps/ID/orchestration sit in a muted Details section at the bottom.

### 2026-06-18 — Fix applications not logging from apply
- **Prompt:** when applying by pasting JD or extension, applications not showing in Application tab
- **Outcome:** Root cause was stale list cache: realtime SSE only patched the active query key, optimistic inserts used uiStatus for status-filter matching (blocking draft rows), and `refetchOnMount: false` meant bootstrap prefetch could overwrite optimistic rows without a refetch. Fixed by patching all list query keys on SSE, matching filters on `application_status`, refetching the list after ApplyComposer success, and refetching when the Applications tab mounts (covers extension applies).

### 2026-06-18 — Status column shimmer text (no pill)
- **Prompt:** Remove spinning send-icon pill under status; use shimmer text only (e.g. "Sending").
- **Outcome:** Processing/sending rows show status label with text shimmer instead of ApplicationStatusBadge pill.

### 2026-06-18 — Instant application logging from Apply tab
- **Prompt:** Applications tab should show new applies immediately with processing spinner, shimmer, error/retry UI.
- **Outcome:** Optimistic cache upsert on apply start (all list query keys), SSE publish fix for draft/queued, table row processing spinner + shimmer + failed status/retry button.

### 2026-06-18 — Send email row button sends
- **Prompt:** Send email opens the sidebar; it should send the email.
- **Outcome:** Email Ready row Send email button now calls `onSend` to queue the email instead of opening the details sheet.

### 2026-06-18 — Larger bulk actions bar
- **Prompt:** Make the bulk action bar bigger.
- **Outcome:** Increased bar padding, button height (`h-10`), type size (`text-base`), icons, dividers, and corner radius on the floating bulk actions bar only.

### 2026-06-18 — Send email button corner radius
- **Prompt:** Same corner roundness as Summary button.
- **Outcome:** Row Send email button uses `rounded-[10px]` to match Summary and filter controls.

### 2026-06-18 — Send email button text size
- **Prompt:** Bump up send button text size to match other table row text.
- **Outcome:** Row Send email button uses `text-base font-normal` to align with applications table typography.

### 2026-06-18 — Larger checkbox tap target
- **Prompt:** Increase the tap area of checkbox.
- **Outcome:** Row select checkbox hit area increased to 44×44px (`h-11 w-11`) with label wrapper so taps anywhere in the target toggle selection.

### 2026-06-18 — Applications table zero left padding
- **Prompt:** Make table row and table head use padding left 0.
- **Outcome:** `tableCellPaddingX` is now `pl-0 pr-[14px]`; checkbox column also uses `pl-0`.

### 2026-06-18 — Send email button height bump
- **Prompt:** Make it a bit taller.
- **Outcome:** Email Ready row Send email button height increased from `h-9` to `h-10`.

### 2026-06-18 — Send email row button styling
- **Prompt:** Rename Review email to Send email, add icon, increase height 4px; no other UI changes.
- **Outcome:** Email Ready row button only: label `Send email`, Send icon, `h-9` (was `h-8`); behavior unchanged.

### 2026-06-18 — Floating bulk actions bar
- **Prompt:** Bulk action bar should be a floating bar from the bottom like Linear.
- **Outcome:** Bulk actions now render as a fixed bottom-center dark pill with slide-up animation, upward-opening menus, and an X to clear selection.

### 2026-06-18 — Hide row menu when Review email shown
- **Prompt:** When Review email button is there, remove the 3-dot button.
- **Outcome:** ApplicationRowActions menu is hidden on Email Ready rows that show the Review email button.

### 2026-06-18 — Review email button radius
- **Prompt:** Make the button less rounded.
- **Outcome:** Review email row button uses `rounded-sm` instead of the default `rounded-lg`.

### 2026-06-18 — Hide select-all checkbox in table head
- **Prompt:** Don't show checkbox in table head.
- **Outcome:** Removed header select-all checkbox; row checkboxes unchanged with empty header cell for alignment.

### 2026-06-18 — Fix row checkbox selection
- **Prompt:** Selection not working; checkbox state doesn't change; tappable area too small.
- **Outcome:** Removed stale row memo blocking selection re-renders; checkbox uses explicit `rowSelection` state with 36px hit target and row-click isolation on the select cell.

### 2026-06-18 — Bulk send email for selected rows
- **Prompt:** Multi-select rows should also have a Send email bulk action.
- **Outcome:** Bulk actions bar shows Send email for selected Email Ready rows (`canSend`); queues send per application with success/failure toasts and clears selection on success.

### 2026-06-18 — Review email primary row button
- **Prompt:** Make send email button primary black; label Review email; open sidebar instead of sending.
- **Outcome:** Email Ready rows show a primary `Review email` button that opens the application details sheet on the Email tab.

### 2026-06-18 — Applications table bulk selection
- **Prompt:** Add row checkboxes with select-all and bulk actions (change status, delete).
- **Outcome:** Checkbox column with page select-all; bulk actions bar for status updates and permanent delete; new POST bulk tracker-status and delete API endpoints with list cache updates.

### 2026-06-18 — Fix default Email Ready / Email Sent assignment
- **Prompt:** Default status still shows Select status; only Email Ready (auto apply off) or Email Sent (auto apply on + sent) should apply.
- **Outcome:** Assign Email Ready when review-mode email reaches generated; assign Email Sent only after SMTP success; backfill null tracker statuses on list load; propagate trackerStatusId through realtime cache updates.

### 2026-06-18 — Remove applications table background
- **Prompt:** Remove background from table.
- **Outcome:** Dropped card background and shadow from the Applications table wrapper; sticky header now uses page background instead of card tint.

### 2026-06-18 — Fix company edit layout shift
- **Prompt:** When tapping to edit company, the UI shifts — it should stay fixed.
- **Outcome:** Company cell now uses a shared fixed-height shell with matching border box in view and edit modes so row layout no longer jumps on tap.

### 2026-06-18 — Inline editable company in tracker table
- **Prompt:** In the application tracking tab, the company name should be inline editable.
- **Outcome:** Added inline company-name editing in the Applications table (click cell to edit, Enter/blur to save, Esc to cancel) plus a new authenticated PATCH endpoint to persist company updates and keep normalized company fields in sync.

### 2026-06-18 — Email ready row send action
- **Prompt:** If status is Email Ready, keep default as Email Ready and show Send email button in table row.
- **Outcome:** Added inline `Send email` button in Applications table rows when tracker status is `Email Ready` and send is allowed; kept menu send action hidden in that case to avoid duplication.

### 2026-06-18 — Application default tracker statuses
- **Prompt:** Set Applications tab defaults to Email Ready/Email Sent behavior with a new status list.
- **Outcome:** Replaced default tracker statuses with Email Ready, Email Sent, Screening, Interviewing, Offer, Withdrawn, Ghosted, Rejected, Accepted; new applications now default to Email Ready in review mode and Email Sent in auto-apply mode.

### 2026-06-14 — Remove footer
- **Prompt:** Remove footer.
- **Outcome:** Dropped `MindooFooter` from landing page.

### 2026-06-14 — Steps section full white bg
- **Prompt:** Use white bg for whole section.
- **Outcome:** White background on `.m-steps` and layout columns; bottom spacing moved into section `padding-bottom`.

### 2026-06-14 — Steps section top spacing
- **Prompt:** Remove gap between steps and section above; use that value as steps padding-top.
- **Outcome:** Removed top `m-spacing-xxl` spacer and solution bottom padding; added `padding-top: var(--m-spacing-xxl)` to `.m-steps`.

### 2026-06-14 — Fix steps sticky scroll mask
- **Prompt:** Step content shows through sticky white headline after certain scroll.
- **Outcome:** Overlay grid layout — headline and steps share one cell; steps scroll under sticky mask with higher z-index and full-width white backdrop.

### 2026-06-14 — Steps headline white background
- **Prompt:** "From start to finish…" text should have white bg.
- **Outcome:** Added `background: var(--m-bg)` and padding to `.m-steps-sticky`.

### 2026-06-14 — Remove benefits section
- **Prompt:** Remove section "Designed to fit the way you already search."
- **Outcome:** Dropped `MindooBenefitsSection` from landing page.

### 2026-06-14 — Remove section 4 (features)
- **Prompt:** Remove section 4.
- **Outcome:** Dropped `MindooFeaturesSection` from landing page; removed Features nav/footer links.

### 2026-06-14 — Solution headline one line
- **Prompt:** Headline should be in one line only.
- **Outcome:** Replaced `m-ch-22` with `.m-solution-headline` (`white-space: nowrap`, fluid size on mobile).

### 2026-06-14 — Left-align solution headline
- **Prompt:** "Start where the pressure is highest." align left.
- **Outcome:** Removed `m-text-center` and `m-ch-18` auto-margin; uses left-aligned `m-ch-22`.

### 2026-06-14 — Solution bento grid (4 features)
- **Prompt:** Section 3 bento grid with 4 best features (LinkedIn extension, tracking, etc.).
- **Outcome:** Rebuilt `MindooSolutionSection` as 3-column bento: LinkedIn extension, application tracking, AI personalized emails, Gmail send; added extension/gmail mini mockups.

### 2026-06-14 — Tighten gap between sections 2 and 3
- **Prompt:** Too much space between section 2 and 3.
- **Outcome:** Problem section auto-height (removed `55rem` fixed height); reduced solution section and wrapper top padding.

### 2026-06-14 — Solution section bg box
- **Prompt:** Duplicate footer bg box and use on 3rd section as background.
- **Outcome:** Extracted shared `.m-bg-box`; wrapped solution section in it; footer uses same base class.

### 2026-06-14 — Left-align problem section
- **Prompt:** Align the 2nd section left.
- **Outcome:** `.m-problem-outer` uses `justify-content: flex-start` instead of `center`.

### 2026-06-14 — Remove problem section floating boxes
- **Prompt:** Remove them.
- **Outcome:** Deleted floating box markup/data from `MindooProblemSection` and all related CSS.

### 2026-06-14 — Viewport-scattered problem boxes
- **Prompt:** Boxes can go outside content container but should stay visible in viewport, placed randomly.
- **Outcome:** Percentage-based scatter positions in component data; images layer fills section (`inset: 0`); separate mobile edge positions.

### 2026-06-14 — More floating problem boxes
- **Prompt:** Make boxes more floating; okay if they go outside container.
- **Outcome:** Moved images to `.m-problem-outer`, spread positions with rotation/shadow/float animation, `overflow: visible`.

### 2026-06-14 — Move problem boxes down
- **Prompt:** Move floating boxes downwards.
- **Outcome:** Shifted all 7 `.m-problem-img` positions down on desktop and mobile.

### 2026-06-14 — Problem section floating boxes
- **Prompt:** Duplicate floating boxes to 7, make them smaller.
- **Outcome:** Added Emails, Job boards, Calendars cards; reduced box size to `10rem` (mobile `5.5rem`) with positions for all 7.

### 2026-06-14 — Match hero subhead font size
- **Prompt:** Use same font size for hero subhead copy as problem section body.
- **Outcome:** `.mh-subhead` bumped from `1.0625rem` to `1.125rem` to match `.m-problem-p`.

### 2026-06-14 — Problem section body font size
- **Prompt:** Bump up the font size.
- **Outcome:** Increased `.m-problem-p` from `1rem` to `1.125rem`.

### 2026-06-14 — Problem section 2nd paragraph
- **Prompt:** Update the 2nd paragraph in problem section with expanded after-application copy.
- **Outcome:** Replaced second `.m-problem-p` in `MindooProblemSection`.

### 2026-06-14 — Revert problem section copy v2
- **Prompt:** Undo the copy update.
- **Outcome:** Restored previous problem section body paragraphs (shorter before/after/close copy).

### 2026-06-14 — Problem section copy v2
- **Prompt:** Update problem section body copy with expanded before/after paragraphs and new closing line.
- **Outcome:** Replaced three body paragraphs in `MindooProblemSection`; headline unchanged.

### 2026-06-14 — Fix problem section heading visibility
- **Prompt:** Heading not visible in section 2.
- **Outcome:** Problem heading now always visible (bypasses reveal opacity), sits above decorative images via z-index, section content top-aligned with padding, wider `m-ch-22` headline; reveal hook uses `threshold: 0`.

### 2026-06-14 — Problem section copy refresh
- **Prompt:** Update copy in second section with new headline and three body paragraphs.
- **Outcome:** Replaced `MindooProblemSection` headline and body text; widened headline to `m-ch-18` for the longer line.

### 2026-06-14 — Increase m-h3 line height
- **Prompt:** Increase line height of problem section headline and wherever `.m-h3` is used.
- **Outcome:** Bumped `.m-h3` line-height from `90%` to `115%` (affects all `SplitHeading` sections).

### 2026-06-14 — Match empty-state text to JD
- **Prompt:** Make "We'll apply the moment you add a role" text same as JD.
- **Outcome:** `.mh-apply-anim .mh-anim-email-empty` now mirrors `.mh-anim-placeholder` (0.8125rem, 150% line-height, tertiary color, 0.7 opacity, left-aligned) instead of the smaller centered caption.

### 2026-06-14 — Body-only email preview, faster typing
- **Prompt:** Remove subject from email preview (toggle on) — body copy only; faster typewriter; body copy color same as JD.
- **Outcome:** Dropped `subjectText`/`EMAIL_SUBJECT` from hook + component; typing now types `EMAIL_BODY` only at `TYPING_MS` 28→12. `.mh-anim-body` color switched to `--mh-ui-title` to match `.mh-anim-jd-text`.

### 2026-06-14 — Simplify hero animation + tie to toggle
- **Prompt:** Remove OneTap logo/Apply/Applications tabs/AutoApply pill from animation; remove all-caps labels; consistent font in JD + email boxes; tie flow to toggle (ON = email preview, OFF/hand-off = no preview, just "Applied successfully").
- **Outcome:** Dropped the whole `m-product-bar` from `HeroApplyAnimation`; `.mh-apply-anim .m-mini-label` now `text-transform: none`; JD text, email body, and subject normalized to 0.8125rem/150%. Hook branches on `autoApply`: ON keeps generate→type→send; OFF goes paste→applying→`applied` success card ("Applied successfully") via new `mh-anim-applied`/`mh-anim-applying` styles.

### 2026-06-14 — Push hero animation right
- **Prompt:** HTML animation overlaps hero text; push it right instead of resizing.
- **Outcome:** Right column uses `justify-content: flex-end`; product mockup gets `margin-left: clamp(2rem, 5vw, 4rem)` on desktop (reset on mobile stack).

### 2026-06-14 — Join waitlist button font weight
- **Prompt:** Font size/weight on join waitlist button changes on tap; use medium weight for both states.
- **Outcome:** Set `.mh-hero-waitlist-trigger` to `font-weight: 500` to match the expanded submit button.

## Log (newest first)

## Log (newest first)

### 2026-06-14 — Taller hero section
- **Prompt:** Increase the height of hero section.
- **Outcome:** Hero split wrap now uses `min-height: min(88vh, 48rem)` with larger vertical padding and flex centering.

### 2026-06-14 — Blue background through nav + hero
- **Prompt:** Blue background should cover navigation too, from top of site through hero (not white behind nav).
- **Outcome:** Wrapped nav + hero in `mh-top-shell`; hero nav uses transparent bar on blue with white links/logo; nav reverts to white pill after scrolling past hero (`data-hero-past`).

### 2026-06-14 — Weav-style blue split hero
- **Prompt:** Use full OneTap logo blue for hero like weav.com; left-align headline, paragraph, input; product animation on the right.
- **Outcome:** Rebuilt hero as two-column split on `#2563eb` background with white left-aligned copy + waitlist CTA; `HeroApplyAnimation` on the right with scoped white mockup UI; removed floating side cards.

### 2026-06-14 — Nudge hero toggle line right (visible)
- **Prompt:** I don't see any change.
- **Outcome:** Replaced ineffective `margin-left` with `position: relative; left: 1.5rem` (1rem mobile) on line two so toggle + tail shift right regardless of flex centering.

### 2026-06-14 — Nudge hero toggle line right
- **Prompt:** Move them a little to the right.
- **Outcome:** Added `margin-left: 0.75rem` on `.mh-h1-line-second` to shift toggle + tail text slightly right.

### 2026-06-14 — Fixed hero toggle position on state change
- **Prompt:** Toggle shifts position when toggling on/off; keep position and gap to following text fixed.
- **Outcome:** Line two uses fixed `inline-grid` columns (toggle slot + tail text slot) with constant `column-gap`; tail reserves width for longest label so centering does not jump between hands-free/hands-on.

### 2026-06-14 — Larger hero toggle (again)
- **Prompt:** Can you increase the height and width of the toggle button?
- **Outcome:** Scaled toggle track to 5.75rem×3rem (desktop) and 4.5rem×2.5rem (mobile); thumb and on-state travel updated to match.

### 2026-06-14 — Center hero toggle with headline text
- **Prompt:** Align it horizontally center with the text.
- **Outcome:** Toggle button uses 1em height + flex centering so it vertically aligns with the headline words on line two; line and word spans use consistent `align-items: center`.

### 2026-06-14 — Wider hero waitlist input
- **Prompt:** Make it more wider.
- **Outcome:** Waitlist wrapper widened to min(32rem, 92vw); hero copy max-width raised to 38rem so the field isn’t clipped.

### 2026-06-14 — Hero waitlist: stable outer container on expand
- **Prompt:** Clicking join waitlist to expand inline input — issue with the overall div (message cut off).
- **Outcome:** Fixed wrapper to full expanded width always; pill button centered when collapsed; only inner field fades in on expand — no outer div width shift.

### 2026-06-14 — Hero waitlist button: snappy pill expand
- **Prompt:** Join waitlist button jitters on click; should be snappy, fully rounded, slightly larger type.
- **Outcome:** Removed scale expand animation; unified wrapper with max-width transition; pill radius + 1rem font on trigger; no transform on hover/active.

### 2026-06-14 — Larger hero toggle
- **Prompt:** Increase the height of the toggle button as well as the width. Make it bigger.
- **Outcome:** Scaled hero AutoApply toggle track and thumb (~27% larger on desktop, ~25% on mobile); adjusted thumb travel for on state.

### 2026-06-14 — Hero copy: outcome lead + AutoApply mode toggle
- **Prompt:** Copy still weak; rethink from broader vision; toggle on/off framing must be smart and coherent.
- **Outcome:** Headline now "Land more interviews, [toggle] hands-free." / "hands-on." — fixed outcome lead, toggle = AutoApply mode (automatic vs you-approve). Subheads lead with "Apply from LinkedIn or any job post in one click" then diverge on auto-send vs review.

### 2026-06-14 — Hero copy: vision + multi-channel apply
- **Prompt:** Headline shouldn't focus on pasting JDs; communicate Chrome extension, apply from anywhere, faster job search with AI.
- **Outcome:** Headline "Wherever you find a role, [toggle] apply from anywhere." / "AI drafts, you send."; subheads mention LinkedIn extension + AutoApply; demo placeholder updated.

### 2026-06-14 — Smaller hero H1
- **Prompt:** Make the H1 font size a little smaller.
- **Outcome:** Reduced hero `--mh-h1` from 5rem/4rem/3rem to 4.25rem/3.5rem/2.75rem (desktop/tablet/mobile).

### 2026-06-14 — Hero headline USP copy
- **Prompt:** Replace "Tailored job applications to review/in one tap" with copy that communicates product USP; toggle changes only the after phrase.
- **Outcome:** Headline now "Paste a job description — [toggle] review before you send." vs "…sent from your Gmail."; aligned subheads to JD→email→Gmail flow.

### 2026-06-14 — Hero toggle syncs copy + product demo
- **Prompt:** Narrow hero text; toggle drives AutoApply demo; headline/subhead change with toggle on vs off.
- **Outcome:** Lifted `autoApply` state to hero; toggle ON shows "in one tap" + auto-send animation; OFF shows "to review" + Review & Send flow; subhead and side cards update; hero copy max-width 26rem.

### 2026-06-14 — Hero headline two-line layout
- **Prompt:** Headline still runs together; should be exactly two lines.
- **Outcome:** Split H1 into two explicit flex rows with gap between words; line 1 "Tailored job applications in", line 2 toggle + "one tap."; removed max-width ch constraint.

### 2026-06-14 — Hero headline toggle + spacing fix
- **Prompt:** Fix collapsed H1 spacing; add big black toggle before "one tap".
- **Outcome:** Replaced per-word animation with plain spaced headline + inline black toggle switch before "one tap"; widened H1 line-height/letter-spacing.

### 2026-06-14 — Hero typography and inline waitlist
- **Prompt:** Remove eyebrow tag; fix H1 word spacing; larger grey subhead; replace dual CTAs with expandable email waitlist input.
- **Outcome:** Removed "Job search automation" tag; fixed word spacing via margin on animated spans; subhead 1.125rem + tertiary grey; added `HeroWaitlistInput` (button → inline email field with Supabase insert).

### 2026-06-14 — Remove top waitlist banner
- **Prompt:** Remove "OneTap early access is open - join the waitlist for priority access when we launch. →" from top of the site.
- **Outcome:** Removed `MindooBanner` from landing page and deleted the component plus unused `.m-banner` styles.

### 2026-06-14 — Hero paste-to-reply animation
- **Prompt:** Design an HTML animation for the hero section showing a user paste a JD and the product generates a reply.
- **Outcome:** Added `HeroApplyAnimation` and `useHeroApplyAnimation` — looping demo with blinking cursor, paste flash, shimmer “Preparing…” state, typewriter email reply, match score count-up, and Review & Send highlight; wired into `MindooHeroSection` replacing static mockup.

### 2026-06-14 — Full Mindoo site clone
- **Prompt:** Copy the entire mindoo.ai site (not just hero) with OneTap copy.
- **Outcome:** Rebuilt landing as full Mindoo layout: banner, pill nav, hero, problem, solution (phone mockups), features carousel, steps, benefits wheel, trust cards, waitlist CTA, footer. Shared `mindoo.css` with Martina Plantijn + Intertight tokens; scroll reveal + nav hide-on-scroll preserved.

### 2026-06-14 — Mindoo hero clone
- **Prompt:** Copy mindoo.ai hero section literally (fonts, spacing, scroll behavior) with OneTap copy.
- **Outcome:** Added `MindooHeroSection`, `mindoo-hero.css`, and `useMindooScroll`; replaced Wone hero on landing page with Mindoo layout (tag, animated headline, dual CTAs, product mockup, expanding side cards, nav hide-on-scroll-down).

- **Prompt:** Copy thewone.co hero layout (font sizes, spacing, structure) with OneTap copy; single product mockup instead of 5 images; left/right text sections.
- **Outcome:** Rebuilt `HeroSection` to match Wone: warm `#f5f3ed` bg, 72/56/40px headline, 20px subhead, white pill CTA with arrow icon, centered product mockup, two-column flanking text with divider.

### 2026-06-14 — Build waitlist landing page
- **Prompt:** Build all 9 landing page sections, waitlist form with Supabase insert, duplicate email handling; make / the public landing route.
- **Outcome:** Created `client/src/pages/landing.tsx` with all 9 sections (nav, hero, social proof, feature tabs, problem→solution, feature grid, how-it-works, waitlist form, footer). Form validates client-side, inserts to Supabase `waitlist` table, shows success or "already on list" state. Routed `/` as public `GuestRoute`; authenticated users redirect to their app as before. Zero TS errors and zero lints.

### 2026-06-14 — Supabase waitlist setup guide
- **Prompt:** Step-by-step Supabase setup for waitlist only; no code implementation yet.
- **Outcome:** Provided ordered Supabase checklist (table SQL, RLS, grants, env vars, manual verification) using existing project credentials.

### 2026-06-14 — Waitlist landing page discovery and planning
- **Prompt:** Read the codebase and produce a no-code plan for a waitlist landing page (layout, Supabase setup, email flow, copy).
- **Outcome:** Started full repository scan and drafted implementation-ready plan covering product summary, feature themes, landing copy, Supabase checklist, and email architecture.

### 2026-06-14 — First-time auto-apply and setup guided tooltips
- **Prompt:** Design 3–4 brief, skippable onboarding tooltips for AutoApply, Applications, and Setup.
- **Outcome:** Updated first-run walkthrough to 4 concise value-focused steps with skip/escape behavior, including Applications and Setup entry points.

### 2026-06-14 — Fix Gemini/Groq showing Coming soon incorrectly
- **Prompt:** Gemini and Groq are supported but showed Coming soon in provider dropdown
- **Outcome:** Coming soon now uses explicit `remoteProviders` list (OpenAI, Gemini, Groq live); not derived from curated DB rows.

### 2026-06-14 — Apply tab first-visit Auto Apply walkthrough
- **Prompt:** Quick guided tour on first Apply visit — 2–3 tooltips for Auto Apply on/off
- **Outcome:** `ApplyWalkthrough` spotlight tour (3 steps); triggers after onboarding via pending flag + localStorage seen state.

### 2026-06-14 — API key helper below input
- **Prompt:** Move API key helper text below the input with same gap-1 spacing as label to input
- **Outcome:** Helper renders under the API key field with `gap-1`.

### 2026-06-14 — Tighter API key helper spacing
- **Prompt:** Reduce gap between API key helper text and label/input to match label–input spacing
- **Outcome:** Helper moved inside API key field with `gap-1` between helper and input.

### 2026-06-14 — Coming soon providers keep full opacity in dropdown
- **Prompt:** Unsupported providers should not fade logo/name; only show Coming soon label
- **Outcome:** Removed `data-[disabled]:opacity-50` from `SelectItem`; disabled items stay full emphasis, not selectable.

### 2026-06-14 — Provider API key helper links on Choose Model
- **Prompt:** Show helper text with URL to get API key when a model provider is selected (Gemini → AI Studio, Groq, etc.)
- **Outcome:** `aiProviderApiKeyLinks` map + contextual helper above API key field, updates with provider.

### 2026-06-14 — Provider logos in onboarding dropdown
- **Prompt:** Show model provider SVG logos (OpenAI, Anthropic, etc.) alongside names in Choose Model dropdown
- **Outcome:** Added `AiProviderLogo` / `AiProviderOptionLabel` with brand SVG marks; wired into provider `SelectItem`s.

### 2026-06-14 — Coming soon aligned far right in provider dropdown
- **Prompt:** Coming soon label should align to far right of dropdown row, not beside provider name
- **Outcome:** `SelectItem` gained optional `suffix` slot outside `ItemText`; onboarding uses it for right-aligned label.

### 2026-06-14 — Provider dropdown "Coming soon" labels
- **Prompt:** Mark unsupported model providers in Choose Model dropdown with a Coming soon label
- **Outcome:** Fetches certified providers; unsupported entries show right-aligned "Coming soon" and are disabled.

### 2026-06-14 — Fix onboarding stuck on "You're all set"
- **Prompt:** After Gmail submit, celebration screen never redirects to dashboard
- **Outcome:** Fixed `OnboardingConfetti` completion callback (Strict Mode cleared timer); added 3s fallback redirect to `/dashboard`.

### 2026-06-14 — Gmail step copy merged into one paragraph
- **Prompt:** Merge the two Gmail intro paragraphs into one while keeping the app password link
- **Outcome:** Single paragraph with inline link, setup steps, and privacy note.

### 2026-06-14 — Gmail helper text matches intro styling
- **Prompt:** Helper copy should use same font size, weight, and color as paragraph above
- **Outcome:** Changed helper text from `text-sm` to `text-base text-muted-foreground` to match.

### 2026-06-14 — Gmail step copy shortened with privacy note
- **Prompt:** Shorten app password helper text; add privacy angle (send only, can't read inbox)
- **Outcome:** Tighter step 3 helper copy with send-only / no inbox access messaging.

### 2026-06-14 — Gmail step app password instructions
- **Prompt:** Subtle copy on step 3 explaining create app, name it, get password; email used for sending
- **Outcome:** Added brief helper text below the app password link on Connect Gmail step.

### 2026-06-14 — Entire resume dropzone clickable
- **Prompt:** Whole gray dotted box should open the file picker, same as Browse file
- **Outcome:** Dropzone is a `<label>` for the hidden input; click anywhere opens picker; drag-and-drop unchanged.

### 2026-06-14 — Resume dropzone browse button standard styling
- **Prompt:** Browse button should match standard app button size, radius, font size, and weight
- **Outcome:** Removed `size="sm"` and custom `bg-white`; uses default `Button` sizing (`h-10`, `rounded-lg`, `text-base font-medium`).

### 2026-06-14 — Resume dropzone icon heading and browse button
- **Prompt:** Drop zone like reference — icon, heading, paragraph, gray dashed box, browse button
- **Outcome:** `ResumeDropzone` redesigned with cloud icon, drag copy, format hint, outline Browse file button.

### 2026-06-14 — Onboarding resume drag-and-drop zone
- **Prompt:** Step 2 upload as ~120px dashed drop zone with formats + drag/drop
- **Outcome:** `ResumeDropzone` replaces Upload button; browse link, PDF hint, drag-and-drop.

### 2026-06-14 — Step indicator top margin
- **Prompt:** Add margin above step indicator
- **Outcome:** Increased top spacing (`mt-10`) above step progress bar.

### 2026-06-14 — Center onboarding header content
- **Prompt:** Center-align logo, welcome, and content above the box
- **Outcome:** Logo, welcome, steps-left copy, and step indicator centered above the form card.

### 2026-06-14 — Step indicator below welcome, above card
- **Prompt:** Put step indicator right above the box, below logo and welcome text
- **Outcome:** Order is logo → welcome → steps-left copy → step indicator → white form card.

### 2026-06-14 — Onboarding welcome outside card
- **Prompt:** Move logo, welcome, and steps-left text outside box; keep step form inside
- **Outcome:** Brand + welcome copy above card; white box contains step title and inputs only.

### 2026-06-14 — Onboarding step title matches indicator
- **Prompt:** In-card step heading should match indicator (Choose Model, etc.)
- **Outcome:** Single `label` per step used for both indicator and section heading.

### 2026-06-14 — Remove step X of 3 line from onboarding
- **Prompt:** Remove "Step 1 of 3 · 3 remaining" text
- **Outcome:** Dropped subheading; step section shows title only.

### 2026-06-14 — Onboarding step indicator labels
- **Prompt:** Step labels should be Choose Model, Upload Resume, Connect Gmail
- **Outcome:** Updated `STEPS` short labels; widened indicator layout for longer text.

### 2026-06-14 — Consistent onboarding field spacing
- **Prompt:** Same label-to-input spacing for all three step-1 fields (provider, model, API key)
- **Outcome:** Shared `OnboardingField` wrapper with `flex flex-col gap-3` and full-width control slot for Select/Input.

### 2026-06-14 — Onboarding label-to-input spacing
- **Prompt:** Increase space between label and input/menu button
- **Outcome:** Form fields use `space-y-3` instead of `space-y-2` on onboarding.

### 2026-06-14 — Onboarding model field consistent height
- **Prompt:** Model select vs "no certified models" message should be same input height
- **Outcome:** Single disabled `Select` shows "Select model" or empty-state placeholder at fixed `h-10` trigger height.

### 2026-06-14 — Model provider label and select menu width
- **Prompt:** Label should say "Model provider"; dropdown menu should match trigger width
- **Outcome:** Renamed onboarding label; `SelectContent` uses `--radix-select-trigger-width` in popper mode.

### 2026-06-14 — Center onboarding step indicator
- **Prompt:** Step indicator should be center-aligned to the box, not left
- **Outcome:** Step progress uses `w-fit mx-auto` with fixed-width connectors instead of full-width flex stretch.

### 2026-06-14 — Onboarding selects use shared Select component
- **Prompt:** Fix provider/model input padding — use same component as other text inputs
- **Outcome:** Replaced native `<select>` with Radix `Select`/`SelectTrigger` matching app `Input` styling.

### 2026-06-14 — Shorten onboarding welcome copy
- **Prompt:** Welcome description too long — shorten, same meaning
- **Outcome:** Single dynamic line e.g. "3 steps left — finish setup to apply from Gmail."

### 2026-06-14 — Onboarding step indicator above card
- **Prompt:** Move step indicator out of the box, top center above it
- **Outcome:** Step progress sits centered above the white card, outside the border.

### 2026-06-14 — Onboarding single-step card UX polish
- **Prompt:** Match login box width; one step at a time with 1-2-3 progress; fix input alignment; clearer welcome copy
- **Outcome:** Centered `max-w-lg` card like login; step indicator with done/current states; only active step form shown; fixed select/input field layout.

### 2026-06-14 — Onboarding progressive three-step flow
- **Prompt:** Welcome + 3-step progressive disclosure (AI, resume, Gmail), confetti on complete, then dashboard; walkthrough deferred
- **Outcome:** Redesigned `/onboarding` with step boxes, email as step 3, canvas-confetti celebration, walkthrough pending flag; backend onboarding requires email too.

### 2026-06-14 — Fix post-auth dashboard flash before onboarding
- **Prompt:** After Google sign-in, briefly hits dashboard then redirects to onboarding — skip that
- **Outcome:** Auth callback and session redirects resolve setup status first; route straight to `/onboarding` or `/dashboard` via `resolvePostAuthPath` / `AuthenticatedHomeRedirect`.

### 2026-06-14 — Login box no shadow
- **Prompt:** Remove the shadow from the box
- **Outcome:** Login card uses `shadow-none` instead of card shadow.

### 2026-06-14 — Login page gray background
- **Prompt:** Make background a little gray, keep the box white
- **Outcome:** Page uses `bg-background`; login card stays white.

### 2026-06-14 — Login page content in centered box
- **Prompt:** Make everything into a box on the login page
- **Outcome:** Wrapped headline, bullets, and Google button in a centered bordered `Card` on white background.

### 2026-06-14 — Login page single-column layout
- **Prompt:** Switch from two columns to one — marketing content on top, Google button below
- **Outcome:** Single centered column (`max-w-lg`); headline, description, bullets stacked above full-width Google button.

### 2026-06-14 — Login page simplify and tighten layout
- **Prompt:** Push columns up; one-line headline; minimal benefit bullets; remove steps/card; plain white
- **Outcome:** White two-column layout, shorter headline, single-line bullets, right column is Google button only.

### 2026-06-14 — Login page two-column redesign
- **Prompt:** Redesign login with left heading/benefits and right steps + Google button
- **Outcome:** Split layout: marketing column (headline, description, 3 benefits) and get-started card (numbered steps, Google OAuth).

### 2026-06-14 — Fix blank Apply page when API slow/down
- **Prompt:** App loading but no data showing on dashboard
- **Outcome:** Root cause was `OnboardingGuard` blocking routes on setup-status fetch (skeleton forever when API on :5001 was down). Removed blocking loader so Apply/Applications render immediately; onboarding redirect only after status confirms `onboardingRequired`. API verified healthy via Vite proxy.

### 2026-06-14 — Empty state job description copy
- **Prompt:** Update copy — product uses job descriptions, not job links
- **Outcome:** Empty state body now says "paste a job description" to match Apply page wording.

### 2026-06-14 — Applications empty state copy and typography
- **Prompt:** Empty state should use 14px heading/body; replace "Go to Dashboard" with apply CTA
- **Outcome:** Both lines use `text-base` (14px); button says "Start applying" and links to Apply page; body copy references pasting a job link.

### 2026-06-14 — Commit and push OneTap UI refresh
- **Prompt:** git push and commit
- **Outcome:** Committed 100 files as `832261d` (OneTap UI, tracker statuses, apply dashboard); pushed to `origin/master`. Left `.runtime/api.pid` and debug log unstaged.

### 2026-06-14 — Deploy linear funnel follow-up
- **Prompt:** Subagent follow-up after linear tracker funnel implementation
- **Outcome:** Applied migration 026; restarted API on :5001 with funnel service changes.

### 2026-06-14 — Summary button on Applications tab
- **Prompt:** Change chart icon to a "Summary" button aligned far right on same axis
- **Outcome:** Replaced icon-only chart trigger with outline "Summary" button; grouped with refresh in `ml-auto` row on filters toolbar.

### 2026-06-14 — Linear tracker status funnel
- **Prompt:** Redesign tracker statuses as 3–4 step linear funnel; cumulative Sankey; keep custom statuses
- **Outcome:** Four system statuses (Email sent → First interview → Second interview → Offer) with `stage`/`system` fields; migration 026 + lazy merge; cumulative funnel API; multi-level Sankey; system statuses protected from delete.

### 2026-06-14 — Summary chart in large centered dialog
- **Prompt:** Summary should appear in a large popup, not a sidebar
- **Outcome:** Replaced Sheet with centered `Dialog` (max-w-5xl); taller Sankey chart area.

### 2026-06-14 — Fix Sankey invalid element type crash
- **Prompt:** Application failed to load — invalid element type in `ApplicationsTrackerSankey`
- **Outcome:** Fixed ECharts import from `echarts-for-react/lib/core` (CJS) to `echarts-for-react/esm/core` for Vite ESM interop.

### 2026-06-14 — Fix EADDRINUSE on API restart
- **Prompt:** `PORT=5001 npm start` failed — address already in use
- **Outcome:** Killed stale node process on :5001 (PID 70446); restarted API successfully (`API_LISTENING` on 5001).

### 2026-06-14 — Applications tab tracker status Sankey chart
- **Prompt:** Chart icon on applications tab showing Sankey of emails sent, interviews, rejections, offers from tracker status data
- **Outcome:** `GET /api/applications/tracker-status-summary`; ECharts Sankey in lazy-loaded sheet; chart icon in filters toolbar; summary invalidates on status change/delete.

### 2026-06-14 — API restart with tracker status fix
- **Prompt:** (task) Restart API server with circular dep fix
- **Outcome:** Server restarted on :5001 with lazy-require fix in trackerStatusService; create + assign path verified.

### 2026-06-14 — Sankey library recommendation (ECharts)
- **Prompt:** Easiest/fastest library for Sankey like echarts sankey-levels example
- **Outcome:** Recommended Apache ECharts + `echarts-for-react` with tree-shaken modular imports; matches linked multi-level Sankey demo; Nivo as React-native alternative.

### 2026-06-14 — Fix status delete "Request failed"
- **Prompt:** Deletion of a status not working — says request failed
- **Outcome:** Root cause was stale API server missing `DELETE /api/user/tracker-statuses/:id` (404); restarted server on :5001; delete service verified against DB.

### 2026-06-14 — Delete tracker status from picker
- **Prompt:** When selecting a status, user should delete a status via 3-dot menu with confirmation
- **Outcome:** DELETE `/api/user/tracker-statuses/:id` clears option + application assignments; status popover rows show hover 3-dot menu with inline delete confirmation (Email sent protected).

### 2026-06-14 — Remove Status column sorting
- **Prompt:** No ordering and reordering on status table head
- **Outcome:** Status header is plain text (like Role); removed `SortHeader` and sort affordance from the Status column.

### 2026-06-14 — Swap Match and Status columns
- **Prompt:** Swap match and status position in applications table
- **Outcome:** Reordered columns in `ApplicationsDataGrid` and skeleton rows so Status comes before Match.

### 2026-06-14 — Notion-style tracker status (dot + text)
- **Prompt:** Status won't have background color, just dot and text with different colors like Notion
- **Outcome:** Replaced pill backgrounds with per-color dot + text in `trackerStatusColors` and `ApplicationTrackerStatusCell` (table cell + dropdown).

### 2026-06-14 — Align Status column header and body
- **Prompt:** Status table head and body not aligned — fix alignment
- **Outcome:** Removed extra `px-2` on `StatusPill` in `ApplicationTrackerStatusCell` so body text lines up with the Status header like Match/Updated columns.

### 2026-06-14 — Fix tracker status create still failing
- **Prompt:** Still same "Request failed" error creating custom status
- **Outcome:** Found two issues: stale API server missing routes (404) + circular dep `applicationModel`↔`trackerStatusService` broke assign (`getApplicationById is not a function`); lazy require fix; restarted server on :5001.

### 2026-06-14 — Fix custom tracker status create failure
- **Prompt:** Can't create custom status on applications table — "Request failed"
- **Outcome:** Root cause was pending migrations 023–025 (missing `tracker_status_options` / `tracker_status_id` columns); ran `npm run migrate`; create + assign verified.

### 2026-06-14 — Auto-assign Email sent tracker status on send
- **Prompt:** By default set tracker status to Email sent when application email has been sent
- **Outcome:** `ts_email_sent` in default options; auto-assigned in `markSentFromGenerated`; migration 025 backfill; realtime cache patches tracker on sent.

### 2026-06-14 — Notion-style application tracker status select
- **Prompt:** Applications status column like Notion single select — pick, create, assign per row
- **Outcome:** Tracker status options per user (DB migration 024); Notion-like popover cell; API to create options and PATCH row assignment; defaults Applied/Interview/Offer/Rejected.

### 2026-06-14 — Setup Go back button with arrow icon
- **Prompt:** Add back arrow icon to Go back text button on Setup
- **Outcome:** SetupPageShell Go back uses ghost text button with ArrowLeft icon.

### 2026-06-14 — Setup go back text button replaces close icon
- **Prompt:** Remove circular close on Setup; add Go back text button on top
- **Outcome:** SetupPageShell uses ghost "Go back" link-style button above title, navigates to dashboard.

### 2026-06-14 — Setup as settings overlay (no main header, close button)
- **Prompt:** Hide Apply/Applications header on Setup; add top-right circular close button like settings page
- **Outcome:** Layout hides nav on `/setup`; SetupPageShell with rounded X closes back to dashboard.

### 2026-06-14 — Segmented control 4px gap
- **Prompt:** Make gap between segmented control segments 4px
- **Outcome:** SegmentedControl track uses `gap-1` (4px) instead of `gap-[2px]`.

### 2026-06-14 — Setup tab horizontal padding
- **Prompt:** Increase x padding on Setup segmented tabs
- **Outcome:** Auto-width SegmentedControl segments use `px-6` instead of `px-3`.

### 2026-06-14 — Setup tabs auto width
- **Prompt:** Setup page tabs shouldn't be edge-to-edge; use auto width
- **Outcome:** SegmentedControl `fullWidth={false}` on Setup; track uses `w-auto`, segments size to content.

### 2026-06-14 — Application-wide 100px horizontal page padding
- **Prompt:** Use 100px left/right padding on every page application-wide
- **Outcome:** Shared `PAGE_PADDING_X` applied in PageShell, layout header, login, onboarding, and model certification pages.

### 2026-06-14 — JD column width consistent in both apply modes
- **Prompt:** Keep JD input width the same whether AutoApply is on or off
- **Outcome:** ApplyComposer always uses two-column grid on lg; AutoApply on leaves second column empty so JD stays half-width.

### 2026-06-14 — AutoApply toggle replaces mode dropdown
- **Prompt:** Change apply mode to AutoApply label + on/off toggle; hide right column when on
- **Outcome:** AutoApplyToggle with Switch in PageShell; toggle off shows review column; toggle on single-column paste-only with background auto-send.

### 2026-06-14 — Apply page auto vs review mode dropdown
- **Prompt:** Top-right mode dropdown on Apply: Auto apply (draft+send automatically) vs Review + apply (current preview/edit flow)
- **Outcome:** ApplyModeSelect in PageShell actions; mode persisted in localStorage; ApplyComposer auto-submits after preview in auto mode with read-only copy; review mode unchanged.

### 2026-06-14 — Setup page segmented tab navigation
- **Prompt:** Replace long Setup scroll with four SegmentedControl tabs (AI, Resume, Email, Email style)
- **Outcome:** Setup page shows one section at a time via shared SegmentedControl; `focus=email` and `?tab=` deep links select the correct tab; SegmentedControl label prop made optional.

### 2026-06-14 — Setup page visual alignment with Apply
- **Prompt:** Audit Apply as reference; fix Setup typography, colors, spacing, and radius only (no logic/structure changes)
- **Outcome:** Setup cards, forms, and skeletons aligned to Apply tokens: text-base scale, rounded-sm boxes, gap/space-y-3 siblings, border-input-border surfaces, bg-muted/10 empty states.

### 2026-06-14 — Header nav underline tab style
- **Prompt:** Style top Apply/Applications tabs like reference — text with bottom border on active tab
- **Outcome:** Header NavLinks use border-b-2 underline on active state; removed pill background styling; tabs stretch full header height with wider gap.

### 2026-06-14 — Hide email style during initial preview generation
- **Prompt:** When pasting a JD and email preview is generating, hide email style until copy is ready to review
- **Outcome:** Email style panel in ApplyComposer renders only when `hasPreview` is true; initial generation shows loading state alone.

### 2026-06-14 — Apply tab boxes use rounded-sm
- **Prompt:** use rounded-sm for all boxes on apply tab
- **Outcome:** Shared `APPLY_BOX_RADIUS` on JD, preview fields, email style panel, empty/loading states, send button; SegmentedControl track/segments use `rounded-sm`.

### 2026-06-14 — Subject and body input matching corner radius
- **Prompt:** subject input corner radius should match email body input
- **Outcome:** Shared `PREVIEW_FIELD_RADIUS` (`rounded-xl`) applied to both subject Input and body Textarea.

### 2026-06-14 — Segmented control hover radius matches active
- **Prompt:** hover border radius doesn't match active state
- **Outcome:** All segment buttons use shared `rounded-[8px]` so hover and active shapes align.

### 2026-06-14 — 2px gap between segmented control buttons
- **Prompt:** add 2-pixel gap between tone/length segmented buttons (Casual, Balanced, Executive)
- **Outcome:** SegmentedControl track uses `gap-[2px]` between options.

### 2026-06-14 — Active segment fully rounded on all corners
- **Prompt:** active button group tab only rounds outer edge corners — use same radius on all four sides
- **Outcome:** Selected SegmentedControl option uses `rounded-[8px]` on all corners; positional left/right radius removed.

### 2026-06-14 — Segmented control smaller border radius
- **Prompt:** decrease border radius of Length/Tone button groups
- **Outcome:** SegmentedControl outer radius `rounded-[10px]`, inner segment corners `8px`.

### 2026-06-14 — Email style box white background
- **Prompt:** Email style div is grey — use white like other boxes
- **Outcome:** Email style panel uses `bg-input` with `border-input-border` to match subject/body inputs; hover uses subtle black tint.

### 2026-06-14 — Email preview column typography (14px, medium/regular)
- **Prompt:** preview column labels/text use inconsistent sizes — standardize to 14px with medium and regular weights only
- **Outcome:** Preview column uses `PREVIEW_TEXT_PRIMARY/SECONDARY` tokens; SegmentedControl and email body textarea updated to `text-base` with medium/regular weights.

### 2026-06-14 — TextShimmer component for loading label
- **Prompt:** use TextShimmer from @/components/core/text-shimmer for shimmer effect
- **Outcome:** Added motion-primitives-style `TextShimmer` (CSS port); `LoadingTimer` uses it for preview generating label with `duration={1}`.

### 2026-06-14 — Shimmer on preview generating label
- **Prompt:** add text shimmer effect on "Generating your email preview…"
- **Outcome:** Added `.text-shimmer` utility; `LoadingTimer` supports `labelShimmer` on the initial preview loading state.

### 2026-06-14 — Loading state vertical three-layer layout
- **Prompt:** loading state — spinner, heading, 14px description stacked; remove elapsed time
- **Outcome:** `LoadingTimer` redesigned as centered column (spinner → heading → description); progress bar and timer removed; `taskStartedAt` dropped from ApplyComposer.

### 2026-06-14 — No hover on table header rows
- **Prompt:** hover color shouldn't apply to table head
- **Outcome:** `TableHeader` neutralizes row hover background; sort header buttons no longer change text color on hover.

### 2026-06-14 — Status filter checkbox shape
- **Prompt:** status menu selections look like radio buttons, should look like checkboxes
- **Outcome:** Checkbox component uses `rounded-[4px]` and `bg-input` so 16×16 controls read as square checkboxes, not circles.

### 2026-06-14 — Status and date filter UI consistency
- **Prompt:** status and time filter buttons inconsistent hover/selected states in menus
- **Outcome:** Shared `filterTriggerClass` and menu item styles; status popover rows match select item hover/selected backgrounds; SelectTrigger/SelectItem updated for open, hover, and checked states.

### 2026-06-14 — Clear table row highlight when sheet closes
- **Prompt:** after closing sidebar, row hover/selected color persists — should return to default
- **Outcome:** Row highlight only while sheet is open; `selectedId` cleared on sheet close.

### 2026-06-14 — Application details sheet slide-in animation
- **Prompt:** sidebar on row click is too instant — add slide-in with easing
- **Outcome:** Custom sheet keyframes in `index.css` (380ms ease-out open, 320ms ease-in close); `sheet.tsx` wired to new animations (tailwindcss-animate was not installed).

### 2026-06-14 — Table cell horizontal padding matches search input
- **Prompt:** table header and body rows should use same left-right padding as search input
- **Outcome:** Added `tableCellPaddingX` (`px-[14px]`) applied to all applications table header and body cells, including skeleton rows.

### 2026-06-14 — Match, status, updated use secondary text
- **Prompt:** match, status, and updated date should use secondary text styling
- **Outcome:** Table match score, status label, and inline datetime all use `tableTextSecondary`.

### 2026-06-14 — Company column + inline datetime in table
- **Prompt:** company name in its own column; date and time on one line per row
- **Outcome:** Split Role/Company columns; company sort on Company header; `DateTimeCell` inline variant for table (`21 May 2026 · 9:42 PM`).

### 2026-06-14 — Applications table typography system
- **Prompt:** table content — one font size, two weights: 14px medium black primary, 14px regular gray secondary
- **Outcome:** Added `applicationsTableTypography` tokens; table cells use primary/secondary styles; status badges in table render as plain text; match score drops color/bar in table view.

### 2026-06-14 — Status and date filters left-aligned, auto width
- **Prompt:** status centered while time left — align left, auto width, not fixed
- **Outcome:** Shared `filterControlClass` on status button and date select: `justify-start w-auto shrink-0 px-[14px]`.

### 2026-06-14 — Applications table corner radius 10px
- **Prompt:** use same corner radius for table as well
- **Outcome:** Applications table card wrapper uses `rounded-[10px]` to match search and filter controls.

### 2026-06-14 — Applications filter button polish
- **Prompt:** remove filter icon from status button; remove chevron from time menu; match font weight and corner radius with search
- **Outcome:** Status button is text-only; date select hides chevron; shared `controlClass` uses `rounded-[10px] font-normal` to match search input.

### 2026-06-14 — Applications filters 14px
- **Prompt:** search and filters font size - 14px
- **Outcome:** `ApplicationsPageFilters` controls use `text-base` (14px) for search, filter buttons, date select, and status popover labels.

### 2026-06-14 — Applications search/filters on page, pagination in table footer
- **Prompt:** move search and filter from table to page; items per page below table; add pagination; align search/filter horizontally with same font size
- **Outcome:** Split toolbar into `ApplicationsPageFilters` (horizontal row above card) and `ApplicationsTableFooter` (count, pagination, page size below table); removed old toolbar/pagination components.

### 2026-06-14 — 13px text bumped to 14px
- **Prompt:** change the 13px to 14px
- **Outcome:** PageShell description, ApplyComposer section labels, and preview placeholder use `text-base` (14px).

### 2026-06-14 — Brand/focus accent switched to blue
- **Prompt:** make them blue not green
- **Outcome:** `--ring` and `--brand` set to `221 83% 53%` (#2563EB); favicon restored to blue; logo and input focus rings now match.

### 2026-06-14 — Logo brand color matches accent green
- **Prompt:** OneTap logo blue vs green focus/accent states — align colors
- **Outcome:** Added `--brand` token (same as `--ring` green); logomark uses `text-brand`/`currentColor`; favicon SVG updated to `#10a279`.

### 2026-06-14 — Remove ApplyComposer outer boxes
- **Prompt:** weird box around JD input and preview — remove it
- **Outcome:** Dropped `Card` wrapper (shadow was boxing both columns); removed preview panel outer border/bg/shadow so label + fields sit on page background.

### 2026-06-14 — ApplyComposer section labels 13px
- **Prompt:** JD input label and preview email label should be 13px
- **Outcome:** `ApplyComposer` section labels use shared `SECTION_LABEL` (`text-[13px] font-medium`).

### 2026-06-14 — PageShell description 13px
- **Prompt:** make it 13px
- **Outcome:** PageShell description set to `text-[13px]`.

### 2026-06-14 — PageShell description 14px
- **Prompt:** the description text should be 14px
- **Outcome:** PageShell description uses `text-base` (14px per theme tokens) instead of `text-sm` (12px).

### 2026-06-14 — Shared PageShell for main screens
- **Prompt:** Apply, Applications, Setup should use common component for font size, weight, spacing
- **Outcome:** Added `PageShell` with unified title (`text-display font-semibold tracking-tight`), description (`text-sm`), padding (`p-6 lg:p-8`), and header spacing; refactored all three pages.

### 2026-06-14 — User name matches tab typography
- **Prompt:** user's name should use same font size and weight as tabs
- **Outcome:** UserMenu trigger uses `text-base font-normal text-muted-foreground` to match nav tabs.

### 2026-06-14 — Header user menu + profile names
- **Prompt:** 56px header; avatar/initials + first name menu; seed name from email at onboarding; edit profile + Setup in dropdown
- **Outcome:** Migration `023` adds `first_name`/`last_name`; `PATCH /api/user/profile` and `POST /api/user/profile/seed-from-email`; `UserMenu` with avatar, profile sheet, Setup + sign out; Setup removed from nav; onboarding seeds name on load.

### 2026-06-14 — Header logo–tabs spacing
- **Prompt:** add some space between onetap logo and tabs
- **Outcome:** Added `mr-4` to `OneTapBrand` in layout header for extra gap before nav tabs.

### 2026-06-14 — OneTap SVG logomark
- **Prompt:** use provided SVG as OneTap logomark
- **Outcome:** Added `OneTapLogomark`/`OneTapBrand` components; replaced header O pill, login, onboarding welcome/header; favicon updated.

### 2026-06-14 — Apply ChatGPT light mode theme
- **Prompt:** approve light mode conversion
- **Outcome:** Swapped `:root` to warm off-white palette (`#f9f9f9` canvas, `#f0f0f0` header, `#0d0d0d` primary buttons, green-teal focus ring); removed `class="dark"`; updated all UI primitives and ~45 hardcoded dark alpha classes. Build passes.

### 2026-06-14 — Light mode token diff (ChatGPT)
- **Prompt:** Convert dark theme to ChatGPT light mode; list before→after tokens, confirm before apply
- **Outcome:** Audited current dark tokens and ~40 hardcoded `white/` alpha classes; produced full light-mode token diff — no code changes yet.

### 2026-06-14 — Apply ChatGPT/Claude dark theme
- **Prompt:** I don't see any changes yet (apply the visual theme redesign)
- **Outcome:** Applied dark theme globally: Inter font, `#212121` palette, green-teal accent, restyled UI primitives (button/input/card/etc.), layout nav, and replaced hardcoded emerald/amber/serif across pages. Build passes.

### 2026-06-14 — Visual theme audit (ChatGPT/Claude)
- **Prompt:** Full design-token audit and before→after token diff for ChatGPT/Claude aesthetic; approval before global apply
- **Outcome:** Audited `index.css`, fonts, shadcn UI primitives, and hardcoded Tailwind colors; produced token diff (colors, typography, spacing, radius, shadows) — no code changes yet.

### 2026-06-14 — Faster email style animation
- **Prompt:** make expand/collapse resize faster
- **Outcome:** Email style collapse transition reduced from 300ms to 150ms.

### 2026-06-14 — Remove job title above send
- **Prompt:** Remove job title showing above send button after email generated
- **Outcome:** Removed previewMeta job title/company line from ApplyComposer footer area.

### 2026-06-14 — Animated email style collapse
- **Prompt:** Email style expand/collapse should animate with resize CSS ease-in
- **Outcome:** Collapsible panel uses grid-template-rows transition (300ms ease-in); chevron synced.

### 2026-06-14 — Length and tone side by side
- **Prompt:** Length and tone horizontally aligned
- **Outcome:** Email style controls use a 2-column grid so Length and Tone sit on one row.

### 2026-06-14 — Panel height 780px
- **Prompt:** make the height 780px
- **Outcome:** JD and email preview panels updated from 420px to 780px.

### 2026-06-14 — Matched JD and preview panel dimensions
- **Prompt:** JD input and email preview same height/width in all states
- **Outcome:** Both columns use aligned label rows and fixed 420px panels; preview content scrolls inside with pinned send footer.

### 2026-06-14 — Collapsible email style box
- **Prompt:** Make Email style box expandable and collapsable
- **Outcome:** Email style section toggles open/closed; collapsed header shows current length and tone.

### 2026-06-14 — Loading state in preview column
- **Prompt:** Move loading component from below JD into preview box on paste
- **Outcome:** LoadingTimer renders inside email preview column; first-draft loading uses dashed panel.

### 2026-06-14 — Fixed JD textarea height
- **Prompt:** JD input height changes on paste — fix height for both states
- **Outcome:** JD textarea and empty preview panel use fixed h-[420px]; grid items-start prevents stretch.

### 2026-06-14 — Apply tab page header
- **Prompt:** Same heading/description component as Applications tab on Apply tab
- **Outcome:** Added serif h1 + muted description block to dashboard page, matching Applications layout.

### 2026-06-14 — Email preview empty state
- **Prompt:** Empty 2nd column when JD empty — paste JD to preview message
- **Outcome:** Added dashed empty-state panel in preview column before JD is pasted.

### 2026-06-14 — Restore job description label
- **Prompt:** bring back job description text
- **Outcome:** Restored "Job description" label above JD textarea in ApplyComposer.

### 2026-06-14 — Fixed JD column width at 50%
- **Prompt:** JD paste input 50% width so it doesn't resize when preview appears
- **Outcome:** Always use 2-column grid on lg; reserve right column before paste.

### 2026-06-14 — Remove job description label
- **Prompt:** remove job description text, keep placeholder
- **Outcome:** Removed "Job description" label above JD textarea in ApplyComposer.

### 2026-06-14 — Remove apply card border
- **Prompt:** remove border (outer apply card)
- **Outcome:** Removed border and card chrome from ApplyComposer wrapper.

### 2026-06-14 — Apply tab label + remove card header
- **Prompt:** Remove Apply to a Job header text; rename Dashboard tab to Apply
- **Outcome:** Removed CardHeader from ApplyComposer; nav tab label is now Apply.

### 2026-06-14 — Auto-show preview on JD paste
- **Prompt:** Remove generate preview button; hide preview column until paste; show style options + send below preview
- **Outcome:** Preview column appears when JD has content; debounced auto-generation on paste/style change; send button moved into preview column.

### 2026-06-14 — App-wide UI refresh
- **Prompt:** Remove shadows, rename to OneTap, remove dashboard header, replace sidebar with top tabs
- **Outcome:** Rewrote `layout.tsx` with horizontal nav tabs; removed shadows from UI primitives and pages; rebranded AI Apply → OneTap; removed dashboard title/subtitle; widened page layouts for full-width use.

### 2026-06-14 — Email style in preview panel
- **Prompt:** Move email style controls into ApplyComposer preview column; replace sliders with segmented Length/Tone buttons
- **Outcome:** Added `SegmentedControl`, 3-option length/tone mappings in `emailPreferencePresets.ts`, integrated debounced prefs into `ApplyComposer`, removed compact `EmailPreferencesCard` from dashboard.

### 2026-06-14 — Fix preview-email "Not found"
- **Prompt:** Dashboard "Generate preview" returns not found on POST /api/preview-email
- **Outcome:** Root cause was `modelCertificationRoutes` applying auth/guard to all unmatched `/api` traffic (404 `{ error: "Not found" }`) combined with API not restarted after adding the route. Scoped certification middleware to `/dev/model-certification/*` and restarted API on port 5001.

### 2026-06-14 — Dashboard JD + email preview layout
- **Prompt:** 2-column layout: JD input left, customizable email preview right before sending
- **Outcome:** Added `ApplyComposer` with 2-column UI, `POST /api/preview-email` endpoint, and auto-apply support for user-edited subject/body; process worker skips regeneration when draft is provided.

### 2026-06-14 — Hide dashboard status boxes
- **Prompt:** hide the Resume Status and Email Status boxes from dashboard tab
- **Outcome:** Removed the Resume Status and Email Status card grid from `client/src/pages/dashboard.tsx`; setup checks still gate the Apply form.

### 2026-06-12 — Applications stuck in sending (fix)
- **Prompt:** Issue reproduced, proceed with fix
- **Outcome:** Confirmed Gmail 535 BadCredentials + BullMQ job marked completed while DB job stuck in processing. Fixed: SMTP auth = non-retryable, finalizeBullMqJobFailure rethrows retryable errors, reset DB job to queued on retry.

### 2026-06-12 — Applications stuck in sending
- **Prompt:** Applications queue but never send; status stuck between queuing/sending
- **Outcome:** Runtime logs show send worker runs but Gmail SMTP returns 535 BadCredentials; added debug instrumentation in send worker to confirm credential/SMTP failure path.

### 2026-06-12 — Restart all dev terminals
- **Prompt:** restart all the terminals
- **Outcome:** Stopped processes on 5001/5173; restarted `npm start` (API+workers) and `npm run dev:client` (Vite).

### 2026-06-12 — Cannot GET / on port 5001
- **Prompt:** changed env from 5000 to 5001, but getting Cannot GET /
- **Outcome:** Explained API is API-only (no static UI on `/`). Set `VITE_API_URL=http://localhost:5001` in client/.env and started Vite on 5173.

### 2026-06-12 — Supabase project filesystem search
- **Prompt:** Brief update on background search task result
- **Outcome:** Home-wide search for project `ybfzpfouqmdacgfxieec` finished with exit code 2 (some WhatsApp paths unreadable). Matches were only anon-key env files — no `SUPABASE_SERVICE_ROLE_KEY` found on disk.

### 2026-06-12 — Full local project setup
- **Prompt:** Set up the whole project on system (Node, Docker, Redis, deps, etc.)
- **Outcome:** Installed Redis + PostgreSQL@16 via Homebrew (running), npm deps (root + client), ran 25 DB migrations, built UI, synced SUPABASE_URL from client/.env, added docker-compose.yml + scripts/setup-local.sh. Docker Desktop install needs manual sudo. Blocked on user adding SUPABASE_SERVICE_ROLE_KEY to .env.

### 2026-06-12 — Start local dev server
- **Prompt:** start a local dev server
- **Outcome:** Installed root deps, created `.env` from example, generated `ENCRYPTION_KEY` and `INTERNAL_API_KEY`, started `npm run dev` — blocked on missing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; Redis and Postgres not running locally.
ome:** Installed root deps, created `.env` from example, generated `ENCRYPTION_KEY` and `INTERNAL_API_KEY`, started `npm run dev` — blocked on missing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; Redis and Postgres not running locally.
