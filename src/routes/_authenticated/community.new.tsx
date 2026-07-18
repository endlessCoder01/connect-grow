import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/community/new")({
  component: NewChurchPage,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

function NewChurchPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const baseSlug = slugify(name) || `church-${Date.now().toString(36)}`;
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await supabase
        .from("churches")
        .insert({
          name,
          description: description || null,
          city: city || null,
          country: country || null,
          slug,
          created_by: userData.user.id,
        })
        .select("slug")
        .single();
      if (error) throw error;
      // Auto-join as admin
      await supabase.from("church_members").insert({
        church_id: (await supabase.from("churches").select("id").eq("slug", data.slug).single()).data?.id!,
        user_id: userData.user.id,
        role: "admin",
      });
      toast.success("Community created");
      navigate({ to: "/community/$slug", params: { slug: data.slug } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create community");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="px-5 pt-6">
        <Link to="/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
      </div>
      <PageHeader title="New community" subtitle="Start a church space." />
      <form onSubmit={submit} className="space-y-4 px-5">
        <div>
          <Label htmlFor="name">Church name</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-12" />
        </div>
        <div>
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-24" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 h-12" />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 h-12" />
          </div>
        </div>
        <Button type="submit" className="h-12 w-full" disabled={loading || !name.trim()}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create community
        </Button>
      </form>
    </div>
  );
}
