import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LoginForm from "./components/Form";
import { Separator } from "@/components/ui/separator";
import Providers from "./components/Providers";

/**
 * The non-redirect auth gate's modal (routes/_authenticated.tsx): rendered
 * INSTEAD of the protected page, so the visitor keeps the URL they asked for.
 *
 * Deliberately not dismissible — behind it there is nothing to go back to
 * (the Outlet was never rendered), so closing it would just strand the user
 * on a blank page. No close button, and outside-click/Escape are swallowed.
 */
export function LoginDialog() {
  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-sm"
        showCloseButton={false}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Sign in to continue</DialogTitle>
          <DialogDescription>
            This page needs an account. After signing in you&apos;ll stay right
            here.
          </DialogDescription>
        </DialogHeader>
        <LoginForm redirectTo={null} />
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              or with
            </span>
          </div>
        </div>
        <Providers />
      </DialogContent>
    </Dialog>
  );
}
