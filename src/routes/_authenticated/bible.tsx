import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { BIBLE_BOOKS, fetchPassage } from "@/lib/bible";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";

const searchSchema = z.object({
  book: z.string().catch("John"),
  chapter: z.coerce.number().int().min(1).catch(1),
});

export const Route = createFileRoute("/_authenticated/bible")({
  validateSearch: zodValidator(searchSchema),
  component: BiblePage,
});

function BiblePage() {
  const { book, chapter } = Route.useSearch();
  const navigate = useNavigate();
  const bookMeta = BIBLE_BOOKS.find((b) => b.name === book) ?? BIBLE_BOOKS[42];
  const chapterCount = bookMeta.chapters;

  const { data, isLoading } = useQuery({
    queryKey: ["bible", book, chapter],
    queryFn: () => fetchPassage(`${book} ${chapter}`),
    staleTime: 24 * 60 * 60 * 1000,
  });

  function setSearch(patch: { book?: string; chapter?: number }) {
    navigate({
      to: "/bible",
      search: (prev: { book: string; chapter: number }) => ({ ...prev, ...patch }),
    });
  }

  return (
    <div>
      <PageHeader title="Scripture" subtitle="King James Version" />

      <div className="sticky top-0 z-30 -mx-0 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <div className="flex gap-2">
          <Select value={book} onValueChange={(v) => setSearch({ book: v, chapter: 1 })}>
            <SelectTrigger className="h-11 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {BIBLE_BOOKS.map((b) => (
                <SelectItem key={b.name} value={b.name}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(chapter)} onValueChange={(v) => setSearch({ chapter: Number(v) })}>
            <SelectTrigger className="h-11 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {Array.from({ length: chapterCount }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="px-5 py-6">
        <h2 className="mb-6 text-2xl">
          {book} <span className="text-muted-foreground">{chapter}</span>
        </h2>

        {isLoading || !data ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : (
          <div className="scripture space-y-3 text-lg leading-relaxed">
            {data.verses.map((v) => (
              <p key={v.verse}>
                <sup className="mr-1 not-italic font-sans text-xs font-bold text-gold">
                  {v.verse}
                </sup>
                {v.text.trim()}
              </p>
            ))}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            className="h-12 flex-1"
            disabled={chapter <= 1}
            onClick={() => setSearch({ chapter: chapter - 1 })}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <Button
            variant="outline"
            className="h-12 flex-1"
            disabled={chapter >= chapterCount}
            onClick={() => setSearch({ chapter: chapter + 1 })}
          >
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
