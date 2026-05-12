import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listVocabulary } from "@/lib/vocabulary.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Loader2, Volume2, Check, X, RotateCcw, Trophy, BookMarked } from "lucide-react";

export const Route = createFileRoute("/study")({
  component: StudyPage,
  head: () => ({ meta: [{ title: "وضع المذاكرة · بطاقات الكلمات" }] }),
});

type Card = { id: string; word: string; translation: string | null; language: string };

function speak(word: string, lang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(word);
  u.lang = lang === "ar" ? "ar-SA" : "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function StudyPage() {
  const nav = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [deck, setDeck] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownIds, setKnownIds] = useState<Set<string>>(new Set());
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);

  const listFn = useServerFn(listVocabulary);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) nav({ to: "/login" });
      else setAuthed(true);
    });
  }, [nav]);

  const list = useQuery({
    queryKey: ["vocabulary"],
    queryFn: () => listFn(),
    enabled: !!authed,
  });

  // Build deck once data arrives
  useEffect(() => {
    if (list.data && deck.length === 0 && !done) {
      const cards: Card[] = list.data
        .filter((v) => v.word)
        .map((v) => ({ id: v.id, word: v.word, translation: v.translation, language: v.language }));
      setDeck(shuffle(cards));
    }
  }, [list.data, deck.length, done]);

  const total = deck.length;
  const current = deck[idx];
  const progress = total > 0 ? ((idx) / total) * 100 : 0;

  function next(known: boolean) {
    if (!current) return;
    const nextKnown = new Set(knownIds);
    const nextReview = new Set(reviewIds);
    if (known) nextKnown.add(current.id);
    else nextReview.add(current.id);
    setKnownIds(nextKnown);
    setReviewIds(nextReview);
    setFlipped(false);
    if (idx + 1 >= total) {
      setDone(true);
    } else {
      setIdx(idx + 1);
    }
  }

  function restart(onlyReview = false) {
    const source = onlyReview
      ? deck.filter((c) => reviewIds.has(c.id))
      : deck;
    if (source.length === 0) return;
    setDeck(shuffle(source));
    setIdx(0);
    setFlipped(false);
    setKnownIds(new Set());
    setReviewIds(new Set());
    setDone(false);
  }

  const accuracy = useMemo(() => {
    const answered = knownIds.size + reviewIds.size;
    return answered === 0 ? 0 : Math.round((knownIds.size / answered) * 100);
  }, [knownIds, reviewIds]);

  if (!authed || list.isLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  return (
    <main dir="rtl" className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <Link to="/vocabulary" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="size-4" /> سجل الكلمات
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <BookMarked className="size-6 text-primary" /> وضع المذاكرة
        </h1>
      </header>

      {total === 0 ? (
        <Card className="worksheet-frame text-center space-y-4 py-10">
          <p className="text-muted-foreground">لا توجد كلمات في سجلك بعد.</p>
          <Button asChild><Link to="/vocabulary">إضافة كلمات</Link></Button>
        </Card>
      ) : done ? (
        <Card className="worksheet-frame text-center space-y-5">
          <Trophy className="size-16 text-secondary mx-auto" />
          <h2 className="text-2xl font-bold">انتهت الجلسة! 🎉</h2>
          <p className="text-muted-foreground">أحسنت! إليك ملخص أدائك:</p>
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            <div className="p-3 rounded-xl bg-success/10 border-2 border-success/40">
              <p className="text-2xl font-bold" style={{ color: "var(--success)" }}>{knownIds.size}</p>
              <p className="text-xs">عرفتها</p>
            </div>
            <div className="p-3 rounded-xl bg-destructive/10 border-2 border-destructive/40">
              <p className="text-2xl font-bold text-destructive">{reviewIds.size}</p>
              <p className="text-xs">للمراجعة</p>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 border-2 border-primary/40">
              <p className="text-2xl font-bold text-primary">{accuracy}%</p>
              <p className="text-xs">دقتك</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            {reviewIds.size > 0 && (
              <Button onClick={() => restart(true)} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                <RotateCcw className="size-4 ml-2" /> راجع الكلمات الصعبة
              </Button>
            )}
            <Button variant="outline" onClick={() => restart(false)}>
              <RotateCcw className="size-4 ml-2" /> ابدأ من جديد
            </Button>
            <Button asChild variant="ghost"><Link to="/vocabulary">العودة للسجل</Link></Button>
          </div>
        </Card>
      ) : current ? (
        <>
          <div className="mb-4 flex items-center justify-between text-sm font-medium">
            <span>{idx + 1} / {total}</span>
            <span className="text-muted-foreground">عرفتها: {knownIds.size} · للمراجعة: {reviewIds.size}</span>
          </div>
          <Progress value={progress} className="h-2 mb-6" />

          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="w-full perspective-[1200px] mb-6"
            aria-label="اقلب البطاقة"
          >
            <div
              className="relative w-full h-72 md:h-80 transition-transform duration-500"
              style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
            >
              {/* Front */}
              <div
                className="absolute inset-0 worksheet-frame grid place-items-center bg-gradient-to-br from-primary/15 to-secondary/10"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="text-center space-y-3" dir={current.language === "ar" ? "rtl" : "ltr"}>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                    {current.language === "ar" ? "الكلمة" : "Word"}
                  </p>
                  <p className="text-4xl md:text-5xl font-bold" style={{ fontFamily: "var(--font-handwritten)" }}>
                    {current.word}
                  </p>
                  <p className="text-xs text-muted-foreground">اضغط لعرض الترجمة</p>
                </div>
              </div>
              {/* Back */}
              <div
                className="absolute inset-0 worksheet-frame grid place-items-center bg-gradient-to-br from-secondary/15 to-primary/10"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <div className="text-center space-y-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">الترجمة</p>
                  <p className="text-3xl md:text-4xl font-bold">
                    {current.translation || <span className="text-muted-foreground italic text-xl">لا توجد ترجمة محفوظة</span>}
                  </p>
                </div>
              </div>
            </div>
          </button>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); speak(current.word, current.language); }}
            >
              <Volume2 className="size-4 ml-1" /> نطق
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFlipped((f) => !f)}
            >
              <RotateCcw className="size-4 ml-1" /> {flipped ? "اقلب" : "اعرض"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDone(true)}
            >
              إنهاء الجلسة
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-14 text-base font-bold border-2 border-destructive/40 hover:bg-destructive/10"
              onClick={() => next(false)}
            >
              <X className="size-5 ml-2 text-destructive" /> لم أعرفها
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-14 text-base font-bold bg-success hover:bg-success/90 text-white"
              style={{ backgroundColor: "var(--success)" }}
              onClick={() => next(true)}
            >
              <Check className="size-5 ml-2" /> عرفتها
            </Button>
          </div>
        </>
      ) : null}
    </main>
  );
}
