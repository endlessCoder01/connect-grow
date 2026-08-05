import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { AppSidebar, SidebarTrigger } from "@/components/AppSidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "signin" } });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <AppSidebar />
      <div className="lg:pl-60">
        <div className="container-mobile">
          <div className="flex items-center justify-between px-2 pt-3">
            <div className="lg:hidden">
              <SidebarTrigger />
            </div>
            <Link
              to="/reels"
              aria-label="Reels"
              title="Reels"
              className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <Film className="h-5 w-5" />
            </Link>
          </div>
          <Outlet />
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
