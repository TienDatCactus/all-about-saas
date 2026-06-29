import Logo from "@/components/custom/logo";
import { Separator } from "@/components/ui/separator";
import { Link } from "@tanstack/react-router";

interface AuthLayoutProps {
  title: {
    text: string;
    link?: string;
    anchor?: string;
  };
  form: React.ReactNode;
  action?: {
    text?: string;
    component: React.ReactNode;
  };
  legend?: {
    text?: string;
    link?: string;
    anchor?: string;
  };
}
export default function AuthLayout({ title, form, legend, action }: AuthLayoutProps) {
  return (
    <div className="flex flex-1 flex-col justify-center px-4 py-10 lg:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <div>
          <Logo alt="Logo" className="w-52 mx-auto" />
        </div>
        <h2 className="text-center text-xl font-semibold text-balance text-foreground">
          {title.text}{" "}
          {title.link && (
            <Link to={title.link} className="link">
              {title.anchor}
            </Link>
          )}
        </h2>{" "}
        <p className="mt-4 text-xs text-pretty text-center text-muted-foreground dark:text-muted-foreground">
          By continuing to use our services, you agree to our{" "}
          <a href="#" className="underline underline-offset-4">
            terms of service
          </a>{" "}
          and{" "}
          <a href="#" className="underline underline-offset-4">
            privacy policy
          </a>
          .
        </p>
        {form}
        {action && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">{action?.text}</span>
              </div>
            </div>
            {action?.component}
          </>
        )}
        {legend && (
          <p className="mt-4 text-sm text-pretty text-center text-muted-foreground dark:text-muted-foreground">
            {legend?.text}{" "}
            {legend?.link && (
              <Link to={legend?.link} className="link text-primary">
                {legend?.anchor}
              </Link>
            )}
            .
          </p>
        )}
      </div>
    </div>
  );
}
