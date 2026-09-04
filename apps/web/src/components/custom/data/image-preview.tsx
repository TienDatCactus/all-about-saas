import * as React from "react";
import { DownloadIcon } from "@phosphor-icons/react";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

export interface DataImagePreviewImage {
  src: string;
  alt?: string;
  /** Suggested filename for the toolbar's download button. */
  downloadName?: string;
}

export interface DataImagePreviewProps {
  image: DataImagePreviewImage;
  /** Trigger element (e.g. an existing button) that opens the preview. */
  children: React.ReactElement;
}

/** Zoomable/pannable image preview built on react-photo-view. */
export function DataImagePreview({ image, children }: DataImagePreviewProps) {
  return (
    <PhotoProvider
      toolbarRender={() => (
        <a
          href={image.src}
          download={image.downloadName ?? true}
          className="PhotoView-Slider__toolbarIcon"
          aria-label="Download image"
          onClick={(e) => e.stopPropagation()}
        >
          <DownloadIcon />
        </a>
      )}
    >
      <PhotoView src={image.src}>{children}</PhotoView>
    </PhotoProvider>
  );
}
