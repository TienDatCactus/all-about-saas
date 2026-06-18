# Email Design System Design Document

This design document specifies the architecture, configurations, and components required to build a compatible and unified email UI design system inside the `@transactional/emails` package (`packages/transactional`).

## 1. Context & Objectives
- **Target**: Align email visual aesthetics (typography, colors, borders, margins) with the **radix-luma** style and **taupe** base color tokens defined in the web app's [components.json](file:///home/tiendatcactus/LocalSpace/all-about-saas/apps/web/components.json) and [styles.css](file:///home/tiendatcactus/LocalSpace/all-about-saas/apps/web/src/styles.css).
- **Format**: Renders statically compiled HTML via React-Email.
- **Constraints**: Map dynamic features (like OKLCH colors, CSS custom variables) to safe, fallback-compatible hex colors to ensure correct display in Outlook, Gmail, and other major email clients.
- **Icon Library**: Emulate the Phosphor icon set for visual items (such as social links).

---

## 2. Technical Architecture & File Structure

We will create a structured layout module within `packages/transactional/src`:

```
packages/transactional/
├── src/
│   ├── theme.ts               # Core Tailwind hex color mapping (Radix-Luma & Taupe)
│   ├── index.ts               # Re-exports templates & rendering utils
│   ├── components/
│   │   ├── fonts.tsx          # Google Font loader (Figtree)
│   │   └── layout.tsx         # Master email layout wrapper
│   └── emails/
│       └── email.tsx          # Default welcome/test email using the design system
```

---

## 3. Detailed Specifications

### 3.1. Design Tokens & Theme Configuration (`src/theme.ts`)
We will configure static Tailwind styles representing the web application's design system tokens (calculated from `styles.css` Luma/Taupe scale):

* **Font Sans**: `Figtree, ui-sans-serif, system-ui, -apple-system, sans-serif` (matches `--font-sans`)
* **Base Background**: `#ffffff` (matches `--background`: `oklch(1 0 0)`)
* **Muted Background**: `#f5f5f3` (matches `--muted`: `oklch(0.96 0.002 17.2)`)
* **Foreground (Text)**: `#242422` (matches `--foreground`: `oklch(0.147 0.004 49.3)`)
* **Muted Foreground**: `#8a8a86` (matches `--muted-foreground`: `oklch(0.547 0.021 43.1)`)
* **Primary (Brand Blue)**: `#005fe3` (matches `--primary`: `oklch(0.5 0.134 242.749)`)
* **Primary Foreground**: `#ffffff` (matches `--primary-foreground`: `oklch(0.977 0.013 236.62)`)
* **Border / Input**: `#eaeae8` (matches `--border` / `--input`: `oklch(0.922 0.005 34.3)`)

```typescript
export const emailTailwindConfig = {
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        muted: '#f5f5f3',
        foreground: '#242422',
        'muted-foreground': '#8a8a86',
        primary: {
          DEFAULT: '#005fe3',
          foreground: '#ffffff',
        },
        border: '#eaeae8',
      },
      fontFamily: {
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        lg: '10px',  // matches var(--radius): 0.625rem
        md: '8px',   // calc(var(--radius) * 0.8)
        sm: '6px',   // calc(var(--radius) * 0.6)
      },
    },
  },
};
```

### 3.2. Google Web Fonts Loader (`src/components/fonts.tsx`)
Loads the **Figtree** font dynamically from Google Fonts for compatible devices.

```typescript
import { Font } from 'react-email';
import * as React from 'react';

export function EmailFonts() {
  return (
    <>
      <Font
        fontFamily="Figtree"
        fallbackFontFamily="sans-serif"
        webFont={{
          url: 'https://fonts.gstatic.com/s/figtree/v6/w5F1zDqG7TQdvKC2Qd-2Puhq.woff2',
          format: 'woff2',
        }}
        fontWeight={400}
        fontStyle="normal"
      />
      <Font
        fontFamily="Figtree"
        fallbackFontFamily="sans-serif"
        webFont={{
          url: 'https://fonts.gstatic.com/s/figtree/v6/w5F1zDqG7TQdvKC2Qd-3Puhq.woff2',
          format: 'woff2',
        }}
        fontWeight={600}
        fontStyle="normal"
      />
    </>
  );
}
```

