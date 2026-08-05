//conversation thread between two users
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, CheckCheck, ChevronLeft, Loader2, Send } from "lucide-react";
import { format } from "date-fns";
import { pinChat } from "@/lib/chat-conversations";

function threadQuery(otherId: string) {
  return queryOptions({
    queryKey: ["chat-thread", otherId],
  queryFn: async () => {
  const { data: userData } = await supabase.auth.getUser();

  const me = userData.user?.id;

  if (!me) {
    throw new Error("Sign in required");
  }

  if (otherId === me) {
    throw new Error("You cannot message yourself");
  }

  // Fetch messages sent by the current user to the other person
  const { data: sentMessages, error: sentError } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, body, read_at, created_at")
    .eq("sender_id", me)
    .eq("recipient_id", otherId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (sentError) {
    throw sentError;
  }

  // Fetch messages received from the other person
  const { data: receivedMessages, error: receivedError } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, body, read_at, created_at")
    .eq("sender_id", otherId)
    .eq("recipient_id", me)
    .order("created_at", { ascending: true })
    .limit(500);

  if (receivedError) {
    throw receivedError;
  }

  // Combine both directions and sort chronologically
  const msgs = [...(sentMessages ?? []), ...(receivedMessages ?? [])].sort(
    (a, b) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime(),
  );

  // Fetch the other user's profile
  const { data: prof, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", otherId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  return {
    me,
    messages: msgs,
    other: prof ?? {
      id: otherId,
      display_name: "Friend",
      avatar_url: null,
    },
  };
},
  });
}

export const Route = createFileRoute("/_authenticated/chat/$userId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      threadQuery(params.userId)
    ),
  component: ThreadPage,
});


function ThreadPage() {
  const { userId } = Route.useParams();
  return (
    <div className="flex min-h-screen flex-col">
      <div className="px-5 pt-6">
        <Link to="/chat" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Messages
        </Link>
      </div>
      <Suspense fallback={<div className="p-5"><Skeleton className="h-64 w-full" /></div>}>
        <Thread otherId={userId} />
      </Suspense>
    </div>
  );
}

function Thread({ otherId }: { otherId: string }) {
  const { data } = useSuspenseQuery(threadQuery(otherId));
  const qc = useQueryClient();
  const threadKey = ["chat-thread", otherId] as const;
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const unreadIdsRef = useRef<string[]>([]);
  const [typingPeer, setTypingPeer] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeout = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const canSend = useMemo(() => Boolean(body.trim()), [body]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data.messages.length]);

  useEffect(() => {
    pinChat(data.me, {
      id: otherId,
      display_name: data.other.display_name,
      avatar_url: data.other.avatar_url,
    });
  }, [data.me, data.other.avatar_url, data.other.display_name, otherId]);

  useEffect(() => {
    const unread = data.messages.filter((m) => m.recipient_id === data.me && !m.read_at).map((m) => m.id);
    unreadIdsRef.current = unread;
    if (!unread.length) return;
    const timer = window.setTimeout(async () => {
      const { error } = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIdsRef.current);
      if (!error) {
        qc.invalidateQueries({ queryKey: ["conversations"] });
        qc.invalidateQueries({ queryKey: threadKey });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [data.me, data.messages, qc, threadKey]);

  useEffect(() => {
    if (!data.me) return;
    const channel = supabase
      .channel(`dm-${data.me}-${otherId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const typing = payload as { userId?: string; typing?: boolean } | undefined;
        if (!typing || typing.userId === data.me) return;
        setTypingPeer(Boolean(typing.typing));
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          const m = (payload.new ?? payload.old) as
            | { sender_id: string; recipient_id: string }
            | undefined;
          if (!m) return;
          const involves =
            (m.sender_id === data.me && m.recipient_id === otherId) ||
            (m.sender_id === otherId && m.recipient_id === data.me);
          if (involves) {
            qc.invalidateQueries({ queryKey: ["chat-thread", otherId] });
            qc.invalidateQueries({ queryKey: ["conversations"] });
          }
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      void channel.send({ type: "broadcast", event: "typing", payload: { userId: data.me, typing: false } });
      supabase.removeChannel(channel);
    };
  }, [data.me, otherId, qc]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !data.me) return;
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);

    if (!body.trim()) {
      setIsTyping(false);
      void channel.send({ type: "broadcast", event: "typing", payload: { userId: data.me, typing: false } });
      return;
    }

    setIsTyping(true);
    void channel.send({ type: "broadcast", event: "typing", payload: { userId: data.me, typing: true } });
    typingTimeout.current = window.setTimeout(() => {
      setIsTyping(false);
      void channel.send({ type: "broadcast", event: "typing", payload: { userId: data.me, typing: false } });
    }, 850);

    return () => {
      if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    };
  }, [body, data.me]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!canSend || !data.me) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    const optimisticMessage = {
      id: crypto.randomUUID(),
      sender_id: data.me,
      recipient_id: otherId,
      body: text,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    const previousThread = qc.getQueryData<typeof data>(threadKey);
    qc.setQueryData<typeof data>(threadKey, (current) =>
      current ? { ...current, messages: [...current.messages, optimisticMessage] } : current,
    );
    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: data.me,
        recipient_id: otherId,
        body: text,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: threadKey });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (err) {
      qc.setQueryData(threadKey, previousThread);
      setBody(text);
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* <PageHeader
        title={data.other.display_name ?? "Friend"}
        subtitle={data.other.avatar_url ? "Online conversation" : "Direct message thread"}
      /> */}
      <div className="px-5 pb-3">
        <Card className="flex items-center gap-3 p-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={data.other.avatar_url ?? undefined} alt="" />
            <AvatarFallback>{getInitials(data.other.display_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{data.other.display_name ?? "Friend"}</div>
            <div className="truncate text-sm text-muted-foreground">Private conversation</div>
          </div>
        </Card>
        {(typingPeer || isTyping) && (
          <div className="mt-2 text-xs text-muted-foreground">
            {typingPeer ? `${data.other.display_name ?? "Friend"} is typing…` : "You are typing…"}
          </div>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 pb-4">
        {data.messages.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">Say hello 👋</div>
        )}
        {data.messages.map((m) => {
          const mine = m.sender_id === data.me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className={`mt-1 flex items-center gap-1.5 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  <span>{format(new Date(m.created_at), "p")}</span>
                  {mine && (
                    <span className="inline-flex items-center gap-0.5">
                      {m.read_at ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                      {m.read_at ? "Read" : "Sent"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="sticky bottom-16 mt-auto border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="space-y-2 rounded-2xl border border-input bg-background p-2 shadow-sm">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message…"
            className="min-h-20 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between gap-2">
            <Button type="submit" className="gap-2" disabled={sending || !canSend}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </form>
    </>
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
