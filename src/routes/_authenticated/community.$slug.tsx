import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronLeft, MapPin, Users, UserCheck, UserPlus } from "lucide-react";

function churchQuery(slug: string) {
  return queryOptions({
    queryKey: ["church", slug],
    queryFn: async () => {
      const { data: church, error } = await supabase
        .from("churches")
        .select("id, slug, name, description, logo_url, city, country, created_by")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!church) throw notFound();

      const [{ data: members }, { data: userData }] = await Promise.all([
        supabase.from("church_members").select("user_id, role").eq("church_id", church.id),
        supabase.auth.getUser(),
      ]);
      const me = userData.user?.id;
      const myMembership = me ? members?.find((m) => m.user_id === me) : undefined;
      return {
        church,
        memberCount: members?.length ?? 0,
        isMember: !!myMembership,
        myRole: myMembership?.role,
      };
    },
  });
}

export const Route = createFileRoute("/_authenticated/community/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(churchQuery(params.slug)),
  component: CommunityDetail,
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <h1 className="text-2xl">Community not found</h1>
      <Button asChild className="mt-4"><Link to="/community">Back to list</Link></Button>
    </div>
  ),
});

function CommunityDetail() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(churchQuery(slug));
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function toggleMembership() {
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sign in required");
      if (data.isMember) {
        await supabase
          .from("church_members")
          .delete()
          .eq("church_id", data.church.id)
          .eq("user_id", userData.user.id);
        toast.success("Left community");
      } else {
        await supabase.from("church_members").insert({
          church_id: data.church.id,
          user_id: userData.user.id,
          role: "member",
        });
        toast.success("Welcome!");
      }
      qc.invalidateQueries({ queryKey: ["church", slug] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="px-5 pt-6">
        <Link to="/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Communities
        </Link>
      </div>

      <div className="px-5 pt-6">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
            {data.church.logo_url ? (
              <img src={data.church.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Users className="h-7 w-7" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl">{data.church.name}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{data.memberCount} members</span>
              {(data.church.city || data.church.country) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[data.church.city, data.church.country].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>
        {data.church.description && (
          <p className="text-sm text-muted-foreground">{data.church.description}</p>
        )}
        <Button onClick={toggleMembership} disabled={busy} className="mt-4 h-11 w-full gap-2">
          {data.isMember ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {data.isMember ? "You've joined" : "Join community"}
        </Button>
      </div>

      <div className="mt-8 px-5">
        <h2 className="mb-3 text-lg font-semibold">Community feed</h2>
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <ChurchFeed churchId={data.church.id} />
        </Suspense>
      </div>
    </div>
  );
}

function feedQuery(churchId: string) {
  return queryOptions({
    queryKey: ["church-feed", churchId],
    queryFn: async () => {
      const [{ data: testimonies }, { data: prayers }] = await Promise.all([
        supabase
          .from("testimonies")
          .select("id, title, body, created_at")
          .eq("church_id", churchId)
          .eq("approved", true)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("prayer_requests")
          .select("id, title, prayer_count, created_at")
          .eq("church_id", churchId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      return { testimonies: testimonies ?? [], prayers: prayers ?? [] };
    },
  });
}

function ChurchFeed({ churchId }: { churchId: string }) {
  const { data } = useSuspenseQuery(feedQuery(churchId));
  if (data.testimonies.length === 0 && data.prayers.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        No posts yet — be the first to share.
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {data.testimonies.map((t) => (
        <Card key={t.id} className="p-4">
          <div className="text-xs uppercase tracking-wider text-gold">Testimony</div>
          <div className="mt-1 font-semibold">{t.title}</div>
          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{t.body}</p>
        </Card>
      ))}
      {data.prayers.map((p) => (
        <Card key={p.id} className="p-4">
          <div className="text-xs uppercase tracking-wider text-primary">Prayer</div>
          <div className="mt-1 font-semibold">{p.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{p.prayer_count} praying</div>
        </Card>
      ))}
    </div>
  );
}
