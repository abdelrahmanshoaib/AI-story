import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStory } from "@/lib/story.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Loader2, Printer, Sparkles, CheckCircle2, XCircle, BookMarked } from "lucide-react";
import { ClickableText } from "@/components/ClickableText";

type Question = {
  type: "mcq" | "true_false" | "fill_blank";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
};

export const Route = createFileRoute("/story/$id")({
  component: StoryPage,
});

function StoryPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const getFn = useServerFn(getStory);
  const isValidStoryId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) nav({ to: "/login" });
      else setAuthed(true);
    });
  }, [nav]);

  const story = useQuery({
    queryKey: ["story", id],
    queryFn: async () => {
      try {
        return await getFn({ data: { id } });
      } catch {
        return null;
      }
    },
    enabled: !!authed && isValidStoryId,
    retry: false,
  });

  if (!authed) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }
  if (!isValidStoryId) {
    return (
      <main dir="rtl" className="min-h-screen grid place-items-center px-4">
        <Card className="worksheet-frame max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">رابط القصة غير صحيح</h1>
          <p className="text-muted-foreground">ارجع للصفحة الرئيسية وأنشئ قصة جديدة.</p>
          <Button asChild><Link to="/">العودة للرئيسية</Link></Button>
        </Card>
      </main>
    );
  }
  if (story.isLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }
  if (story.error || !story.data) {
    return (
      <main dir="rtl" className="min-h-screen grid place-items-center px-4">
        <Card className="worksheet-frame max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">القصة غير موجودة</h1>
          <p className="text-muted-foreground">قد تكون محذوفة أو لا تخص حسابك الحالي.</p>
          <Button asChild><Link to="/">العودة للرئيسية</Link></Button>
        </Card>
      </main>
    );
  }

  const s = story.data;
  const questions = (s.questions as unknown as Question[]) || [];
  const isAr = s.language === "ar";
  const dir = isAr ? "rtl" : "ltr";

  const score = submitted
    ? questions.reduce((acc, q, i) => {
        const a = (answers[i] || "").trim().toLowerCase();
        const c = q.correctAnswer.trim().toLowerCase();
        return a === c ? acc + 1 : acc;
      }, 0)
    : 0;

  return (
    <main dir={dir} className="min-h-screen px-4 py-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4 no-print">
        <Button variant="ghost" asChild>
          <Link to="/"><ArrowRight className="size-4 ml-1" /> {isAr ? "العودة" : "Back"}</Link>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4 ml-1" /> {isAr ? "طباعة / PDF" : "Print / PDF"}
        </Button>
      </div>

      <Card className="worksheet-frame space-y-6">
        <header className="text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
            {isAr ? "اقرأ وأجب" : "Read & Answer"}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mt-1" style={{ fontFamily: "var(--font-handwritten)" }}>
            {s.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr ? "اقرأ القصة و أجب على الأسئلة" : "Read the story and answer the questions"}
          </p>
        </header>

        <section className="story-box">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <p className="text-lg md:text-xl leading-loose flex-1" style={{ fontFamily: "var(--font-handwritten)" }}>
              <ClickableText text={s.story_text} language={s.language as "ar" | "en"} storyId={s.id} />
            </p>
            {s.image_url && (
              <img src={s.image_url} alt={s.title} className="w-40 h-40 md:w-48 md:h-48 object-contain shrink-0" />
            )}
          </div>
        </section>

        <section className="space-y-5">
          {questions.map((q, i) => {
            const selected = answers[i];
            const correct = q.correctAnswer.trim().toLowerCase();
            const opts = q.type === "true_false"
              ? (isAr ? ["صح", "خطأ"] : ["True", "False"])
              : q.options || [];
            const isFill = q.type === "fill_blank";

            return (
              <div key={i} className="space-y-2">
                <p className="font-bold text-lg">
                  <span className="text-secondary">{i + 1}.</span> {q.question}
                </p>
                {isFill ? (
                  <input
                    type="text"
                    value={selected || ""}
                    disabled={submitted}
                    onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                    className="w-full md:w-64 px-4 py-2 rounded-xl border-2 border-primary bg-card text-base"
                    placeholder={isAr ? "اكتب الإجابة..." : "Type your answer..."}
                  />
                ) : (
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {opts.map((opt) => {
                      const isSel = selected === opt;
                      const isCorrect = submitted && opt.trim().toLowerCase() === correct;
                      const isWrong = submitted && isSel && !isCorrect;
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={submitted}
                          onClick={() => setAnswers({ ...answers, [i]: opt })}
                          className="flex items-center gap-2 group"
                        >
                          <span
                            className="answer-circle"
                            data-selected={isSel || undefined}
                            data-correct={isCorrect || undefined}
                            data-wrong={isWrong || undefined}
                          />
                          <span className="text-base font-medium">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {submitted && (
                  <div className={`text-sm flex items-start gap-2 mt-1 ${
                    (selected || "").trim().toLowerCase() === correct ? "text-success" : "text-destructive"
                  }`}>
                    {(selected || "").trim().toLowerCase() === correct
                      ? <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
                      : <XCircle className="size-4 mt-0.5 shrink-0" />}
                    <span>
                      <strong>{isAr ? "الإجابة: " : "Answer: "}{q.correctAnswer}</strong>
                      {q.explanation && <> — {q.explanation}</>}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <div className="flex flex-col sm:flex-row gap-3 no-print">
          {!submitted ? (
            <Button onClick={() => setSubmitted(true)} className="flex-1 h-12 text-base font-bold bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              {isAr ? "تصحيح الإجابات" : "Check answers"}
            </Button>
          ) : (
            <div className="flex-1 grid place-items-center rounded-xl bg-success/10 border-2 border-success px-4 py-3">
              <p className="font-bold text-success-foreground text-lg" style={{ color: "var(--success)" }}>
                {isAr ? `نتيجتك: ${score} من ${questions.length}` : `Score: ${score} / ${questions.length}`}
              </p>
            </div>
          )}
          <Button variant="outline" asChild className="h-12 text-base">
            <Link to="/"><Sparkles className="size-4 ml-1" /> {isAr ? "قصة جديدة" : "New story"}</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}
