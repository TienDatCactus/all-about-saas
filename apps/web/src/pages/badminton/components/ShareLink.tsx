import { LinkIcon } from "@phosphor-icons/react"
import { toast } from "@/components/custom/toast"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

export function ShareLink({ shareToken }: { shareToken: string }) {
  const path = `/badminton/s/${shareToken}`

  const handleCopy = async () => {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}${path}` : path
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Share link copied")
    } catch {
      toast.error("Couldn't copy the link")
    }
  }

  return (
    <InputGroup>
      <InputGroupAddon>
        <LinkIcon />
      </InputGroupAddon>
      <InputGroupInput
        readOnly
        value={path}
        aria-label="Public share link"
        className="text-muted-foreground"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton type="button" onClick={handleCopy}>
          Copy link
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
