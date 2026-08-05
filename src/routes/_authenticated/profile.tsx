import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Coins, CreditCard, LogOut, Loader2, User, Shield } from "lucide-react";
import { Link } from "@tanstack/react-router";

const meQuery = queryOptions({
  queryKey: ["me-profile"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Not signed in");
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, bio, coins_balance")
      .eq("id", userData.user.id)
      .maybeSingle();
    return {
      user: userData.user,
      profile:
        profile ??
        { id: userData.user.id, display_name: null, avatar_url: null, bio: null, coins_balance: 0 },
    };
  },
});

export const Route = createFileRoute("/_authenticated/profile")({
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <div>
      <PageHeader title="Your profile" />
      <Suspense fallback={<div className="px-5"><Skeleton className="h-40 w-full" /></div>}>
        <ProfileForm />
      </Suspense>
    </div>
  );
}

function ProfileForm() {
  const { data } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(data.profile.display_name ?? "");
  const [bio, setBio] = useState(data.profile.bio ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(data.profile.display_name ?? "");
    setBio(data.profile.bio ?? "");
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName || null, bio: bio || null, updated_at: new Date().toISOString() })
        .eq("id", data.user.id);
      if (error) throw error;
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["me-profile"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }

  return (
    <div className="px-5">
      <Card className="mb-6 flex items-center gap-4 p-4">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
          {data.profile.avatar_url ? (
            <img src={data.profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <User className="h-6 w-6" />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold">{data.profile.display_name ?? "Friend"}</div>
          <div className="truncate text-xs text-muted-foreground">{data.user.email}</div>
        </div>
      </Card>

      <Card className="mb-6 border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Coins className="h-3.5 w-3.5" /> Wallet
            </div>
            <h2 className="mt-3 text-lg font-semibold">Coin wallet</h2>
          </div>
          <div className="rounded-2xl bg-card px-4 py-3 text-right shadow-sm">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Balance</div>
            <div className="mt-1 text-3xl font-semibold text-foreground">
              {new Intl.NumberFormat().format(data.profile.coins_balance)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">coins</div>
          </div>
        </div>
        <Button type="button" className="mt-4 h-11 w-full gap-2" variant="outline" disabled title="Coming soon">
          <CreditCard className="h-4 w-4" /> Buy coins
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Coin purchases are not live yet, but this spot will be ready when they are.
        </p>
      </Card>

      <form onSubmit={save} className="space-y-4">
        <div>
          <Label htmlFor="dn">Display name</Label>
          <Input
            id="dn"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 h-12"
          />
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-1 min-h-24"
            placeholder="Say a little about yourself."
          />
        </div>
        <Button type="submit" className="h-12 w-full" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </form>

      <Button asChild variant="outline" className="mt-8 h-12 w-full gap-2">
        <Link to="/admin"><Shield className="h-4 w-4" /> Moderation (admins)</Link>
      </Button>

      <Button variant="outline" onClick={signOut} className="mt-3 h-12 w-full gap-2 text-destructive">
        <LogOut className="h-4 w-4" /> Sign out
      </Button>

      <p className="mt-10 scripture text-center text-sm text-muted-foreground">
        "Freely you have received; freely give." — Matthew 10:8
      </p>
    </div>
  );
}
