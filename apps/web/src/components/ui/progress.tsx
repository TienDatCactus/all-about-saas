"use client";

import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Field, FieldDescription, FieldLabel } from "./field";

const progressVariants = cva("relative w-full overflow-hidden rounded-full bg-muted", {
  variants: {
    size: {
      sm: "h-2",
      md: "h-3",
      lg: "h-4",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const indicatorVariants = cva("h-full transition-all duration-300 ease-out", {
  variants: {
    variant: {
      default: "bg-primary",
      success: "bg-success",
      warning: "bg-warning",
      danger: "bg-destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface ProgressProps
  extends
    Omit<React.ComponentProps<typeof ProgressPrimitive.Root>, "value">,
    VariantProps<typeof progressVariants>,
    VariantProps<typeof indicatorVariants> {
  value?: number;

  max?: number;

  label?: React.ReactNode;

  caption?: React.ReactNode;

  showValue?: boolean;

  appearance?: "solid" | "dashed" | "steps";

  segments?: number;

  indeterminate?: boolean;

  valueFormatter?: (value: number, max: number) => React.ReactNode;
}

const Bar = ({
  indeterminate,
  normalizedValue,
  max,
  percentage,
  appearance,
  segments = 5,
  variant,
  size,
  className,
  ...props
}: Pick<ProgressProps, "appearance" | "segments" | "variant" | "size" | "className"> & {
  normalizedValue: number;
  max: number;
  percentage: number;
  indeterminate: boolean;
}) => {
  if (appearance === "dashed") {
    const activeSegments = Math.round((percentage / 100) * segments);

    return (
      <div className={cn(progressVariants({ size }), "flex gap-1 bg-transparent", className)}>
        {Array.from({
          length: segments,
        }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "h-full flex-1 rounded-sm bg-muted",
              index < activeSegments &&
                indicatorVariants({
                  variant,
                }),
            )}
          />
        ))}
      </div>
    );
  }

  if (appearance === "steps") {
    const activeSteps = Math.floor((percentage / 100) * segments);

    return (
      <div className={cn("flex items-center gap-2", className)}>
        {Array.from({
          length: segments,
        }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "size-3 rounded-full bg-muted",
              index < activeSteps &&
                indicatorVariants({
                  variant,
                }),
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={normalizedValue}
      max={max}
      className={cn(progressVariants({ size }), className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "size-full flex-1",
          indicatorVariants({
            variant,
          }),
          indeterminate && "animate-pulse w-1/3",
        )}
        style={
          indeterminate
            ? undefined
            : {
                transform: `translateX(-${100 - percentage}%)`,
              }
        }
      />
    </ProgressPrimitive.Root>
  );
};

export function Progress({
  className,

  value = 0,
  max = 100,

  label,
  caption,
  showValue,

  variant,
  size,

  appearance = "solid",
  segments = 5,

  indeterminate = false,

  valueFormatter,

  ...props
}: ProgressProps) {
  const normalizedValue = Math.max(0, Math.min(value, max));

  const percentage = max > 0 ? (normalizedValue / max) * 100 : 0;

  const displayValue = valueFormatter
    ? valueFormatter(normalizedValue, max)
    : `${Math.round(percentage)}%`;

  return (
    <Field className="w-full max-w-sm">
      {(label || showValue) && (
        <FieldLabel htmlFor="progress-upload">
          {label && <span className="text-sm font-medium">{label}</span>}

          {showValue && !indeterminate && (
            <span className="text-muted-foreground text-sm ml-auto">{displayValue}</span>
          )}
        </FieldLabel>
      )}

      <Bar
        indeterminate={indeterminate}
        normalizedValue={normalizedValue}
        max={max}
        percentage={percentage}
        appearance={appearance}
        segments={segments}
        variant={variant}
        size={size}
        className={className}
        {...props}
      />

      {caption && (
        <FieldDescription className="text-muted-foreground text-sm text-end">
          {caption}
        </FieldDescription>
      )}
    </Field>
  );
}
