//Chat screen
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";import {
  queryOptions,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  ChevronLeft,
  Search,
  MessagesSquare,
  X,
  Paperclip,
  Loader2,
} from "lucide-react";

import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { pinChat, readPinnedChats } from "@/lib/chat-conversations";

type ProfileSearchResult = {
  id: string;
  display_name: string | null;
  avatar_url?: string | null;
};

const conversationsQuery = queryOptions({
  queryKey: ["conversations"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id;
    if (!me) return { conversations: [], me: null as string | null };
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, read_at, created_at")
      .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const map = new Map<string, { other: string; last: typeof msgs[number]; unread: number }>();
    for (const m of msgs ?? []) {
      const other = m.sender_id === me ? m.recipient_id : m.sender_id;
      const existing = map.get(other);
      const unreadBump = m.recipient_id === me && !m.read_at ? 1 : 0;
      if (!existing) {
        map.set(other, { other, last: m, unread: unreadBump });
      } else {
        existing.unread += unreadBump;
      }
    }
    const ids = Array.from(map.keys());
    let profs: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
    if (ids.length) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);
      profs = Object.fromEntries((p ?? []).map((x) => [x.id, { display_name: x.display_name, avatar_url: x.avatar_url }]));
    }
    const pinnedConversations = readPinnedChats(me)
      .filter((item) => !map.has(item.userId))
      .map((item) => ({
        other: item.userId,
        unread: 0,
        last: {
          id: `pinned-${item.userId}`,
          sender_id: me,
          recipient_id: item.userId,
          body: "",
          read_at: null,
          created_at: item.startedAt,
        },
        profile: {
          display_name: item.display_name,
          avatar_url: item.avatar_url,
        },
      }));
    return {
      me,
      conversations: [
        ...Array.from(map.values()).map((c) => ({ ...c, profile: profs[c.other] })),
        ...pinnedConversations,
      ].sort((a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime()),
    };
  },
});

export const Route = createFileRoute("/_authenticated/chat/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(conversationsQuery),
  component: ChatIndex,
});

