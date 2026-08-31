import { Link } from "@tanstack/react-router"
import type { ImageProps } from "./image"
import { Image } from "./image"

import { cn, loadAsset } from "@/lib/utils"

type LogoProps = Omit<ImageProps, "src"> & {
  to?: string
}

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
