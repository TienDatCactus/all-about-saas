"use client";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ImageBrokenIcon, ImageIcon } from "@phosphor-icons/react";
import { useEffect, useReducer, useRef, useState } from "react";
import useImage from "use-image";
import { imageReducer } from "./reducer";

// ─── Installation ─────────────────────────────────────────────────────────────
// npm install use-image
// npx shadcn@latest add skeleton
// npx shadcn@latest add empty

// ─── Types ────────────────────────────────────────────────────────────────────

type AspectRatio = "square" | "4/3" | "16/9" | "3/4" | "2/1" | (string & {});
type ObjectFit = "cover" | "contain" | "fill" | "none" | "scale-down";

export interface ImageProps {
  /** Source URL. Undefined/empty shows the empty state. */
  src?: string;

  /**
   * Shown when src fails to load.
   * Falls back to the error empty state if also absent.
   */
  fallbackSrc?: string;

  /** Required for accessibility. Pass "" for decorative images. */
  alt: string;

  /**
   * Locks the container aspect ratio to prevent layout shift.
   * Accepts preset names or any valid CSS aspect-ratio string e.g. "3/1".
   * @default "square"
   */
  aspectRatio?: AspectRatio;

  /** @default "cover" */
  objectFit?: ObjectFit;

  /** CSS object-position. @default "center" */
  objectPosition?: string;

  /**
   * Disables lazy loading — use for hero / LCP images.
   * @default false
   */
  priority?: boolean;

  /**
   * Retry the original src N times (exp. backoff) before falling
   * through to fallbackSrc and then the error empty state.
   * @default 0
   */
  retries?: number;

  /** Base delay (ms) between retries. Doubles each attempt. @default 1000 */
  retryDelay?: number;

  /**
   * Show a blurred CSS placeholder while loading.
   * Combine with blurDataURL for a dominant-color / tiny-thumbnail effect.
   * @default false
   */
  blurPlaceholder?: boolean;

  /** Tiny base64 image rendered blurred behind the main image during load. */
  blurDataURL?: string;

  /** Fills the container before the image loads (e.g. dominant color). */
  placeholderColor?: string;

  /** Fires once the image loads successfully. */
  onLoad?: () => void;

  /** Fires after all retries + fallback are exhausted. */
  onError?: () => void;

  /**
   * CORS attribute passthrough — needed when using the image on a canvas
   * (WebGL, color extraction, etc.).
   */
  crossOrigin?: "anonymous" | "use-credentials";

  /** Referrer policy forwarded to use-image. */
  referrerPolicy?:
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "origin"
    | "origin-when-cross-origin"
    | "same-origin"
    | "strict-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url";

  // ── Slots ────────────────────────────────────────────────────────────────

  /**
   * Replaces the default shadcn <Skeleton> shown while loading.
   * Receives the same size as the image container.
   */
  loadingSlot?: React.ReactNode;

  /**
   * Replaces the default shadcn <Empty> shown when src is undefined/empty.
   * Use to provide a branded "no image yet" state.
   */
  emptySlot?: React.ReactNode;

  /**
   * Replaces the default shadcn <Empty> shown after all load attempts fail.
   */
  errorSlot?: React.ReactNode;

  /** Applied to the outer container div. */
  className?: string;

  /** Applied to the <img> element. */
  imgClassName?: string;

