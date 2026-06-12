import { Button } from "@/components/ui/button";
import { loadAsset } from "@/lib/utils";
import { useGoogleLoginMutation } from "@/services/users";
import React from "react";
import { ReactSVG } from "react-svg";

interface Provider {
  name: string;
  iconUrl: string;
  callback: () => void;
}

const Providers: React.FC = () => {
  const { mutate: googleLogin } = useGoogleLoginMutation();
  const providers: Provider[] = [
    {
      name: "Google",
      iconUrl: loadAsset("google.svg", "svg"),
      callback: googleLogin,
    },
  ];
  return (
    <ul className="space-y-4">
      {providers.map((provider) => (
        <Button
          key={provider.name}
          variant="outline"
          className="flex w-full items-center justify-center space-x-2 py-2"
          onClick={() => {
            provider.callback();
          }}
        >
          <ReactSVG src={provider.iconUrl} aria-hidden={true} />
          <span className="text-sm font-medium">
            Sign in with {provider.name}
          </span>
        </Button>
      ))}
    </ul>
  );
};

export default Providers;
