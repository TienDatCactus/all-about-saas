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
import { Separator } from "@/components/ui/separator";
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
        "absolute inset-x-0 bottom-0 h-1 origin-left transition-transform duration-100 ease-linear rounded-2xl",
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

  const copyToClipboard = () => {
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

    if (!navigator.clipboard) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy text", err);
      }
      document.body.removeChild(textArea);
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const hasExpandableContent = !!(error || details);

  const toggleTimer = () => {
    setIsPaused(!isPaused);
  };
  return (
    <Item
      variant="outline"
      className="relative overflow-hidden bg-card p-0 gap-0 "
      role="alert"
      aria-live={status === "error" || status === "warning" ? "assertive" : "polite"}
      aria-atomic="true"
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

        <CollapsibleContent className="space-y-3 px-4 pb-4 pt-0 text-xs">
          {details && <p className="text-muted-foreground">{details}</p>}

          {error && (
            <>
              {error.validation && (
                <div className="space-y-1.5">
                  <p className="font-medium text-foreground">Validation</p>

                  {Object.entries(error.validation).map(([field, messages]) => (
                    <dl key={field} className="grid grid-cols-[72px_1fr] gap-x-2">
                      <dt className="truncate text-muted-foreground capitalize">{field}</dt>

                      <dd className="space-y-0.5">
                        {messages.map((message, index) => (
                          <p key={index}>{message}</p>
                        ))}
                      </dd>
                    </dl>
                  ))}
                </div>
              )}

              {(error.status || error.code || error.path || error.traceId) && (
                <>
                  <Separator />

                  <dl className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-1">
                    {error.status && (
                      <>
                        <dt className="text-muted-foreground">Status</dt>
                        <dd>{error.status}</dd>
                      </>
                    )}

                    {error.code && (
                      <>
                        <dt className="text-muted-foreground">Code</dt>
                        <dd className="font-mono">{error.code}</dd>
                      </>
                    )}

                    {error.path && (
                      <>
                        <dt className="text-muted-foreground">Path</dt>
                        <dd className="truncate font-mono">{error.path}</dd>
                      </>
                    )}

                    {error.traceId && (
                      <>
                        <dt className="text-muted-foreground">Trace</dt>
                        <dd className="truncate font-mono">{error.traceId}</dd>
                      </>
                    )}
                  </dl>
                </>
              )}

              {error.details && (
                <>
                  <Separator />

                  <p className="max-h-24 overflow-auto rounded border bg-muted/40 p-2 font-mono text-[10px] whitespace-pre-wrap">
                    {error.details}
                  </p>
                </>
              )}

              <div className="flex justify-end">
                <Button variant="outline" className="w-full" size="sm" onClick={copyToClipboard}>
                  {copied ? "Copied" : "Copy details"}
                </Button>
              </div>
            </>
          )}
        </CollapsibleContent>
        <ItemFooter className="bg-secondary p-2 border-t">
          <p className="text-xs text-muted-foreground">
            This message will close in <strong>{Math.ceil(remainingMs / 1000)}</strong> seconds.{" "}
            <a onClick={toggleTimer} className="link text-foreground">
              Click to {isPaused ? "resume" : "pause"}.
            </a>
          </p>
        </ItemFooter>
      </Collapsible>
    </Item>
  );
}
