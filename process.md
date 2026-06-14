## Log (newest first)

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
