import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import type { ImageProps } from "./image"
import { Image } from "./image"

import { cn, loadAsset } from "@/lib/utils"
import { useTheme } from "@/lib/context/theme"

type LogoProps = Omit<ImageProps, "src"> & {
  to?: string
}

export default function Logo({
  alt,
  to = "/",
  className,
  ...props
}: LogoProps) {
  const { isDarkMode } = useTheme()
  const { t } = useTranslation()
  return (
    <Link
      to={to}
      aria-label={t("common.logo.ariaLabel")}
      className={cn("block", className)}
    >
      <Image
        {...props}
        src={loadAsset("logo.svg", "logo")}
        alt={alt}
        hidden={isDarkMode}
      />
      <Image
        {...props}
        src={loadAsset("logo-dark.svg", "logo")}
        alt={alt}
        hidden={!isDarkMode}
      />
    </Link>
  )
}
