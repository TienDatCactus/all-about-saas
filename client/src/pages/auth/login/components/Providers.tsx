import { Button } from "@/components/ui/button"
import { loadAsset } from "@/lib/utils"
import React from "react"
import { ReactSVG } from "react-svg"

interface Provider {
  name: string
  iconUrl: string
}

const Providers: React.FC = () => {
  const providers: Provider[] = [
    {
      name: "Google",
      iconUrl: loadAsset("google.svg", "svg"),
    },
  ]
  return (
    <ul className="space-y-4">
      {providers.map((provider) => (
        <Button
          key={provider.name}
          variant="outline"
          className="flex w-full items-center justify-center space-x-2 py-2"
          asChild
        >
          <a href="#">
            <ReactSVG src={provider.iconUrl} aria-hidden={true} />
            <span className="text-sm font-medium">
              Sign in with {provider.name}
            </span>
          </a>
        </Button>
      ))}
    </ul>
  )
}

export default Providers
