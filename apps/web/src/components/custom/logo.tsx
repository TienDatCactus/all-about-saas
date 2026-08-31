import { Link } from "@tanstack/react-router"
import type { ImageProps } from "./image"
import { Image } from "./image"

import { cn, loadAsset } from "@/lib/utils"

type LogoProps = Omit<ImageProps, "src"> & {
  to?: string
}

/**
 * Renders both logos and lets the `dark:` variant pick one via CSS, instead
 * of reading theme from React state — that state starts at "system" on every
 * render (server and first client paint alike) and only resolves to the
 * stored preference in a post-mount effect, so the old JS-driven swap showed
 * the light logo first even in dark mode. The `dark` class on <html> is set
 * synchronously by an inline script before paint, so the CSS toggle here is
 * correct from the very first frame.
 */
export default function Logo({
  alt,
  to = "/",
  className,
  ...props
}: LogoProps) {
  return (
    <Link to={to} aria-label="Go to homepage">
      <Image
        {...props}
        src={loadAsset("logo.svg", "logo")}
        alt={alt}
        className={cn(className, "dark:hidden")}
      />
      <Image
        {...props}
        src={loadAsset("logo-dark.svg", "logo")}
        alt={alt}
        className={cn(className, "hidden dark:block")}
      />
    </Link>
  )
}
