import { DownloadIcon } from "@phosphor-icons/react"
import { Image } from "@/components/custom/image"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function QrPreviewDialog({
  label,
  imageUrl,
  trigger,
}: {
  label: string
  imageUrl: string
  trigger: React.ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <Image
          src={imageUrl}
          alt={`Payment QR: ${label}`}
          aspectRatio="square"
          objectFit="contain"
        />
        <Button asChild>
          <a href={imageUrl} download={`${label}-qr.png`}>
            <DownloadIcon data-icon="inline-start" />
            Download
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  )
}
