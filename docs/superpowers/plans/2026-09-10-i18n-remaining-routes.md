# i18n: translate remaining routes (Vietnamese/English)

## Context

`react-i18next` is already wired up (see `apps/web/src/lib/i18n.ts`,
`apps/web/src/lib/context/language.tsx`, wrapped in
`apps/web/src/routes/__root.tsx`). Locale dictionaries live at
`apps/web/src/locales/en/common.json` and `apps/web/src/locales/vi/common.json`,
single `common` namespace, nested by feature area (e.g. `auth.login.*`,
`teacherRoom.sidebar.*`). Default language is Vietnamese (`vi`); English is
the fallback and second language. A header language toggle
(`apps/web/src/components/custom/page-shell/language-toggle.tsx`) already
lets users flip languages — no further work needed there.

Already migrated (use as the reference pattern, do not re-touch):
- `apps/web/src/pages/auth/login/components/Form.tsx`
- `apps/web/src/pages/teacher-room/layouts/sidebar.tsx`
- `apps/web/src/pages/teacher-room/layouts/components/NavMain.tsx`
- `apps/web/src/pages/teacher-room/layouts/components/NavUser.tsx`

The pattern per file: `import { useTranslation } from "react-i18next"`,
`const { t } = useTranslation()` inside the component, replace each
hardcoded user-facing string with `t("namespace.key")`, add the matching
key to BOTH `en/common.json` and `vi/common.json` (English text in `en`,
Vietnamese text in `vi` — for strings already in Vietnamese, copy them
verbatim into `vi` and write a natural English translation into `en`).

## Global Constraints

- Only extract literal, user-visible UI text: labels, button text, headings,
  placeholders, `sr-only` text, toast/error messages shown to the user,
  aria-labels. Do NOT touch: route paths, object/variable keys, CSS classes,
  test ids, console.log/error text, code comments, or values that come from
  the API/backend (e.g. `user.email`, `item.title` from props/data).
