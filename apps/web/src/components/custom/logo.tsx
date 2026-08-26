import { Link } from "@tanstack/react-router"
import type { ImageProps } from "./image"
import { Image } from "./image"

import { loadAsset } from "@/lib/utils"
import { useTheme } from "@/lib/context/theme"

type LogoProps = Omit<ImageProps, "src"> & {
  to?: string
}

export default function Logo({ alt, to = "/", ...props }: LogoProps) {
  const { theme } = useTheme()
  const asset =
    theme == "dark"
      ? loadAsset("logo-dark.svg", "logo")
      : loadAsset("logo.svg", "logo")
  return (
    <Link to={to} aria-label="Go to homepage">
      <Image {...props} src={asset} alt={alt} />
    </Link>
  )
}
