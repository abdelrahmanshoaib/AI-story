import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateFacts, type FactsContent } from "@/lib/facts.functions";
import { getProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Lightbulb, Sparkles, ArrowRight, Compass, GraduationCap, Heart,
} from "lucide-react";
import { KIDS_CATEGORIES, AGE_GROUPS, type AgeGroupId } from "@/lib/kids-topics";

export const Route = createFileRoute("/explore")({
  component: ExplorePage,
  head: () => ({
    meta: [
      { title: "اكتشف وتعلّم — معلومات ممتعة للأطفال" },
      { name: "description", content: "محتوى معرفي وثقافي مبسّط للأطفال: علوم، فضاء، حيوانات، إسلاميات، حقائق ممتعة" },
    ],
  }),
});

function ExplorePage() {
  const nav = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [topic, setTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [size, setSize] = useState<"small" | "medium" | "large">("medium");
  const [ageGroup, setAgeGroup] = useState<AgeGroupId | "auto">("auto");
  const [activeCategory, setActiveCategory] = useState<string>(KIDS_CATEGORIES[0].id);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FactsContent | null>(null);

  const generateFn = useServerFn(generateFacts);
  const getProfileFn = useServerFn(getProfile);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) nav({ to: "/login" });
      else setAuthed(true);
    });
  }, [nav]);

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfileFn(),
    enabled: !!authed,
  });

  useEffect(() => {
    if (profile.data?.preferred_language) {
      setLanguage(profile.data.preferred_language as "ar" | "en");
    }
  }, [profile.data]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const finalTopic = (customTopic.trim() || topic).trim();
    if (!finalTopic) {
      toast.error(language === "ar" ? "اختر موضوعاً" : "Pick a topic");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const ageOverride = ageGroup === "auto"
        ? undefined
        : AGE_GROUPS.find((g) => g.id === ageGroup)?.age;
      const res = await generateFn({ data: { topic: finalTopic, language, size, ageOverride } });
      setResult(res);
      setTimeout(() => {
        document.getElementById("facts-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الإنشاء");
    } finally {
      setLoading(false);
    }
  }

  if (authed === null) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  const cats = KIDS_CATEGORIES;

  return (
    <main dir="rtl" className="min-h-screen px-4 py-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-12 rounded-2xl bg-secondary grid place-items-center shadow-md rotate-[-4deg] shrink-0">
            <Compass className="size-6 text-secondary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-3xl font-bold truncate">اكتشف وتعلّم</h1>
            <p className="text-xs text-muted-foreground">معلومات ممتعة ودقيقة للأطفال — ليست قصصاً</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/"><ArrowRight className="size-4 ml-1" /> القصص</Link>
        </Button>
      </header>

      {/* مكتبة مواضيع المعلومات */}
      <Card className="worksheet-frame mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="size-5 text-secondary" />
          <h2 className="text-xl md:text-2xl font-bold">اختر موضوعاً لتتعلّمه</h2>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              className={`px-3 py-1.5 rounded-full border-2 text-sm font-bold transition ${activeCategory === c.id ? "bg-secondary border-secondary text-secondary-foreground" : "bg-card border-border hover:border-secondary"}`}
            >
              <span className="ml-1">{c.emoji}</span> {c.title}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {cats.find((c) => c.id === activeCategory)?.topics.map((t) => {
            const Icon = t.icon;
            const isActive = topic === t.prompt && !customTopic;
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  setTopic(t.prompt);
                  setCustomTopic("");
                  document.getElementById("facts-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition text-center ${isActive ? "bg-secondary/15 border-secondary" : "bg-card border-border hover:border-secondary hover:bg-secondary/5"}`}
              >
                <div className={`size-10 rounded-xl grid place-items-center ${isActive ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"}`}>
                  <Icon className="size-5" />
                </div>
                <span className="text-xs md:text-sm font-bold leading-tight">{t.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card id="facts-form" className="worksheet-frame mb-6">
        <div className="flex items-center gap-2 mb-5">
          <GraduationCap className="size-5 text-secondary" />
          <h2 className="text-2xl font-bold">أنشئ محتوى تعليمي</h2>
        </div>
        <form onSubmit={handleGenerate} className="space-y-5">
          <div className="space-y-2">
            <Label className="font-bold">الموضوع</Label>
            {topic && !customTopic && (
              <p className="text-xs text-muted-foreground bg-secondary/10 border border-secondary/30 rounded-lg px-3 py-2">
                ✅ الموضوع المختار: <span className="font-bold">{topic}</span>
              </p>
            )}
            <Input
              placeholder={language === "ar" ? "أو اكتب موضوعاً مخصصاً (مثل: كيف تطير الطائرات؟)" : "Or type a custom topic"}
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="font-bold">اللغة</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as "ar" | "en")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">حجم المحتوى</Label>
              <Select value={size} onValueChange={(v) => setSize(v as "small" | "medium" | "large")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">قصير</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="large">مفصّل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label className="font-bold">الفئة العمرية</Label>
              <Select value={ageGroup} onValueChange={(v) => setAgeGroup(v as AgeGroupId | "auto")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">حسب ملفي</SelectItem>
                  {AGE_GROUPS.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground">
            {loading ? (
              <><Loader2 className="size-5 animate-spin ml-2" /> جاري إعداد المحتوى...</>
            ) : (
              <><Lightbulb className="size-5 ml-2" /> اكتشف وتعلّم</>
            )}
          </Button>
        </form>
      </Card>

      {result && (
        <Card id="facts-result" className="worksheet-frame">
          <h2 className="text-2xl md:text-3xl font-extrabold mb-3 text-primary">{result.title}</h2>
          <p className="text-lg leading-relaxed mb-5 text-foreground/90">{result.intro}</p>

          <div className="mb-5">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Sparkles className="size-5 text-secondary" /> حقائق ممتعة
            </h3>
            <ul className="space-y-2">
              {result.facts.map((f, i) => (
                <li key={i} className="flex gap-3 p-3 rounded-xl bg-muted/50">
                  <span className="size-7 rounded-full bg-secondary text-secondary-foreground grid place-items-center font-bold shrink-0">{i + 1}</span>
                  <span className="text-base leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-5 p-4 rounded-2xl bg-primary/10 border-2 border-primary/30">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Lightbulb className="size-5 text-primary" /> هل تعلم؟
            </h3>
            <p className="text-base leading-relaxed">{result.didYouKnow}</p>
          </div>

          <div className="mb-5 p-4 rounded-2xl bg-secondary/10 border-2 border-secondary/30">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Heart className="size-5 text-secondary" /> ما الذي نتعلّمه؟
            </h3>
            <p className="text-base leading-relaxed">{result.lesson}</p>
          </div>

          <p className="text-base leading-relaxed text-foreground/80 mb-3">{result.closing}</p>
          <p className="text-center text-lg font-bold text-primary py-3 rounded-xl bg-primary/5 border border-primary/20">
            ⭐ {result.encouragement}
          </p>
        </Card>
      )}
    </main>
  );
}
