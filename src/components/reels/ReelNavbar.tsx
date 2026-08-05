import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Compass, Home, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/reels/explore", label: "Explore", icon: Compass },
  { to: "/reels/upload", label: "Upload", icon: Upload },
  { to: "/reels/stats", label: "Stats", icon: BarChart3 },
] as const;

export function ReelNavbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Reels navigation"
      className="sticky top-0 z-30 flex items-center gap-1 overflow-x-auto border-b border-border bg-background/95 px-3 py-2 backdrop-blur"
    >
      {items.map(({ to, label, icon: Icon }) => {
        const active = pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              active && to !== "/home"
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
