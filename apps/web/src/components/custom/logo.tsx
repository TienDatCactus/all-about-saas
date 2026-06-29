import { Link } from "@tanstack/react-router";
import { Image, type ImageProps } from "./image";

import logo from "/logo/logo.svg";

type LogoProps = Omit<ImageProps, "src"> & {
  to?: string;
};

export default function Logo({ alt, to = "/", ...props }: LogoProps) {
  return (
    <Link to={to} aria-label="Go to homepage">
      <Image {...props} src={logo} alt={alt ?? "Logo"} />
    </Link>
  );
}
