import { Button } from "@/components/ui/button"
import { cn, loadAsset } from "@/lib/utils"
import { authApi } from "@/services/auth"
import React from "react"
import { ReactSVG } from "react-svg"

interface Provider {
  name: string
  iconUrl: string
  darkIconUrl?: string
  // The auth API's OAuth entry points are async (they resolve to a redirect),
  // so the callback is allowed to return a promise the caller fires and forgets.
  callback: (returnTo?: string) => void
}

/**
 * The in-app path to land on after the provider round-trip: wherever the
 * user is right now — which is exactly the page the login dialog is covering.
 * From an /auth/* page (dedicated login screen) going "back" there after a
 * successful login would be absurd, so those fall back to home.
 */
function currentReturnTo(): string {
  const path = window.location.pathname + window.location.search
  return path.startsWith("/auth") ? "/" : path
}
const providers: Array<Provider> = [
  {
    name: "Google",
    iconUrl: loadAsset("google.svg", "svg"),
    callback: authApi.loginWithGoogle,
  },
  {
    name: "Github",
    iconUrl: loadAsset("github.svg", "svg"),
    darkIconUrl: loadAsset("github-dark.svg", "svg"),
    callback: authApi.loginWithGithub,
  },
  {
    name: "Facebook",
    iconUrl: loadAsset("facebook.svg", "svg"),
    callback: authApi.loginWithFacebook,
  },
]
const Providers: React.FC = () => {
  return (
    <ul className="space-y-4">
      {providers.map((provider) => (
        <Button
          key={provider.name}
          variant="outline"
          className="flex w-full items-center justify-center space-x-2 py-2"
          onClick={() => {
            // Fire-and-forget: the callback just kicks off the OAuth redirect.
            void provider.callback(currentReturnTo())
          }}
        >
          <ReactSVG
            src={provider.iconUrl}
            aria-hidden={true}
            className={cn("", { "dark:hidden": !!provider.darkIconUrl })}
          />
          {provider?.darkIconUrl && (
            <ReactSVG src={provider.darkIconUrl} aria-hidden={true} />
          )}
          <span className="text-sm font-medium">
            Sign in with {provider.name}
          </span>
        </Button>
      ))}
    </ul>
  )
}

export default Providers
