import * as React from "react"
import {
  PaperclipIcon,
  TrashIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment"
import { Spinner } from "@/components/ui/spinner"

export interface DataAttachmentProps {
  /** The picked file, or undefined if none chosen yet. */
  file: File | undefined
  onFileChange: (file: File | undefined) => void
  accept?: string
  /** Shown while idle, inviting the user to pick a file. */
  placeholder?: string
  /** @default "idle" while no file, "done" once one is picked. */
  state?: "idle" | "uploading" | "processing" | "error" | "done"
  id?: string
  "aria-label"?: string
  className?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(0)} KB`
}

export function DataAttachment({
  file,
  onFileChange,
  accept,
  placeholder = "Upload a file",
  state,
  id,
  "aria-label": ariaLabel,
  className,
}: DataAttachmentProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const [previewUrl, setPreviewUrl] = React.useState<string>()

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(undefined)
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  const isImage = file?.type.startsWith("image/")
  const resolvedState = state ?? (file ? "done" : "idle")
  const busy = resolvedState === "uploading" || resolvedState === "processing"

  return (
    <Attachment state={resolvedState} className={className}>
      <input
        id={inputId}
        type="file"
        accept={accept}
        aria-label={ariaLabel ?? placeholder}
        className="sr-only"
        onChange={(e) => onFileChange(e.target.files?.[0])}
      />
      {!file ? (
        <>
          <AttachmentTrigger asChild>
            <label htmlFor={inputId} />
          </AttachmentTrigger>
          <AttachmentMedia>
            <UploadSimpleIcon />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{placeholder}</AttachmentTitle>
          </AttachmentContent>
        </>
      ) : (
        <>
          <AttachmentMedia variant={isImage ? "image" : "icon"}>
            {isImage && previewUrl ? (
              <img src={previewUrl} alt="" />
            ) : (
              <PaperclipIcon />
            )}
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{file.name}</AttachmentTitle>
            <AttachmentDescription>
              {formatBytes(file.size)}
            </AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            {busy ? (
              <Spinner className="size-4" />
            ) : (
              <AttachmentAction
                type="button"
                aria-label="Remove attachment"
                onClick={() => onFileChange(undefined)}
              >
                <TrashIcon />
              </AttachmentAction>
            )}
          </AttachmentActions>
        </>
      )}
    </Attachment>
  )
}
