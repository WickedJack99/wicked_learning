---
name: wicked-ui-qa
description: Use when checking or fixing Wicked Learning frontend visual quality, theme consistency, cursor behavior, map visuals, settings layout, responsive/mobile behavior, overlays, scroll containment, hover/focus states, media previews, or React Flow interaction issues. Guides targeted browser verification and reusable UI abstraction.
---

# Wicked UI QA

Use this skill for visual and interaction polish.

## Inspect First

1. Identify the existing shared component or hook for the pattern.
2. Check whether the affected route uses map-specific visual values, public presentation values or authenticated appearance values.
3. Verify whether a main view should be body-scroll-free or internally scrollable.

## Consistency Checklist

- Accent color comes from the current map when the user is bound to a map.
- Public pages use public presentation colors.
- Settings and admin pages use the shared settings layout and current accent.
- Bottom navigation, side action bar, search, source link and panels share visual resolution helpers.
- Cursor images use the configured default, action pointer, text, drag and denied states unless a tool cursor intentionally overrides them.
- Image picker, sound picker, color picker and opacity controls use shared components.

## Browser QA

For UI changes, verify the smallest affected route in the browser when possible. Check:

- light and dark mode
- hover and click state
- scroll containment
- panel sizing
- custom cursor persistence
- console warnings related to the touched component

## Reporting

Mention what route or viewport was checked. If browser verification was not possible, say so plainly.
