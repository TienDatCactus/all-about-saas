import { Button } from "react-email";

interface EmailButtonProps {
  href?: string;
  text: string;
}

export default function EmailButton({
  href,
  text = "Explore",
}: EmailButtonProps) {
  return (
    <Button
      href={href}
      className="bg-brand font-15 font-inter text-fg-inverted inline-block border-none px-5 py-3.5 text-center"
    >
      {text}
    </Button>
  );
}
