# Visual Consistency Audit (Webapp)

Date: 2026-02-10  
Scope: `apps/webapp/src` visual consistency for functionally equivalent UI controls and sections  
Excludes: copy and spacing inconsistencies already documented in `qa/_findings/2026-02-09-ux-copy-inconsistencies.md`

## Findings

1. Custom-variable create vs edit modes use different form primitives for the same fields
- Create mode uses shared form abstractions (`ConfigNumericField`, `Form.Field`, `Form.Label`): `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:731`, `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:746`, `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:754`
- Edit mode renders equivalent controls with raw `Input` + native labels: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:767`, `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:799`, `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:828`, `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:845`
- Impact: same field types (name/amount/year range) have different visual language, error affordances, and control rhythm depending on mode.

2. Form label prominence differs for equivalent input fields in the same config surface
- Shared numeric fields use default `ConfigNumericField` label styling: `apps/webapp/src/lib/components/form/ConfigNumericField.svelte:156`
- Core config sections rely on those labels for primary numeric inputs: `apps/webapp/src/lib/components/form/ConfigBasicsSection.svelte:16`, `apps/webapp/src/lib/components/form/ConfigGrowthSection.svelte:33`
- Custom-variable inputs downshift labels to smaller muted text (`text-xs ... text-muted-foreground`): `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:696`, `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:715`
- Impact: functionally peer form controls feel like different hierarchy levels, even though they are part of one configuration workflow.

3. Same "edit field" action has inconsistent visibility behavior across breakpoints
- The edit action button on contribution fields is hidden on desktop until hover/focus (`md:opacity-0`) but always visible on smaller viewports: `apps/webapp/src/lib/components/form/ConfigNumericField.svelte:162`
- This action is used as the primary entry to edit contribution variables: `apps/webapp/src/lib/components/form/ConfigContributionSection.svelte:159`, `apps/webapp/src/lib/components/form/ConfigContributionSection.svelte:169`
- Impact: users get different visual affordance patterns for the same action depending on viewport, which makes discoverability feel inconsistent.

4. Peer projection sections use different container treatment (carded vs uncarded)
- Chart summary is wrapped in `Card.Root` and `Card.Content`: `apps/webapp/src/routes/+page.svelte:69`, `apps/webapp/src/routes/+page.svelte:70`
- Table view is rendered in a plain container without card shell: `apps/webapp/src/routes/+page.svelte:80`
- Impact: two sibling “result” modules at the same hierarchy level read as different component families.

5. Peer projection headings use different typographic weight/semantics
- Projection summary heading: `h2` with `text-xl font-semibold tracking-tight`: `apps/webapp/src/lib/components/projection/ProjectionChart.svelte:128`
- Table view heading: `h3` with `text-xl font-medium`: `apps/webapp/src/lib/components/projection/ProjectionTable.svelte:23`
- Impact: section headers for adjacent, same-level content do not share a consistent visual hierarchy.

6. Desktop vs mobile configuration headers are not typographically aligned
- Desktop config heading is explicitly styled as `text-2xl font-semibold` + body copy: `apps/webapp/src/routes/+page.svelte:89`, `apps/webapp/src/routes/+page.svelte:90`
- Mobile uses `Drawer.Title`/`Drawer.Description` default styling (`font-semibold` / `text-sm`) with no explicit matching scale: `apps/webapp/src/routes/+page.svelte:115`, `apps/webapp/src/routes/+page.svelte:116`, `apps/webapp/src/lib/components/ui/drawer/drawer-title.svelte:15`, `apps/webapp/src/lib/components/ui/drawer/drawer-description.svelte:15`
- Impact: same configuration panel presents with different visual emphasis between breakpoints.

7. Debug copy actions in one panel family have inconsistent sizing and emphasis
- JSON block copy control: `h-7 px-2 text-xs`: `apps/webapp/src/lib/components/debug/DebugJsonBlock.svelte:30`
- Panel-level copy-all control: `h-8 px-2 text-xs text-muted-foreground`: `apps/webapp/src/lib/components/debug/DebuggerPanel.svelte:230`
- Shared component default label suggests a third baseline (`Copy JSON`): `apps/webapp/src/lib/components/debug/DebugCopyButton.svelte:7`
- Impact: equivalent copy actions in the same debugger surface look like different control tiers without a clear intent.

## Suggested Normalization Direction

1. Pick one primitive path per control type (especially for custom-variable create/edit) and reuse it in both modes.
2. Define one label scale for configuration form fields and reserve muted/xs labels for helper metadata only.
3. Align peer module shells and heading tokens for chart/table result sections.
4. Make desktop/mobile configuration headers use the same token pair (title size + body size), adjusted only for spacing.
5. Establish one debugger copy-button token set (height, text treatment, and label pattern) and apply it to all copy actions.
