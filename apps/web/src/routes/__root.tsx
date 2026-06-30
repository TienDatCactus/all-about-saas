import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MotionProvider, useMotion } from "@/lib/context/animation";
import { AuthProvider } from "@/lib/context/auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "All About SaaS",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  shellComponent: Providers,
});

const queryClient = new QueryClient();

function RootDocument({ children }: { children: React.ReactNode }) {
  const { preference } = useMotion();
  const reducedMotionMode =
    preference === "system" ? "user" : preference === "off" ? "always" : "never";
  return (
    <MotionConfig isValidProp={() => true} reducedMotion={reducedMotionMode}>
      <html lang="en" suppressHydrationWarning>
        <head>
          <HeadContent />
        </head>
        <body suppressHydrationWarning>
          <div className="flex min-h-dvh items-center justify-center">{children}</div>
          <Scripts />
        </body>
      </html>
    </MotionConfig>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <RootDocument>{children}</RootDocument>
          </TooltipProvider>
        </AuthProvider>
        <Toaster position="top-right" />
      </QueryClientProvider>
    </MotionProvider>
  );
}
