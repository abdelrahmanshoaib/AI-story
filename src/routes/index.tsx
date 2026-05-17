import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateStory, listStories, deleteStory } from "@/lib/story.functions";
import { getProfile } from "@/lib/profile.functions";
import { isAdmin as isAdminFn } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BookOpen, Loader2, Sparkles, Trash2, LogOut, Wand2, Settings as SettingsIcon, User, BookMarked, Shield, Compass } from "lucide-react";
import { KIDS_CATEGORIES, AGE_GROUPS, type AgeGroupId } from "@/lib/kids-topics";

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
  const [ageGroup, setAgeGroup] = useState<AgeGroupId | "auto">("auto");
  const [activeCategory, setActiveCategory] = useState<string>(KIDS_CATEGORIES[0].id);
  const [loading, setLoading] = useState(false);

  const generateFn = useServerFn(generateStory);
  const listFn = useServerFn(listStories);
  const deleteFn = useServerFn(deleteStory);
  const getProfileFn = useServerFn(getProfile);
  const isAdminQuery = useServerFn(isAdminFn);

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

  const adminCheck = useQuery({
    queryKey: ["isAdmin"],
    queryFn: () => isAdminQuery(),
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
      const ageOverride = ageGroup === "auto" ? undefined : AGE_GROUPS.find((g) => g.id === ageGroup)?.age;
      const res = await generateFn({ data: { topic: finalTopic, language, size, ageOverride } });
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
            <Link to="/vocabulary"><BookMarked className="size-4 ml-1" /> كلماتي</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/settings"><SettingsIcon className="size-4 ml-1" /> الإعدادات</Link>
          </Button>
          {adminCheck.data?.isAdmin && (
            <Button asChild variant="default" size="sm">
              <Link to="/admin"><Shield className="size-4 ml-1" /> الأدمن</Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4 ml-1" /> خروج
          </Button>
        </div>
      </header>

      {/* بطاقتا الأقسام: قصص vs معلومات */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-3xl p-5 border-2 border-primary bg-primary/5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="size-5 text-primary" />
              <h2 className="text-lg md:text-xl font-extrabold">قسم القصص</h2>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">قصص تربوية بنهايات سعيدة وقيم إسلامية</p>
          </div>
          <span className="text-2xl">📖</span>
        </div>
        <Link to="/explore" className="rounded-3xl p-5 border-2 border-secondary bg-secondary/5 flex items-center justify-between gap-3 hover:bg-secondary/10 transition">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Compass className="size-5 text-secondary" />
              <h2 className="text-lg md:text-xl font-extrabold">اكتشف وتعلّم</h2>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">معلومات وحقائق ممتعة ودقيقة — ليست قصصاً</p>
          </div>
          <span className="text-2xl">💡</span>
        </Link>
      </div>

      {/* مكتبة مواضيع القصص */}
      <Card className="worksheet-frame mb-6">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-secondary" />
            <h2 className="text-xl md:text-2xl font-bold">مواضيع جاهزة للقصص</h2>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">اختر موضوعاً لتنشأ قصة ممتعة بإذن الله ✨</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {KIDS_CATEGORIES.map((c) => (
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
          {KIDS_CATEGORIES.find((c) => c.id === activeCategory)?.topics.map((t) => {
            const Icon = t.icon;
            const isActive = topic === t.prompt && !customTopic;
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  setTopic(t.prompt);
                  setCustomTopic("");
                  setLanguage("ar");
                  const form = document.getElementById("create-story-form");
                  form?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition text-center ${isActive ? "bg-primary/10 border-primary" : "bg-card border-border hover:border-primary hover:bg-primary/5"}`}
              >
                <div className={`size-10 rounded-xl grid place-items-center ${isActive ? "bg-primary text-primary-foreground" : "bg-secondary/15 text-secondary"}`}>
                  <Icon className="size-5" />
                </div>
                <span className="text-xs md:text-sm font-bold leading-tight">{t.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
        <Card id="create-story-form" className="worksheet-frame">
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
              {topic && !customTopic && (
                <p className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 mt-2">
                  ✅ الموضوع المختار: <span className="font-bold">{topic}</span>
                </p>
              )}
              <Input
                placeholder={language === "ar" ? "أو اكتب موضوعاً مخصصاً (مثل: قصة عن النبي يوسف)" : "Or type a custom topic"}
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="mt-2"
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
