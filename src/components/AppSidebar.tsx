import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Calendar, Menu, MessageSquare, User, Users, Video } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { to: "/profile", label: "Me", icon: User },
  { to: "/community", label: "Church", icon: Users },
  { to: "/meetings", label: "Meetings", icon: Video },
  { to: "/chat", label: "Messages", icon: MessageSquare },
  { to: "/calendar", label: "Calendar", icon: Calendar },
] as const;

function SidebarLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="space-y-1">
      {links.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || pathname.startsWith(to + "/");
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-primary"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Slide-out drawer trigger — used on mobile and tablet. */
export function SidebarTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="px-5 pt-6 text-left">
          <SheetTitle>Bible Connect</SheetTitle>
        </SheetHeader>
        <div className="px-3 py-4">
          <SidebarLinks onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Permanent rail — desktop only. */
export function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border bg-background/60 px-3 py-6 lg:block">
      <div className="px-3 pb-4 text-lg tracking-tight">Bible Connect</div>
      <SidebarLinks />
    </aside>
  );
}
