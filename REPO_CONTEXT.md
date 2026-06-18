# All About SaaS - Repository Context & Architecture Audit

This document serves as a centralized single-source-of-truth mapping the codebase architecture, design system tokens, dependencies, configuration strategies, and audit results for the **All About SaaS** monorepo.

---

## 1. Monorepo Overview & Structure

The project is structured as an npm workspaces monorepo with Turborepo for orchestration.

```
all-about-saas/
├── apps/
│   ├── web/                    # TanStack Start / Vite Frontend
│   └── api/                    # NestJS API Backend
├── packages/
│   ├── transactional/          # React-Email templates library
│   ├── eslint-config/          # Shared ESLint config
│   └── typescript-config/      # Shared TypeScript compiler config
└── package.json                # Workspaces & Turborepo configuration
```

---

## 2. Frontend Architecture (`apps/web`)

A modern web application built on the **Vite + React 19** stack, utilizing progressive rendering and static routing.

### 2.1. Tech Stack & Key Libraries
- **Routing**: `TanStack Router` / `TanStack Start` (file-based routing under `src/routes/`, typed navigation, and server-side integration).
- **Styling**: **Tailwind CSS v4** (`@tailwindcss/vite` integrated as a plugin). Custom theme configurations are defined directly in CSS using `@theme` syntax instead of `tailwind.config.js`.
- **UI Components**: **shadcn/ui** built with Radix Luma styling using the **Taupe** base color palette.
- **State Management**: **XState v5** (`xstate` and `@xstate/react`) for complex workflows.
- **Async Data**: **React Query v5** (via `@tanstack/react-router-ssr-query`).
- **Icons**: **Phosphor Icons** (`@phosphor-icons/react` package, configured as the icon library in `components.json`).
- **Typography**: **Figtree Variable** (`@fontsource-variable/figtree`).

### 2.2. Style Configuration & Design Tokens
Defined in [apps/web/src/styles.css](file:///home/tiendatcactus/LocalSpace/all-about-saas/apps/web/src/styles.css):
* **Colors**: Warm-grey and high-contrast taupe tones mapped using `oklch`:
  * `--background`: `oklch(1 0 0)` (Pure White `#ffffff`)
  * `--foreground`: `oklch(0.147 0.004 49.3)` (Warm Charcoal `#242422`)
  * `--primary`: `oklch(0.5 0.134 242.749)` (Vibrant Royal Blue `#005fe3`)
  * `--muted`: `oklch(0.96 0.002 17.2)` (Warm Light Grey `#f5f4f0`)
  * `--border`: `oklch(0.922 0.005 34.3)` (Light Grey `#eaeae8`)
* **Radii**: Base border radius is set to `0.625rem` (`10px`).

---

## 3. Backend Architecture (`apps/api`)

A NestJS REST API using TypeORM for PostgreSQL database orchestration.

### 3.1. Modules & Components
- **AuthModule**: Handles authentication workflows:
  * Google OAuth SSO (Passport-Google Strategy and guards).
  * Local Email/Password authentication.
  * Session Tracking: Generates refresh tokens and saves active sessions to the PostgreSQL `session` table.
  * Tokens & Utilities: Helper methods in `TokensUtils` for password hashing and JWT encoding/decoding.
- **UsersModule**: Command and query command layers (`UsersCommandService`, `UsersQueryService`) managing User, VerificationToken, and OAuthAccount entities.
- **CaslModule**: Implements dynamic capability-based and policy-driven authorization utilizing **CASL** ability checks.
- **MailModule**: Integrates `@nestjs-modules/mailer` to process and send emails. Uses `@transactional/emails` to compile React-Email templates into HTML strings.

---

## 4. Email Design System (`packages/transactional`)

A library of transactional React-Email templates that compile down to standard HTML.

### 4.1. Core Configuration files
- **Tailwind Config** ([packages/transactional/src/theme.ts](file:///home/tiendatcactus/LocalSpace/all-about-saas/packages/transactional/src/theme.ts)):
  Maps the exact `oklch` values from the web app's `styles.css` into hex colors. Defines both standard shadcn names and backward-compatible Dither aliases (`bg`, `bg-2`, `fg`, `fg-2`, `fg-3`, `stroke`, `brand`, `canvas`).
- **Typography** ([packages/transactional/src/emails/styles/fonts.tsx](file:///home/tiendatcactus/LocalSpace/all-about-saas/packages/transactional/src/emails/styles/fonts.tsx)):
  Loads the Google Font **Figtree** dynamically, with standard fallback sans-serif configurations.
- **Master Layout** ([packages/transactional/src/emails/components/layout.tsx](file:///home/tiendatcactus/LocalSpace/all-about-saas/packages/transactional/src/emails/components/layout.tsx)):
  Standardizes margins, background colors, header logos, main body slot, and footers containing social icons and unsubscribe logic.

### 4.2. Local Dev Asset Copier Pattern
To bypass local asset reference limitations in email clients, the emails package:
1. Copies the frontend `public/` directory into `packages/transactional/src/emails/static/` via npm scripts:
   ```bash
   "dev:email": "rm -fr emails/static && cp -r public emails/static && email dev"
   ```
2. Resolves `baseUrl` helper inside [utils.ts](file:///home/tiendatcactus/LocalSpace/all-about-saas/packages/transactional/src/emails/utils.ts) dynamically:
   * **Local Email Dev (Port 4000)**: Resolves to `"/static"` to fetch images locally from the React-Email preview server directory.
   * **Backend API (Port 8000)**: Reads `process.env.FRONTEND_URL` to point image paths to the active frontend web server (port 3000) where the same public folder is served at root.

---

## 5. Ponytail Audit (Over-Engineering Check)

An audit of the codebase structure for abstractions, redundant configurations, and dead code:

* **DELETE**: `packages/transactional/src/emails/styles/theme.ts` (Dead code - duplicate configuration. The active tailwind configuration is centralized at `packages/transactional/src/theme.ts`). [Resolved]
* **DELETE**: `packages/transactional/src/components` (Dead code - folder containing layout/fonts duplicates. The package uses layout files placed under `packages/transactional/src/emails/components/` and `src/emails/styles/` respectively). [Resolved]
* **YAGNI**: `packages/transactional/.env` and `.env.example` (Abstraction/config - redundant local `.env` setup since the new dynamic `baseUrl` resolves environment parameters cleanly without relying on local `.env` variables).
* **SHRINK**: `apps/api/src/mail/mail.service.ts` (Shrunk types to import `EmailTemplate` union directly instead of raw strings).

---

## 6. Modern Web Guidelines (Baseline Compliance)

For client-side code and UI layout inside `apps/web`:
* **Forms & Access**: Enable native autofill options, descriptive labels, and phosphor icon layouts.
* **Layouts**: Use modern CSS layouts (Flexbox/CSS Grid), container queries, and native Tailwind v4 themes.
* **Performance**: Heavy rendering components must leverage fetch priorities and defer offscreen content where possible.
* **Compatibility**: Convert non-Baseline or custom color formats (like `oklch()`) to universal hex colors for emails to prevent rendering bugs in restrictive rendering engines (like Microsoft Outlook Desktop).