- Namespace every new key by feature area matching the file's location,
  consistent with the existing keys already in the JSON files (e.g. an auth
  sign-up file adds under `auth.signUp.*`, a badminton file adds under
  `badminton.<subarea>.*`). Reuse an existing key instead of duplicating it
  when the exact same string already exists in the dictionary (e.g. common
  words like "Save", "Cancel" — check for a `common.*` key first, add one
  there if missing and reused 2+ times in the task's own file set).
  You will get merge-conflict-shaped duplication if two tasks each add their
  own copy of a generic key — grep both JSON files before adding, and reuse.
  If your file set doesn't need pluralization/ICU, don't add any interpolation
  ceremony i18next already handles it if you ever do.
- Keep both `en/common.json` and `vi/common.json` valid JSON with the same
  key structure (same keys present in both files, just different values).
- Do not change component behavior, props, or layout — string swap only.
- Do not add a new i18next namespace, a new locale, or any new dependency.
  Everything needed (`react-i18next`, the `t` function, the JSON files) is
  already in place.
- After your changes, run `cd apps/web && npx tsc --noEmit` — it must stay
  clean.
- Do not modify `apps/web/src/lib/i18n.ts`, `apps/web/src/lib/context/language.tsx`,
  or the language toggle — only add JSON keys and swap strings for `t(...)`
  calls in the files your task lists.

## Task 1: Auth pages (except login form, already done)

Files:
- `apps/web/src/pages/auth/login/index.tsx`
- `apps/web/src/pages/auth/login/login-dialog.tsx`
- `apps/web/src/pages/auth/login/components/Providers.tsx`
- `apps/web/src/pages/auth/sign-up/index.tsx`
- `apps/web/src/pages/auth/sign-up/components/Form.tsx`
- `apps/web/src/pages/auth/reset-password/index.tsx`
- `apps/web/src/pages/auth/reset-password/components/Form.tsx`
- `apps/web/src/pages/auth/change-password/index.tsx`
- `apps/web/src/pages/auth/change-password/components/Form.tsx`
- `apps/web/src/pages/auth/layouts/auth.tsx`

Read `apps/web/src/pages/auth/login/components/Form.tsx` first — it's the
already-migrated sibling in this same feature area, follow its exact
pattern and its `auth.login.*` keys (reuse `auth.login.email` /
`auth.login.password` where sign-up/reset/change-password forms repeat the
same "Email"/"Password" labels, instead of adding duplicate keys). New keys
go under `auth.signUp.*`, `auth.resetPassword.*`, `auth.changePassword.*`,
`auth.login.*` (for the two login files not yet done) as appropriate.

Verify: `cd apps/web && npx tsc --noEmit` clean. No behavior change.

## Task 2: Badminton top-level pages and routes

Files:
- `apps/web/src/pages/badminton/edit/index.tsx`
- `apps/web/src/pages/badminton/list/index.tsx`
- `apps/web/src/pages/badminton/new/index.tsx`
- `apps/web/src/pages/badminton/share/index.tsx`
- `apps/web/src/routes/_authenticated/badminton/$sessionId.tsx`
- `apps/web/src/routes/_authenticated/badminton/index.tsx`
- `apps/web/src/routes/_authenticated/badminton/new.tsx`
- `apps/web/src/routes/_authenticated/badminton/route.tsx`

New keys go under `badminton.list.*`, `badminton.edit.*`, `badminton.new.*`,
`badminton.share.*` as appropriate to each file. TanStack Router route
files may set page `head`/`meta` titles — translate those too via `t(...)`
(call `i18n.t` directly, or `useTranslation` inside the route's component,
whichever the file's existing structure supports — check how
`apps/web/src/routes/__root.tsx` imports `i18n` if a route-config-level,
non-component context needs a translated string).

Verify: `cd apps/web && npx tsc --noEmit` clean. No behavior change.

## Task 3: Badminton components

Files:
- `apps/web/src/pages/badminton/components/HoursStepperInput.tsx`
- `apps/web/src/pages/badminton/components/ShareLink.tsx`
- `apps/web/src/pages/badminton/components/Summary.tsx`
- `apps/web/src/pages/badminton/components/payment-method-picker/AddMethodForm.tsx`
- `apps/web/src/pages/badminton/components/payment-method-picker/index.tsx`
- `apps/web/src/pages/badminton/components/player-editor/index.tsx`
- `apps/web/src/pages/badminton/components/player-editor/PlayerNameInput.tsx`
- `apps/web/src/pages/badminton/components/player-editor/PlayerRow.tsx`
- `apps/web/src/pages/badminton/components/session-editor/index.tsx`
- `apps/web/src/pages/badminton/components/session-editor/ShuttlePriceCalc.tsx`

New keys go under `badminton.players.*`, `badminton.session.*`,
`badminton.paymentMethod.*`, `badminton.shareLink.*`, `badminton.summary.*`
as fits each file. This task and Task 2 both touch the `badminton.*`
namespace — before adding a key, grep both JSON files for an existing
`badminton.*` match (Task 2 may already have run); reuse instead of
duplicating.

Verify: `cd apps/web && npx tsc --noEmit` clean. No behavior change.

## Task 4: Teacher-room timetable

Files:
- `apps/web/src/pages/teacher-room/timetable/index.tsx`
- `apps/web/src/routes/_authenticated/teacher-room/route.tsx`
- `apps/web/src/routes/_authenticated/teacher-room/timetable/index.tsx`

New keys go under `teacherRoom.timetable.*` — check
`apps/web/src/locales/en/common.json` first, the `teacherRoom.*` namespace
already exists from the sidebar migration, nest under it rather than
starting a new top-level key.

Verify: `cd apps/web && npx tsc --noEmit` clean. No behavior change.

## Task 5: Shared page-shell and data components

Files:
- `apps/web/src/components/custom/page-shell/theme-toggle.tsx`
- `apps/web/src/components/custom/page-shell/route-dropdown.tsx`
- `apps/web/src/components/custom/page-shell/user-menu.tsx`
- `apps/web/src/components/custom/logo.tsx`
- `apps/web/src/components/custom/data/attachment.tsx`
- `apps/web/src/components/custom/data/pagination.tsx`
- `apps/web/src/components/custom/data/image-preview.tsx`
- `apps/web/src/components/custom/toast/ui.tsx`

These are shared/cross-cutting components, not one feature — new keys go
under a `common.*` namespace (e.g. `common.pagination.*`,
`common.attachment.*`, `common.themeToggle.*`), since `common.save` /
`common.cancel` / `common.delete` already exist there. `logo.tsx`'s `alt`
text and any decorative-only strings that are not user-facing copy (e.g.
an `alt="logo"` default) can stay as-is if replacing them would add no
translatable value — use judgment, this file may need nothing.

Verify: `cd apps/web && npx tsc --noEmit` clean. No behavior change.