### 3.3. Master Email Layout (`src/components/layout.tsx`)
A wrapper layout supplying standard header, logo, margins, main content slot (`children`), and footer content. It utilizes clean borders and minimal lines matching the Radix Luma flat UI style.

```typescript
import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Column,
  Section,
  Tailwind,
  Text,
} from 'react-email';
import * as React from 'react';
import { EmailFonts } from './fonts';
import { emailTailwindConfig } from '../theme';

interface EmailLayoutProps {
  previewText: string;
  companyName?: string;
  children: React.ReactNode;
}

const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';

export function EmailLayout({
  previewText,
  companyName = 'All About SaaS',
  children,
}: EmailLayoutProps) {
  return (
    <Tailwind config={emailTailwindConfig}>
      <Html>
        <Head>
          <EmailFonts />
        </Head>
        <Body className="bg-muted m-0 p-0 font-sans text-foreground">
          <Preview>{previewText}</Preview>
          <Container className="bg-background mx-auto max-w-[600px] border border-solid border-border my-10 rounded-lg overflow-hidden">
            {/* Header: Company Logo */}
            <Section className="px-8 pt-8 pb-6 border-b border-solid border-border">
              <Img
                src={`${baseUrl}/static/logo.png`}
                alt={companyName}
                width="32"
                height="32"
                className="block"
              />
            </Section>

            {/* Email Body Content */}
            <Section className="px-8 py-10">
              {children}
            </Section>

            {/* Footer */}
            <Section className="px-8 py-8 border-t border-solid border-border bg-muted">
              <Text className="text-sm text-muted-foreground m-0 max-w-[400px]">
                {companyName} helps SaaS builders ship faster with standard patterns, structured workflows, and clean code.
              </Text>
              
              {/* Phosphor-inspired SVG or asset social links */}
              <Row align="left" className="mt-6">
                <Column className="w-[32px]">
                  <Link href="https://twitter.com" className="inline-block">
                    <Img src={`${baseUrl}/static/social-x.png`} alt="X" width="20" height="20" />
                  </Link>
                </Column>
                <Column className="w-[32px]">
                  <Link href="https://github.com" className="inline-block">
                    <Img src={`${baseUrl}/static/social-github.png`} alt="GitHub" width="20" height="20" />
                  </Link>
                </Column>
              </Row>

              <Text className="text-xs text-muted-foreground m-0 mt-6">
                123 Market Street, Floor 1, Tech City, CA, 94102
              </Text>
              <Text className="text-xs text-muted-foreground m-0 mt-2">
                You are receiving this transaction email regarding your account.{' '}
                <Link href="https://example.com/unsubscribe" className="text-muted-foreground underline">
                  Unsubscribe
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}
```

### 3.4. Updating the Default Template (`src/emails/email.tsx`)
We will rewrite the default welcoming template inside `packages/transactional/src/emails/email.tsx` to match the design system:

```typescript
import { Heading, Text, Button } from 'react-email';
import * as React from 'react';
import { EmailLayout } from '../components/layout';

export default function WelcomeEmail() {
  return (
    <EmailLayout previewText="Welcome to All About SaaS!">
      <Heading className="text-2xl font-bold font-sans tracking-tight text-foreground m-0 mb-4">
        Welcome to the platform
      </Heading>
      <Text className="text-base font-sans text-foreground m-0 mb-6 leading-relaxed">
        We are thrilled to have you here. This platform helps teams build, deploy, and scale modern web applications fast.
      </Text>
      <Button
        href="https://example.com/dashboard"
        className="bg-primary text-primary-foreground font-sans text-sm font-semibold rounded-lg px-6 py-3 text-center inline-block"
      >
        Go to Dashboard
      </Button>
    </EmailLayout>
  );
}
```

---

## 4. Verification Plan
- **Build Checks**: Execute `npm run build` in the monorepo root to verify successful compilation of TSX to JS in `packages/transactional`.
- **Render Checks**: Verify that backend endpoints (like `POST /mail/try`) can correctly render the compiled HTML template structure and send it without warnings.
