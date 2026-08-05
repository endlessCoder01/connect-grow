import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { gameIcon } from "./icons";
import { Lock, Play, Sparkles } from "lucide-react";

export type GameSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  difficulty_label: string;
  xp_reward_label: string;
  is_coming_soon: boolean;
};

export function GameCard({ game, bestScore }: { game: GameSummary; bestScore?: number }) {
  const Icon = gameIcon(game.icon);
  return (
    <Card className="flex flex-col gap-3 p-4 transition hover:border-primary/40">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight">{game.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{game.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary">{game.difficulty_label}</Badge>
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Sparkles className="h-3 w-3" /> {game.xp_reward_label}
        </Badge>
        <span className="text-muted-foreground">
          Best: {bestScore != null ? bestScore.toLocaleString() : "—"}
        </span>
      </div>
      <Button asChild className="h-11 w-full gap-2">
        <Link to="/games/play/$slug" params={{ slug: game.slug }}>
          <Play className="h-4 w-4" /> Play
        </Link>
      </Button>
    </Card>
  );
}

export function ComingSoonGameCard({ game }: { game: GameSummary }) {
  const Icon = gameIcon(game.icon);
  return (
    <Card className="flex flex-col gap-3 border-dashed bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-tight">{game.name}</h3>
            <Badge className="bg-gold text-gold-foreground hover:bg-gold">Coming soon</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{game.description}</p>
        </div>
      </div>
      <Button disabled variant="outline" className="h-11 w-full gap-2">
        <Lock className="h-4 w-4" /> In development
      </Button>
    </Card>
  );
}
