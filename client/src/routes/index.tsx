import { createFileRoute, redirect } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { storage } from "@/lib/utils/local-storage";
import { useLogoutMutation } from "@/services/auth";
import { AppConstants } from "@/lib/utils/constants";

export const Route = createFileRoute("/")({
  validateSearch: (search) => ({
    accessToken:
      typeof search.accessToken === "string" ? search.accessToken : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (!search.accessToken) {
      return;
    }

    storage.set(AppConstants.tokenKey, search.accessToken);

    throw redirect({
      to: "/",
      search: {
        accessToken: undefined,
      },
    });
  },
  component: App,
});

function App() {
  const { mutate: logout } = useLogoutMutation();
  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Project ready!</h1>
          <p>You may now add components and start building.</p>
          <p>We&apos;ve already added the button component for you.</p>
          <Button onClick={() => logout()} className="mt-2">
            Button
          </Button>
        </div>
      </div>
    </div>
  );
}
