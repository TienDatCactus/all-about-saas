# Email Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cohesive, clean, highly compatible email UI design system inside the `@transactional/emails` package matching the Radix Luma Taupe theme of the web application.

**Architecture:** Create a unified Tailwind configuration in the email package that maps variables from `styles.css` to static hex-based color tokens. Establish a Master Email Layout wrapper component that handles headers, logos, custom typography loading, and standard email client compatible footers.

**Tech Stack:** React, `@react-email/components`, Tailwind CSS (React-Email Tailwind parser).

## Global Constraints
- Target: Align email visual aesthetics with the radix-luma style and taupe base color tokens.
- Map OKLCH colors, CSS custom variables, and radii to static hex values and absolute units.
- Emulate the Phosphor icon set for visual items.
- Ensure all templates compile cleanly under the monorepo workspace.

---

### Task 1: Theme and Font Scaffolding

**Files:**
- Create: [packages/transactional/src/theme.ts](file:///home/tiendatcactus/LocalSpace/all-about-saas/packages/transactional/src/theme.ts)
- Create: [packages/transactional/src/components/fonts.tsx](file:///home/tiendatcactus/LocalSpace/all-about-saas/packages/transactional/src/components/fonts.tsx)

**Interfaces:**
- Consumes: None
- Produces: 
  * `emailTailwindConfig` (Tailwind config object)
  * `EmailFonts` (React Functional Component returning Font elements)

- [ ] **Step 1: Create the theme configuration file**

Create the file [packages/transactional/src/theme.ts](file:///home/tiendatcactus/LocalSpace/all-about-saas/packages/transactional/src/theme.ts) with the following content:
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
        lg: '10px',
        md: '8px',
        sm: '6px',
      },
    },
  },
};
```

- [ ] **Step 2: Create the fonts loader component**

Create the file [packages/transactional/src/components/fonts.tsx](file:///home/tiendatcactus/LocalSpace/all-about-saas/packages/transactional/src/components/fonts.tsx) with the following content:
```typescript
import { Font } from '@react-email/components';
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

- [ ] **Step 3: Verify scaffolding compiles**

Run the following command inside `packages/transactional` directory to compile TS:
Run: `npm run build`
Expected: PASS with no compilation errors.

- [ ] **Step 4: Commit changes**

```bash
git add packages/transactional/src/theme.ts packages/transactional/src/components/fonts.tsx
git commit -m "feat(emails): add theme configuration and fonts loader"
```

---

### Task 2: Layout Component Integration

**Files:**
- Create: [packages/transactional/src/components/layout.tsx](file:///home/tiendatcactus/LocalSpace/all-about-saas/packages/transactional/src/components/layout.tsx)

**Interfaces:**
- Consumes:
  * `emailTailwindConfig` (from `./theme.ts`)
  * `EmailFonts` (from `./fonts.tsx`)
- Produces:
  * `EmailLayout` (React component wrapping other email contents)

- [ ] **Step 1: Create the Master Layout component**

Create the file [packages/transactional/src/components/layout.tsx](file:///home/tiendatcactus/LocalSpace/all-about-saas/packages/transactional/src/components/layout.tsx) with the following content:
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
} from '@react-email/components';
import * as React from 'react';
import { EmailFonts } from './fonts';
import { emailTailwindConfig } from '../theme';

interface EmailLayoutProps {
  previewText: string;
  companyName?: string;
  children: React.ReactNode;
}

const baseUrl = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:8000';

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
                src={`${baseUrl}/logo/bordered.png`}
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
              <Text className="text-sm text-muted-foreground m-0 max-w-[400px] leading-relaxed">
                {companyName} helps SaaS builders ship faster with standard patterns, structured workflows, and clean code.
              </Text>
              
              {/* Footer Social Links */}
              <Row align="left" className="mt-6">
                <Column className="w-[32px]">
                  <Link href="https://twitter.com" className="inline-block">
                    <Img src="https://img.icons8.com/ios-filled/50/8a8a86/twitterx--v2.png" alt="X" width="20" height="20" />
                  </Link>
                </Column>
                <Column className="w-[32px]">
                  <Link href="https://github.com" className="inline-block">
                    <Img src="https://img.icons8.com/ios-filled/50/8a8a86/github.png" alt="GitHub" width="20" height="20" />
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

- [ ] **Step 2: Verify compilation**

Run build script:
Run: `npm run build` in `packages/transactional`
Expected: PASS

- [ ] **Step 3: Commit changes**

```bash
git add packages/transactional/src/components/layout.tsx
git commit -m "feat(emails): create master email layout wrapper"
```

---

### Task 3: Template Integration & Re-exports

**Files:**
- Modify: [packages/transactional/src/index.ts](file:///home/tiendatcactus/LocalSpace/all-about-saas/packages/transactional/src/index.ts)
- Modify: [packages/transactional/src/emails/email.tsx](file:///home/tiendatcactus/LocalSpace/all-about-saas/packages/transactional/src/emails/email.tsx)

**Interfaces:**
- Consumes:
  * `EmailLayout` (from `./components/layout.tsx`)
- Produces:
  * Updated exports in `src/index.ts`

- [ ] **Step 1: Re-export the EmailLayout component**

Update [packages/transactional/src/index.ts](file:///home/tiendatcactus/LocalSpace/all-about-saas/packages/transactional/src/index.ts) to export `EmailLayout` and export the correct welcome template:
```typescript
import Email from "./emails/email";

import { render } from "@react-email/render";
import React from "react";

export { EmailLayout } from "./components/layout";

export const emails = {
  welcome: Email,
};

export type EmailTemplate = keyof typeof emails;

export function renderTemplate(
  template: EmailTemplate,
  props?: any,
) {
  const EmailComponent = emails[template];

  return render(React.createElement(EmailComponent, props));
}
```

- [ ] **Step 2: Update default welcome template**

Rewrite [packages/transactional/src/emails/email.tsx](file:///home/tiendatcactus/LocalSpace/all-about-saas/packages/transactional/src/emails/email.tsx):
```typescript
import { Heading, Text, Button } from '@react-email/components';
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

- [ ] **Step 3: Rebuild package**

Run: `npm run build` in `packages/transactional`
Expected: PASS

- [ ] **Step 4: Commit changes**

```bash
git add packages/transactional/src/index.ts packages/transactional/src/emails/email.tsx
git commit -m "feat(emails): update welcome email template and re-export layout"
```

---

### Task 4: End-to-End Build and API Validation

**Files:**
- None (verification tasks only)

- [ ] **Step 1: Build the entire monorepo**

Run this command at the workspace root to ensure all packages build and links compile cleanly:
Run: `npm run build`
Expected: PASS with all packages successfully compiled.

- [ ] **Step 2: Start API database and server**

Start docker-compose database and then NestJS API server in development mode.
Expected: Database starts successfully, NestJS compiles and starts on port 8000.
