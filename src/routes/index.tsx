import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateStory, listStories, deleteStory } from "@/lib/story.functions";
import { getProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BookOpen, Loader2, Sparkles, Trash2, LogOut, Wand2, Settings as SettingsIcon, User } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "مولّد قصص الأطفال بالذكاء الاصطناعي" },
      { name: "description", content: "أنشئ قصصاً قصيرة تعليمية للأطفال مع رسومات وأسئلة فهم تفاعلية" },
    ],
  }),
});

const TOPICS_AR = ["الأمانة", "الصدق", "حسن الخلق", "التعاون", "بر الوالدين", "النظافة", "الشجاعة", "العلم والمعرفة"];
const TOPICS_EN = ["Honesty", "Kindness", "Teamwork", "Bravery", "Cleanliness", "Respect", "Curiosity", "Friendship"];

function Home() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [topic, setTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [size, setSize] = useState<"small" | "medium" | "large">("medium");
  const [loading, setLoading] = useState(false);

  const generateFn = useServerFn(generateStory);
  const listFn = useServerFn(listStories);
  const deleteFn = useServerFn(deleteStory);
  const getProfileFn = useServerFn(getProfile);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) nav({ to: "/login" });
      else setAuthed(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) nav({ to: "/login" });
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  const stories = useQuery({
    queryKey: ["stories"],
    queryFn: () => listFn(),
    enabled: !!authed,
  });

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfileFn(),
    enabled: !!authed,
  });

  // Apply profile defaults once
  useEffect(() => {
    if (profile.data) {
      if (profile.data.preferred_language) setLanguage(profile.data.preferred_language as "ar" | "en");
      if (profile.data.preferred_size) setSize(profile.data.preferred_size as "small" | "medium" | "large");
    }
  }, [profile.data]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const finalTopic = (customTopic.trim() || topic).trim();
    if (!finalTopic) {
      toast.error(language === "ar" ? "اختر موضوعاً للقصة" : "Pick a topic");
      return;
    }
    setLoading(true);
    try {
      const res = await generateFn({ data: { topic: finalTopic, language, size } });
      if (!res?.id) {
        throw new Error(language === "ar" ? "لم يتم إنشاء رابط القصة" : "Story link was not created");
      }
      qc.invalidateQueries({ queryKey: ["stories"] });
      nav({ to: "/story/$id", params: { id: res.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الإنشاء");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (authed === null) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  const baseTopics = language === "ar" ? TOPICS_AR : TOPICS_EN;
  const favTopics = profile.data?.favorite_topics ?? [];
  const topics = Array.from(new Set([...favTopics, ...baseTopics]));
  const displayName = profile.data?.display_name;

  return (
    <main dir="rtl" className="min-h-screen px-4 py-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-8 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-12 rounded-2xl bg-primary grid place-items-center shadow-md rotate-[-4deg] shrink-0">
            <BookOpen className="size-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-3xl font-bold truncate">
              {displayName ? `أهلاً ${displayName}` : "مولّد قصص الأطفال"}
            </h1>
            <p className="text-xs text-muted-foreground">قصص بالذكاء الاصطناعي مع رسومات وأسئلة</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/settings" className="flex items-center gap-2">
            <div className="size-10 rounded-full overflow-hidden bg-muted border-2 border-primary/40 grid place-items-center hover:border-primary transition">
              {profile.data?.avatar_url ? (
                <img src={profile.data.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="size-5 text-muted-foreground" />
              )}
            </div>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/settings"><SettingsIcon className="size-4 ml-1" /> الإعدادات</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4 ml-1" /> خروج
          </Button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
        <Card className="worksheet-frame">
          <div className="flex items-center gap-2 mb-5">
            <Wand2 className="size-5 text-secondary" />
            <h2 className="text-2xl font-bold">أنشئ قصة جديدة</h2>
          </div>
          <form onSubmit={handleGenerate} className="space-y-5">
            <div className="space-y-2">
              <Label className="font-bold">موضوع القصة</Label>
              <div className="flex flex-wrap gap-2">
                {topics.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTopic(t); setCustomTopic(""); }}
                    className={`px-3 py-1.5 rounded-full border-2 text-sm font-medium transition ${topic === t && !customTopic ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border hover:border-primary"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Input
                placeholder={language === "ar" ? "أو اكتب موضوعاً مخصصاً (مثل: قصة عن النبي يوسف)" : "Or type a custom topic"}
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <Label className="font-bold">حجم القصة</Label>
                <Select value={size} onValueChange={(v) => setSize(v as "small" | "medium" | "large")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">صغيرة</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="large">كبيرة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              {loading ? (
                <><Loader2 className="size-5 animate-spin ml-2" /> جاري إنشاء قصتك...</>
              ) : (
                <><Sparkles className="size-5 ml-2" /> أنشئ قصة</>
              )}
            </Button>
            {loading && (
              <p className="text-center text-sm text-muted-foreground">قد يستغرق هذا 15-30 ثانية لإنشاء القصة والرسمة</p>
            )}
          </form>
        </Card>

        <Card className="worksheet-frame">
          <h2 className="text-2xl font-bold mb-4">📚 قصصي السابقة</h2>
          {stories.isLoading ? (
            <div className="grid place-items-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>
          ) : !stories.data?.length ? (
            <p className="text-muted-foreground text-center py-10">لا توجد قصص بعد. أنشئ قصتك الأولى!</p>
          ) : (
            <ul className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {stories.data.map((s) => (
                <li key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition group">
                  <div className="size-14 rounded-lg overflow-hidden bg-card border-2 border-primary/30 shrink-0">
                    {s.image_url ? (
                      <img src={s.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center"><BookOpen className="size-5 text-muted-foreground" /></div>
                    )}
                  </div>
                  <Link to="/story/$id" params={{ id: s.id }} className="flex-1 min-w-0">
                    <p className="font-bold truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.topic} · {s.language === "ar" ? "عربي" : "English"}</p>
                  </Link>
                  <button
                    onClick={async () => {
                      await deleteFn({ data: { id: s.id } });
                      qc.invalidateQueries({ queryKey: ["stories"] });
                    }}
                    className="opacity-0 group-hover:opacity-100 transition p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                    aria-label="حذف"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
