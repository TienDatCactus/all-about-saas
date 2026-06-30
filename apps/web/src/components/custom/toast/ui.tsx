import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemMedia,
  ItemTitle,
  itemVariants,
} from "@/components/ui/item";
import { cn } from "@/lib/utils";
import {
  ArrowClockwiseIcon,
  CaretDownIcon,
  CheckCircleIcon,
  InfoIcon,
  SpinnerIcon,
  WarningIcon,
  XCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import React, { useEffect, useState } from "react";
import { toast as sonnerToast } from "sonner";
import { type ToastError } from "./normalize";
import { Separator } from "@/components/ui/separator";

export type ToastStatus = "success" | "error" | "warning" | "info" | "loading" | "offline";

export interface ToastOptions {
  id?: string;
  status: ToastStatus;
  title?: React.ReactNode;
  description?: React.ReactNode;
  details?: React.ReactNode;
  action?: {
    label: string;
    onClick(): void;
  };
  dismissible?: boolean;
  duration?: number;
  persistent?: boolean;
  retry?: () => void;
  error?: ToastError;
  source?: string;
}

export interface ToastProps {
  id: string | number;
  options: ToastOptions;
}

const ICONS = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: WarningIcon,
  info: InfoIcon,
  loading: SpinnerIcon,
  offline: InfoIcon,
};

function ToastIcon({ status }: { status: ToastStatus }) {
  const IconComponent = ICONS[status] || InfoIcon;
  return (
    <IconComponent
      className={cn("size-5", {
        "text-success": status === "success",
        "text-destructive": status === "error",
        "text-warning": status === "warning",
        "text-primary": status === "info" || status === "offline",
        "text-muted-foreground animate-spin": status === "loading",
      })}
    />
  );
}

function ToastProgress({ status, percentage }: { status: ToastStatus; percentage: number }) {
  if (status === "loading") return null;
  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 h-0.75 origin-left rounded-xl transition-all duration-100 ease-linear",
        {
          "bg-success": status === "success",
          "bg-destructive": status === "error",
          "bg-warning": status === "warning",
          "bg-primary": status === "info" || status === "offline",
        },
      )}
      style={{
        transform: `scaleX(${percentage / 100})`,
      }}
    />
  );
}

export default function Toast(props: ToastProps) {
  const { id, options } = props;
  const {
    status,
    title,
    description,
    details,
    action,
    dismissible = true,
    persistent = false,
    duration = 10000,
    retry,
    error,
  } = options;

  const [remainingMs, setRemainingMs] = useState<number>(duration);
  const [isPaused, setIsPaused] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isPaused || persistent || status === "loading") return;

    const interval = setInterval(() => {
      setRemainingMs((prev) => {
        if (prev <= 100) {
          clearInterval(interval);
          sonnerToast.dismiss(id);
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [id, isPaused, persistent, status]);

  const percentage = (remainingMs / duration) * 100;

  const copyToClipboard = async () => {
    if (!error) return;
    const text = [
      error.title ? `Title: ${error.title}` : "",
      error.message ? `Message: ${error.message}` : "",
      error.status ? `Status: ${error.status}` : "",
      error.code ? `Code: ${error.code}` : "",
      error.path ? `Path: ${error.path}` : "",
      error.traceId ? `Trace ID: ${error.traceId}` : "",
      error.validation ? `Validation: ${JSON.stringify(error.validation, null, 2)}` : "",
      error.details ? `Details: ${error.details}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const hasExpandableContent = !!(error || details);

  return (
    <Item
      variant="outline"
      className="relative overflow-hidden bg-card p-0 gap-0 "
      role="alert"
      aria-live={status === "error" || status === "warning" ? "assertive" : "polite"}
      aria-atomic="true"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <Collapsible className="w-full">
        <div className={cn(itemVariants({}), "p-4")}>
          <ToastProgress status={status} percentage={percentage} />

          <ItemMedia variant="icon">
            <ToastIcon status={status} />
          </ItemMedia>

          <ItemContent>
            <ItemTitle>{title}</ItemTitle>
            {description && <ItemDescription>{description}</ItemDescription>}
          </ItemContent>

          <ItemActions>
            {(action || retry) && (
              <>
                {retry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      retry();
                      sonnerToast.dismiss(id);
                    }}
                  >
                    <ArrowClockwiseIcon />
                    Retry
                  </Button>
                )}
                {action && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      action.onClick();
                      sonnerToast.dismiss(id);
                    }}
                  >
                    {action.label}
                  </Button>
                )}
              </>
            )}
            {hasExpandableContent && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <CaretDownIcon />
                </Button>
              </CollapsibleTrigger>
            )}
            {dismissible && (
              <Button variant="ghost" size="icon-sm" onClick={() => sonnerToast.dismiss(id)}>
                <XIcon />
              </Button>
            )}
          </ItemActions>
        </div>

        <CollapsibleContent className="p-4 pt-0">
          <div>
            {details && <text className="text-muted-foreground">{details}</text>}

            {error && (
              <div className="space-y-3">
                {error.validation && (
                  <div className="space-y-1.5 mt-1">
                    <span className="font-semibold text-foreground text-xs block text-left">
                      Validation Issues:
                    </span>
                    {Object.entries(error.validation).map(([field, messages]) => (
                      <div
                        key={field}
                        className="text-left text-xs bg-muted/40 p-1.5 rounded border border-muted/50"
                      >
                        <span className="font-semibold text-foreground capitalize block text-left">
                          {field}
                        </span>
                        <ul className="list-disc list-inside pl-2 text-muted-foreground mt-0.5 text-left">
                          {messages.map((msg, i) => (
                            <li key={i}>{msg}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
                <Separator />
                <pre className="pt-2 text-[10px] text-muted-foreground space-y-1 font-mono text-left *:block">
                  {error.status && (
                    <code>
                      <strong>Status:</strong> {error.status}
                    </code>
                  )}
                  {error.code && (
                    <code>
                      <strong>Code:</strong> {error.code}
                    </code>
                  )}
                  {error.path && (
                    <code className="truncate">
                      <strong>Path:</strong> {error.path}
                    </code>
                  )}
                  {error.traceId && (
                    <code>
                      <strong>Trace ID:</strong> {error.traceId}
                    </code>
                  )}
                  {error.details && (
                    <code className="block overflow-x-auto max-h-24 bg-muted/60 border p-1.5 rounded mt-1.5 whitespace-pre scrollbar-thin text-[9px]">
                      {error.details}
                    </code>
                  )}
                </pre>

                <Button variant="outline" size="sm" className="w-full " onClick={copyToClipboard}>
                  {copied ? "Copied!" : "Copy Details"}
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
        <ItemFooter className="bg-secondary p-2 border-t">
          <p className="text-xs text-muted-foreground">
            This message will close in <strong>{Math.ceil(remainingMs / 1000)}</strong> seconds.{" "}
            <a href="#" className="link text-foreground">
              Click to stop.
            </a>
          </p>
        </ItemFooter>
      </Collapsible>
    </Item>
  );
}
