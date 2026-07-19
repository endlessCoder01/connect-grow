import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronLeft, Check, X, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const adminQuery = queryOptions({
  queryKey: ["admin-pending"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { isAdmin: false, pending: [] as Array<{ id: string; title: string; body: string; created_at: string; author: string }> };
    const { data: isAdminData } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdminData) return { isAdmin: false, pending: [] };
    const { data: pending, error } = await supabase
      .from("testimonies")
      .select("id, title, body, created_at, user_id")
      .eq("approved", false)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const ids = Array.from(new Set((pending ?? []).map((t) => t.user_id)));
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] as { id: string; display_name: string | null }[] };
    const map = Object.fromEntries((profs ?? []).map((p) => [p.id, p.display_name]));
    return {
      isAdmin: true,
      pending: (pending ?? []).map((t) => ({ ...t, author: map[t.user_id] ?? "A friend" })),
    };
  },
});

export const Route = createFileRoute("/_authenticated/admin")({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminQuery),
  component: AdminPage,
});

function AdminPage() {
  return (
    <div>
      <div className="px-5 pt-6">
        <Link to="/profile" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Profile
        </Link>
      </div>
      <PageHeader title="Moderation" subtitle="Approve testimonies before they go public." />
      <div className="px-5">
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <PendingList />
        </Suspense>
      </div>
    </div>
  );
}

function PendingList() {
  const { data } = useSuspenseQuery(adminQuery);
  const qc = useQueryClient();

  if (!data.isAdmin) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="font-semibold">Admins only</h3>
        <p className="mt-1 text-sm text-muted-foreground">You don't have permission to view this page.</p>
      </Card>
    );
  }

  async function decide(id: string, approve: boolean) {
    try {
      if (approve) {
        const { error } = await supabase.from("testimonies").update({ approved: true }).eq("id", id);
        if (error) throw error;
        toast.success("Approved");
      } else {
        const { error } = await supabase.from("testimonies").delete().eq("id", id);
        if (error) throw error;
        toast.success("Removed");
      }
      qc.invalidateQueries({ queryKey: ["admin-pending"] });
      qc.invalidateQueries({ queryKey: ["testimonies"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  }

  if (data.pending.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h3 className="font-semibold">All caught up</h3>
        <p className="mt-1 text-sm text-muted-foreground">No testimonies pending review.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.pending.map((t) => (
        <Card key={t.id} className="p-5">
          <div className="text-xs text-muted-foreground">
            {t.author} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
          </div>
          <div className="mt-1 font-semibold">{t.title}</div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button onClick={() => decide(t.id, true)} className="h-11 gap-1">
              <Check className="h-4 w-4" /> Approve
            </Button>
            <Button variant="outline" onClick={() => decide(t.id, false)} className="h-11 gap-1 text-destructive">
              <X className="h-4 w-4" /> Remove
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