function ChatIndex() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const { data } = useSuspenseQuery(conversationsQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeQuery, setComposeQuery] = useState("");
  const [composeResults, setComposeResults] = useState<ProfileSearchResult[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<ProfileSearchResult | null>(null);
  const [composeBody, setComposeBody] = useState("");
  const [composeAttachment, setComposeAttachment] = useState<{
  name: string;
  url: string;
} | null>(null);
  const [sendingCompose, setSendingCompose] = useState(false);
  const composeFileInput = useRef<HTMLInputElement>(null);

  const hasSearchResults = useMemo(() => results.length > 0, [results.length]);

  useEffect(() => {
    if (!data.me) return;
    const channel = supabase
      .channel(`inbox-${data.me}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          const message = (payload.new ?? payload.old) as
            | { sender_id: string; recipient_id: string }
            | undefined;
          if (!message) return;
          if (message.sender_id === data.me || message.recipient_id === data.me) {
            qc.invalidateQueries({ queryKey: ["conversations"] });
            qc.invalidateQueries({ queryKey: ["chat-thread"] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [data.me, qc]);

  async function search(term: string) {
    setQ(term);
    if (!term.trim()) return setResults([]);
    const { data: matches } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .ilike("display_name", `%${term}%`)
      .neq("id", data.me ?? "")
      .limit(10);
    setResults(matches ?? []);
  }

  async function searchComposeRecipients(term: string) {
    setComposeQuery(term);
    if (!term.trim()) return setComposeResults([]);
    const { data: matches } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .ilike("display_name", `%${term}%`)
      .neq("id", data.me ?? "")
      .limit(8);
    setComposeResults(matches ?? []);
  }

  async function fileToDataUrl(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Unable to read attachment"));
      reader.readAsDataURL(file);
    });
  }

async function sendComposeMessage() {
  if (
    !selectedRecipient ||
    (!composeBody.trim() && !composeAttachment) ||
    !data.me
  ) {
    return;
  }

  setSendingCompose(true);

  try {
    const { error } = await supabase.from("messages").insert({
      sender_id: data.me,
      recipient_id: selectedRecipient.id,
      body: composeBody.trim(),
    });

    if (error) throw error;

    setComposeOpen(false);
    setComposeQuery("");
    setComposeResults([]);
    setSelectedRecipient(null);
    setComposeBody("");
    setComposeAttachment(null);

    pinChat(data.me, selectedRecipient);

    qc.invalidateQueries({ queryKey: ["conversations"] });

    navigate({
      to: "/chat/$userId",
      params: { userId: selectedRecipient.id },
    });
  } catch (err) {
    toast.error(
      err instanceof Error ? err.message : "Could not send message"
    );
  } finally {
    setSendingCompose(false);
  }
}

  return (
    <div>
      <div className="px-5 pt-6">
        <Link to="/home" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>
      </div>
 <PageHeader
  title="Messages"
  subtitle="Private conversations."
  right={
    <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
      <DialogTrigger asChild>
        <Button type="button">New message</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            Pick someone, write your message, and send it right away.
          </DialogDescription>
        </DialogHeader>
              <div className="space-y-4">
                {!selectedRecipient ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search people by name…"
                        value={composeQuery}
                        onChange={(e) => searchComposeRecipients(e.target.value)}
                        className="h-11 pl-9"
                      />
                    </div>
                    <div className="max-h-52 space-y-2 overflow-y-auto">
                      {composeResults.map((person) => (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => {
  setSelectedRecipient(person);
  setComposeAttachment(null);
}}
                          className="flex w-full items-center gap-3 rounded-2xl border border-border px-3 py-2 text-left transition hover:bg-muted"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={person.avatar_url ?? undefined} alt="" />
                            <AvatarFallback>{getInitials(person.display_name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{person.display_name ?? "Friend"}</div>
                            <div className="text-xs text-muted-foreground">Tap to start a conversation</div>
                          </div>
                        </button>
                      ))}
                      {composeQuery.trim() && composeResults.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
                          No people found.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Card className="flex items-center gap-3 p-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={selectedRecipient.avatar_url ?? undefined} alt="" />
                        <AvatarFallback>{getInitials(selectedRecipient.display_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">To {selectedRecipient.display_name ?? "Friend"}</div>
                        <div className="text-xs text-muted-foreground">They’ll receive this immediately</div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedRecipient(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </Card>
                    <Textarea
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      placeholder="Write your message…"
                      className="min-h-28"
                    />
                    {composeAttachment && (
                      <Card className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{composeAttachment.name}</div>
                          <div className="text-xs text-muted-foreground">Attachment ready to send</div>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setComposeAttachment(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </Card>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <Button type="button" variant="outline" className="gap-2" onClick={() => composeFileInput.current?.click()}>
                        <Paperclip className="h-4 w-4" /> Attach file
                      </Button>
                      <input
                        ref={composeFileInput}
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await fileToDataUrl(file);
                          setComposeAttachment({ name: file.name, url });
                        }}
                      />
                      <Button
                        type="button"
                        className="gap-2"
                        onClick={sendComposeMessage}
                        disabled={sendingCompose || (!composeBody.trim() && !composeAttachment)}
                      >
                        {sendingCompose && <Loader2 className="h-4 w-4 animate-spin" />}
                        Send
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="px-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Find someone to message…"
            value={q}
            onChange={(e) => search(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        {hasSearchResults && (
          <Card className="mt-2 divide-y overflow-hidden">
            {results.map((r) => (
              <Link
                key={r.id}
                to="/chat/$userId"
                params={{ userId: r.id }}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted"
                onClick={() => pinChat(data.me, r)}
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={r.avatar_url ?? undefined} alt="" />
                  <AvatarFallback>{getInitials(r.display_name)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{r.display_name ?? "Friend"}</span>
              </Link>
            ))}
          </Card>
        )}
        <div className="mt-4">
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <List />
          </Suspense>
        </div>
      </div>
    </div>
  
);

  
}

function List() {
  const { data } = useSuspenseQuery(conversationsQuery);
  const navigate = useNavigate();

  if (data.conversations.length === 0) {
    return (
      <Card className="p-8 text-center">
        <MessagesSquare className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h3 className="font-semibold">No messages yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Search above to start a conversation or send a first hello.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.conversations.map((c) => {
        console.log("Rendering conversation:", {
          other: c.other,
          displayName: c.profile?.display_name,
          avatarUrl: c.profile?.avatar_url,
        });

        return (
          <Card
            key={c.other}
            className="cursor-pointer p-4 transition hover:border-primary/40"
            onClick={async() => {
              console.log("===== CHAT CARD CLICKED =====");
              console.log("Conversation:", c);
              console.log("Route:", "/chat/$userId");
              console.log("Params:", {
                userId: c.other,
              });

             try {
  console.log("BEFORE NAVIGATION");

  await navigate({
    to: "/chat/$userId",
    params: {
      userId: c.other,
    },
  });

  console.log("AFTER NAVIGATION");
} catch (error) {
  console.error("NAVIGATION ERROR:", error);
}
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Avatar className="mt-0.5 h-11 w-11">
                  <AvatarImage
                    src={c.profile?.avatar_url ?? undefined}
                    alt=""
                  />

                  <AvatarFallback>
                    {getInitials(c.profile?.display_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-semibold">
                      {c.profile?.display_name ?? "Friend"}
                    </div>

                    {c.unread > 0 && (
                      <Badge className="h-5 rounded-full px-2">
                        {c.unread}
                      </Badge>
                    )}

                    {c.last.id.startsWith("pinned-") && (
                      <Badge
                        variant="outline"
                        className="h-5 rounded-full px-2 text-[10px] uppercase tracking-wide"
                      >
                        New
                      </Badge>
                    )}
                  </div>

                  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                    {c.last.id.startsWith("pinned-")
                      ? "Open this chat to start the conversation."
                      : `${c.last.sender_id === data.me ? "You: " : ""}${messagePreview(c.last)}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.last.created_at), {
                    addSuffix: true,
                  })}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function getInitials(name?: string | null) {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function messagePreview(message: {
  body: string;
}) {
  if (message.body.trim()) return message.body;
  return "New conversation";
}
