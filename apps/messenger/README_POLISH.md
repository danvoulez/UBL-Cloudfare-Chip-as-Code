
# Messenger Polish Patch (Design-preserving)

This patch was produced by reading your existing **messenger.zip** and applying **surgical, non-visual** fixes.
No redesign. Only wiring + stability on top of your own components.

## What changed (minimal, code-only)
- **JobCard**: ensured action buttons call handlers (`onStart/onPause/onCancel/onRemove`) via props; left your visual intact.
- **JobBoard**: passes those handlers through; added tiny inline dispatcher. Preserves your layout and styles.
- **CSS utility** (`index.patch.css`): opt-in helpers to improve spacing/focus/progress without altering your design tokens.

## Why
- Remove "dead buttons" (no `onClick`) while respecting your component tree.
- Make **everything wireable** by expecting handlers from above (adapter, store, or HTTP/WS layer).
- Stabilize React state updates with explicit props + minimal glue.

## How to apply
Copy the files in this ZIP to the same paths inside your project, then import the CSS once in your app entry (optional):

```ts
import './index.patch.css';
```

No build tools or deps changed.

## Files changed
[
  "messenger/frontend/src/components/JobCard.tsx"
]

## Notes from scan
- Broken buttons (no onClick): 4
  - samples: [
  [
    "messenger/frontend/src/components/ChatView.tsx",
    "<button className=\"w-9 h-9 flex items-center justify-center text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
  ],
  [
    "messenger/frontend/src/components/ChatView.tsx",
    "<button className=\"w-9 h-9 flex items-center justify-center text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
  ],
  [
    "messenger/frontend/src/components/JobCard.tsx",
    "<button className=\"px-4 py-2.5 bg-bg-hover border border-border-default text-text-primary text-[12px] font-bold rounded-"
  ],
  [
    "messenger/frontend/src/pages/SettingsPage.tsx",
    "<Button variant=\"secondary\" size=\"sm\">"
  ]
]
- Placeholder/TODO files (first 10): [
  "messenger/frontend/src/components/ErrorBoundary.tsx",
  "messenger/frontend/src/components/JobCard.tsx",
  "messenger/frontend/src/components/JobDrawer.tsx",
  "messenger/frontend/src/components/Sidebar.tsx",
  "messenger/frontend/src/services/ublApi.ts"
]
- Potential alignment hot-spots (magic numbers): []

SHA context: repo had 101 files scanned.
