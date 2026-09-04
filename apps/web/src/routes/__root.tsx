import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MotionConfig } from "motion/react"
import LoadingBar from "react-top-loading-bar"
import appCss from "../styles.css?url"
import { getErrorStatus } from "@/lib/utils/http"
import { registerLoadingBar } from "@/lib/utils/loading-bar"
import { ConfirmProvider } from "@/components/custom/confirm"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MotionProvider, useMotion } from "@/lib/context/animation"
import { AuthProvider } from "@/lib/context/auth"
import { ThemeProvider } from "@/lib/context/theme"
import { Dithered404 } from "@/components/dithered-404"

export const Route = createRootRoute({
  staticData: { crumb: "Home" },
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
      <Dithered404 />
    </main>
  ),
  errorComponent: ({ error, reset }) => {
    return (
      <div>
        <h2>Something went wrong!</h2>
        <p>{error.message}</p>
        <button onClick={() => reset()}>Try Again</button>
      </div>
    )
  },
  shellComponent: Providers,
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = getErrorStatus(error)
        // No status = no server verdict (network drop, timeout). Worth a retry.
        // A schema mismatch also lands here, and retrying won't fix it — but
        // two extra requests is a cheap price for not special-casing it.
        if (status === undefined) return failureCount < 2
        if (status >= 400 && status < 500) return false
        return failureCount < 2
      },
    },
  },
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { preference } = useMotion()
  const reducedMotionMode =
    preference === "system" ? "user" : preference === "off" ? "always" : "never"
  return (
    <MotionConfig isValidProp={() => true} reducedMotion={reducedMotionMode}>
      <html lang="en" suppressHydrationWarning>
        <head>
          <HeadContent />
        </head>
        <body suppressHydrationWarning>
          <LoadingBar
            ref={registerLoadingBar}
            color="var(--primary)"
            height={2}
          />
          <div className="flex min-h-dvh items-center justify-center">
            {children}
          </div>
          <Scripts />
        </body>
      </html>
    </MotionConfig>
  )
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <MotionProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <ConfirmProvider>
                <RootDocument>{children}</RootDocument>
              </ConfirmProvider>
            </TooltipProvider>
          </AuthProvider>
          <Toaster position="top-right" />
        </QueryClientProvider>
      </MotionProvider>
    </ThemeProvider>
  )
}
