import * as React from "react"
import { DownloadIcon } from "@phosphor-icons/react"
import { PhotoProvider, PhotoView } from "react-photo-view"
import "react-photo-view/dist/react-photo-view.css"
import { cn } from "@/lib/utils"

export interface DataImagePreviewImage {
  src: string
  alt?: string
  /** Suggested filename for the toolbar's download button. */
  downloadName?: string
}

export interface DataImagePreviewProps {
  images: DataImagePreviewImage | Array<DataImagePreviewImage>
  /**
   * Custom trigger element (e.g. an existing button) instead of the default
   * thumbnail grid. Only used when `images` is a single image — ignored for
   * a gallery of more than one.
   */
  children?: React.ReactElement
  /** Applied to the thumbnail grid container (default-thumbnail mode only). */
  className?: string
  /** Applied to each default thumbnail `<img>`. */
  imageClassName?: string
}

/**
 * Zoomable/pannable image preview built on react-photo-view. Pass one image
 * with a custom `children` trigger to wrap an existing button, or an array
 * for a click-to-zoom thumbnail gallery with built-in prev/next navigation.
 */
export function DataImagePreview({
  images,
  children,
  className,
  imageClassName,
}: DataImagePreviewProps) {
  const list = Array.isArray(images) ? images : [images]
  if (list.length === 0) return null

  const toolbarRender = ({ index }: { index: number }) => {
    const current = list[index]
    if (!current) return null
    return (
      <a
        href={current.src}
        download={current.downloadName ?? true}
        className="PhotoView-Slider__toolbarIcon"
        aria-label="Download image"
        onClick={(e) => e.stopPropagation()}
      >
        <DownloadIcon />
      </a>
    )
  }

  if (children && list.length === 1) {
    return (
      <PhotoProvider toolbarRender={toolbarRender}>
        <PhotoView src={list[0]?.src}>{children}</PhotoView>
      </PhotoProvider>
    )
  }

  return (
    <PhotoProvider toolbarRender={toolbarRender}>
      <div className={cn("flex flex-wrap gap-2", className)}>
        {list.map((image) => (
          <PhotoView key={image.src} src={image.src}>
            <img
              src={image.src}
              alt={image.alt ?? ""}
              className={cn(
                "size-16 cursor-zoom-in rounded-md border object-cover",
                imageClassName
              )}
            />
          </PhotoView>
        ))}
      </div>
    </PhotoProvider>
  )
}
