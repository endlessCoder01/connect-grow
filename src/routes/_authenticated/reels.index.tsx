import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/reels/")({
  beforeLoad: () => {
    throw redirect({ to: "/reels/explore" });
  },
});
