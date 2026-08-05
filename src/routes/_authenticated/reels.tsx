import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ReelNavbar } from "@/components/reels/ReelNavbar";

export const Route = createFileRoute("/_authenticated/reels")({
  component: () => (
    <div>
      <ReelNavbar />
      <Outlet />
    </div>
  ),
  errorComponent: () => (
    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
      Something went wrong loading Reels.
    </div>
  ),
});