  style?: React.CSSProperties;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ASPECT_MAP: Record<string, string> = {
  square: "1 / 1",
  "4/3": "4 / 3",
  "16/9": "16 / 9",
  "3/4": "3 / 4",
  "2/1": "2 / 1",
};

function toAspect(value: AspectRatio = "square") {
  return ASPECT_MAP[value] ?? value;
}

// ─── Inner loader (uses use-image, conditionally rendered) ────────────────────
//
// use-image must be called unconditionally, so we isolate it in a subcomponent
// that is only mounted when we actually have a src to load.

interface LoaderProps {
  src: string;
  fallbackSrc?: string;
  alt: string;
  objectFit: ObjectFit;
  objectPosition: string;
  priority: boolean;
  retries: number;
  retryDelay: number;
  blurPlaceholder: boolean;
  blurDataURL?: string;
  crossOrigin?: "anonymous" | "use-credentials";
  referrerPolicy?:
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "origin"
    | "origin-when-cross-origin"
    | "same-origin"
    | "strict-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url";
  onLoad?: () => void;
  onError?: () => void;
  loadingSlot?: React.ReactNode;
  errorSlot?: React.ReactNode;
  imgClassName?: string;
}

function ImageLoader({
  src,
  fallbackSrc,
  alt,
  objectFit,
  objectPosition,
  priority,
  retries,
  retryDelay,
  blurPlaceholder,
  blurDataURL,
  crossOrigin,
  referrerPolicy,
  onLoad,
  onError,
  loadingSlot,
  errorSlot,
  imgClassName,
}: LoaderProps) {
  // ── Retry logic —————————————————————————————————————————————————————————
  // use-image has no built-in retry, so we manage the active URL ourselves.
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isMounted = useRef(true);
  const [state, dispatch] = useReducer(imageReducer, {
    activeSrc: src,
    usedFallback: false,
    visible: false,
  });
  // Reset when the prop src changes
  useEffect(() => {
    retryCount.current = 0;
    clearTimeout(retryTimer.current);
    dispatch({
      type: "reset",
      src,
    });
  }, [src]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      clearTimeout(retryTimer.current);
    };
  }, []);

  // ── use-image ────────────────────────────────────────────────────────────
  const [image, status] = useImage(state.activeSrc, crossOrigin, referrerPolicy);

  useEffect(() => {
    if (status === "loaded") {
      dispatch({
        type: "loaded",
      });
      onLoad?.();
      return;
    }

    if (status !== "failed") return;

    // Still have retries on the original src
    if (!state.usedFallback && retryCount.current < retries) {
      retryCount.current += 1;
      const delay = retryDelay * Math.pow(2, retryCount.current - 1);
      retryTimer.current = setTimeout(() => {
        if (!isMounted.current) return;
        // Append timestamp to bust the browser cache
        const busted = new URL(src, window.location.href);
        busted.searchParams.set("_retry", String(retryCount.current));
        dispatch({
          type: "retry",
          src: busted.toString(),
        });
      }, delay);
      return () => clearTimeout(retryTimer.current);
    }

    // Try fallbackSrc once
    if (!state.usedFallback && fallbackSrc) {
      dispatch({
        type: "fallback",
        src: fallbackSrc,
      });
      return;
    }

    // All options exhausted
    onError?.();
  }, [status, state.usedFallback, retries, retryDelay, src, fallbackSrc, onLoad, onError]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ───────────────────────────────────────────────────────────────

  const isLoading = status === "loading";
  const isFailed =
    status === "failed" && (state.usedFallback || !fallbackSrc) && retryCount.current >= retries;

  return (
    <>
      {/* Blur placeholder (sits behind the image, fades when loaded) */}
      {blurPlaceholder && blurDataURL && !state.visible && (
        <img
          src={blurDataURL}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover scale-105"
          style={{ filter: "blur(10px)", transition: "opacity 0.4s" }}
        />
      )}

      {/* Loading skeleton */}
      {isLoading &&
        (loadingSlot ?? <Skeleton className="absolute inset-0 h-full w-full rounded-none" />)}

      {/* Error empty state */}
      {isFailed && (errorSlot ?? <DefaultErrorEmpty />)}

      {/* The image itself */}
      {image && (
        <img
          src={image.src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          crossOrigin={crossOrigin}
          referrerPolicy={referrerPolicy}
          className={cn(
            "absolute inset-0 h-full w-full transition-opacity duration-300",
            state.visible ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
          style={{ objectFit, objectPosition }}
        />
      )}
    </>
  );
}

// ─── Default empty-state slots ────────────────────────────────────────────────

function DefaultNoSrcEmpty() {
  return (
    <Empty className="absolute inset-0 flex flex-col items-center justify-center">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ImageIcon />
        </EmptyMedia>
        <EmptyTitle>No image</EmptyTitle>
        <EmptyDescription>No image source provided.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function DefaultErrorEmpty() {
  return (
    <Empty className="absolute inset-0 flex flex-col items-center justify-center">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ImageBrokenIcon />
        </EmptyMedia>
        <EmptyTitle>Image unavailable</EmptyTitle>
        <EmptyDescription>This image could not be loaded.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

// ─── SmartImage ───────────────────────────────────────────────────────────────

export function Image({
  src,
  fallbackSrc,
  alt,
  aspectRatio = "square",
  objectFit = "cover",
  objectPosition = "center",
  priority = false,
  retries = 0,
  retryDelay = 1000,
  blurPlaceholder = false,
  blurDataURL,
  placeholderColor,
  onLoad,
  onError,
  crossOrigin,
  referrerPolicy,
  loadingSlot,
  emptySlot,
  errorSlot,
  className,
  imgClassName,
  style,
}: ImageProps) {
  const hasSrc = Boolean(src);

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        aspectRatio: toAspect(aspectRatio),
        backgroundColor: placeholderColor,
        ...style,
      }}
      aria-busy={hasSrc}
    >
      {!hasSrc ? (
        // No src — show empty state immediately, don't mount the loader at all
        (emptySlot ?? <DefaultNoSrcEmpty />)
      ) : (
        // Mount the loader only when we have a src so useImage is called
        // unconditionally inside a component that only renders when needed.
        <ImageLoader
          src={src!}
          fallbackSrc={fallbackSrc}
          alt={alt}
          objectFit={objectFit}
          objectPosition={objectPosition}
          priority={priority}
          retries={retries}
          retryDelay={retryDelay}
          blurPlaceholder={blurPlaceholder}
          blurDataURL={blurDataURL}
          crossOrigin={crossOrigin}
          referrerPolicy={referrerPolicy}
          onLoad={onLoad}
          onError={onError}
          loadingSlot={loadingSlot}
          errorSlot={errorSlot}
          imgClassName={imgClassName}
        />
      )}
    </div>
  );
}

export default Image;

// ─── Usage examples ───────────────────────────────────────────────────────────
//
// Basic:
//   <Image src={user.avatar} alt={user.name} />
//
// Product card (4:3, fallback, error callback):
//   <Image
//     src={product.thumbnail}
//     fallbackSrc="/images/product-placeholder.webp"
//     alt={product.name}
//     aspectRatio="4/3"
//     onError={() => analytics.track("image_failed", { src: product.thumbnail })}
//   />
//
// Hero / LCP (priority, 16:9):
//   <Image src={hero.url} alt={hero.title} aspectRatio="16/9" priority />
//
// With retry + backoff:
//   <Image
//     src={item.imageUrl}
//     fallbackSrc="/images/fallback.webp"
//     alt={item.title}
//     retries={2}
//     retryDelay={800}
//   />
//
// Blur placeholder (dominant color + tiny thumbnail):
//   <Image
//     src={photo.url}
//     alt={photo.caption}
//     blurPlaceholder
//     blurDataURL={photo.blurDataURL}
//     placeholderColor={photo.dominantColor}
//   />
//
// Custom empty / loading / error slots:
//   <Image
//     src={src}
//     alt="avatar"
//     loadingSlot={<MyAvatarSkeleton />}
//     emptySlot={<MyBrandedEmptyState />}
//     errorSlot={<MyFallbackAvatar name={user.name} />}
//   />
//
// Logos (contain, no crop):
//   <Image
//     src={brand.logo}
//     alt={brand.name}
//     objectFit="contain"
//     aspectRatio="4/3"
//   />
//
// Canvas / WebGL CORS:
//   <Image src={texture.url} alt="" crossOrigin="anonymous" />
