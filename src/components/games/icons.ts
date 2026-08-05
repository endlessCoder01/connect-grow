import {
  Brain,
  Scale,
  UserSearch,
  BookOpen,
  Timer,
  Grid2x2,
  Library,
  Quote,
  Flag,
  Map,
  Puzzle,
  Crown,
  CalendarCheck,
  Trophy,
  Swords,
  Gamepad2,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  brain: Brain,
  scale: Scale,
  "user-search": UserSearch,
  "book-open": BookOpen,
  timer: Timer,
  "grid-2x2": Grid2x2,
  library: Library,
  quote: Quote,
  flag: Flag,
  map: Map,
  puzzle: Puzzle,
  crown: Crown,
  "calendar-check": CalendarCheck,
  trophy: Trophy,
  swords: Swords,
};

export function gameIcon(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || Gamepad2;
}
