import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, updateProfile, getReadingStats } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowRight, Loader2, Save, Upload, User, Target, Trophy, Flame } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "لوحة التحكم · إعداداتي" },
      { name: "description", content: "خصص تجربتك: الاسم، السن، اللغة، المواضيع المفضلة وأهداف القراءة" },
    ],
  }),
});

const TOPICS = ["الأمانة", "الصدق", "حسن الخلق", "التعاون", "بر الوالدين", "النظافة", "الشجاعة", "العلم", "المغامرات", "الحيوانات", "الفضاء", "البيئة"];
const LEVELS = [
  { v: "beginner", ar: "مبتدئ" },
  { v: "intermediate", ar: "متوسط" },
  { v: "advanced", ar: "متقدم" },
];

function SettingsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    avatar_url: "" as string | null,
    age: 8,
    arabic_level: "beginner",
    english_level: "beginner",
    favorite_topics: [] as string[],
    preferred_language: "ar",
    preferred_size: "medium",
    daily_goal: 1,
    weekly_goal: 5,
    monthly_goal: 20,
    font_family: "default",
    font_size: "medium",
    color_theme: "default",
    app_style: "playful",
  });

  const getProfileFn = useServerFn(getProfile);
  const updateProfileFn = useServerFn(updateProfile);
  const getStatsFn = useServerFn(getReadingStats);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) nav({ to: "/login" });
      else { setAuthed(true); setUserId(data.session.user.id); }
    });
  }, [nav]);

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfileFn(),
    enabled: !!authed,
  });

  const stats = useQuery({
    queryKey: ["reading-stats"],
    queryFn: () => getStatsFn(),
    enabled: !!authed,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (profile.data) {
      const p = profile.data as Record<string, unknown>;
      setForm({
        display_name: (p.display_name as string) ?? "",
        avatar_url: (p.avatar_url as string) ?? null,
        age: (p.age as number) ?? 8,
        arabic_level: (p.arabic_level as string) ?? "beginner",
        english_level: (p.english_level as string) ?? "beginner",
        favorite_topics: (p.favorite_topics as string[]) ?? [],
        preferred_language: (p.preferred_language as string) ?? "ar",
        preferred_size: (p.preferred_size as string) ?? "medium",
        daily_goal: (p.daily_goal as number) ?? 1,
        weekly_goal: (p.weekly_goal as number) ?? 5,
        monthly_goal: (p.monthly_goal as number) ?? 20,
        font_family: (p.font_family as string) ?? "default",
        font_size: (p.font_size as string) ?? "medium",
        color_theme: (p.color_theme as string) ?? "default",
        app_style: (p.app_style as string) ?? "playful",
      });
    }
  }, [profile.data]);

  function toggleTopic(t: string) {
    setForm((f) => ({
      ...f,
      favorite_topics: f.favorite_topics.includes(t)
        ? f.favorite_topics.filter((x) => x !== t)
        : [...f.favorite_topics, t],
    }));
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("الصورة أكبر من 3 ميجابايت");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setForm((f) => ({ ...f, avatar_url: data.publicUrl }));
      toast.success("تم رفع الصورة، اضغط حفظ للتأكيد");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الرفع");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfileFn({
        data: {
          display_name: form.display_name.trim() || null,
          avatar_url: form.avatar_url || null,
          age: Number(form.age),
          arabic_level: form.arabic_level as "beginner" | "intermediate" | "advanced",
          english_level: form.english_level as "beginner" | "intermediate" | "advanced",
          favorite_topics: form.favorite_topics,
          preferred_language: form.preferred_language as "ar" | "en",
          preferred_size: form.preferred_size as "small" | "medium" | "large",
          daily_goal: Number(form.daily_goal),
          weekly_goal: Number(form.weekly_goal),
          monthly_goal: Number(form.monthly_goal),
          font_family: form.font_family as "default" | "handwritten" | "serif" | "mono",
          font_size: form.font_size as "small" | "medium" | "large" | "xlarge",
          color_theme: form.color_theme as "default" | "ocean" | "forest" | "sunset" | "candy" | "midnight",
          app_style: form.app_style as "playful" | "minimal" | "classic",
        },
      });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("تم حفظ التفضيلات ✨");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  if (authed === null || profile.isLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  const motivational = (() => {
    const t = stats.data?.today ?? 0;
    const goal = form.daily_goal;
    if (goal === 0) return "استمتع بالقراءة بدون ضغط الأهداف 🌿";
    if (t >= goal) return "🎉 رائع! حققت هدفك اليومي، أكمل التميز!";
    const left = goal - t;
    return `📚 باقي ${left} ${left === 1 ? "قصة" : "قصص"} لتحقق هدفك اليوم. أنت تستطيع!`;
  })();

  return (
    <main dir="rtl" className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="size-4" /> العودة للرئيسية
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold">لوحة التحكم</h1>
      </header>

      {/* Motivational banner */}
      <Card className="worksheet-frame mb-6 bg-gradient-to-l from-secondary/15 to-primary/15">
        <div className="flex items-center gap-3">
          <Flame className="size-8 text-secondary shrink-0" />
          <p className="font-bold text-lg">{motivational}</p>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "اليوم", value: stats.data?.today ?? 0, goal: form.daily_goal, icon: Target },
          { label: "الأسبوع", value: stats.data?.week ?? 0, goal: form.weekly_goal, icon: Trophy },
          { label: "الشهر", value: stats.data?.month ?? 0, goal: form.monthly_goal, icon: Trophy },
        ].map((s) => {
          const pct = s.goal > 0 ? Math.min(100, (s.value / s.goal) * 100) : 0;
          return (
            <Card key={s.label} className="worksheet-frame">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-muted-foreground">{s.label}</span>
                <s.icon className="size-4 text-secondary" />
              </div>
              <p className="text-2xl font-bold">{s.value}<span className="text-sm text-muted-foreground"> / {s.goal}</span></p>
              <Progress value={pct} className="h-2 mt-2" />
            </Card>
          );
        })}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile */}
        <Card className="worksheet-frame">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><User className="size-5 text-primary" /> ملفي الشخصي</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="size-20 rounded-full overflow-hidden bg-muted border-2 border-primary/40 grid place-items-center">
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="size-8 text-muted-foreground" />
              )}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="size-4 animate-spin ml-2" /> : <Upload className="size-4 ml-2" />}
                رفع صورة
              </Button>
              {form.avatar_url && (
                <Button type="button" variant="ghost" size="sm" className="mr-2" onClick={() => setForm((f) => ({ ...f, avatar_url: null }))}>
                  إزالة
                </Button>
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الاسم</Label>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="اسمك" />
            </div>
            <div className="space-y-2">
              <Label>السن</Label>
              <Input type="number" min={3} max={99} value={form.age} onChange={(e) => setForm({ ...form, age: Number(e.target.value) })} />
            </div>
          </div>
        </Card>

        {/* Languages */}
        <Card className="worksheet-frame">
          <h2 className="text-xl font-bold mb-4">مستوى اللغة</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>العربية</Label>
              <Select value={form.arabic_level} onValueChange={(v) => setForm({ ...form, arabic_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEVELS.map((l) => <SelectItem key={l.v} value={l.v}>{l.ar}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الإنجليزية</Label>
              <Select value={form.english_level} onValueChange={(v) => setForm({ ...form, english_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEVELS.map((l) => <SelectItem key={l.v} value={l.v}>{l.ar}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>اللغة المفضلة للقصص</Label>
              <Select value={form.preferred_language} onValueChange={(v) => setForm({ ...form, preferred_language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الحجم المفضل للقصة</Label>
              <Select value={form.preferred_size} onValueChange={(v) => setForm({ ...form, preferred_size: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">صغيرة</SelectItem>
                  <SelectItem value="medium">متوسطة</SelectItem>
                  <SelectItem value="large">كبيرة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Favorite topics */}
        <Card className="worksheet-frame">
          <h2 className="text-xl font-bold mb-4">المواضيع المفضلة</h2>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => toggleTopic(t)}
                className={`px-3 py-1.5 rounded-full border-2 text-sm font-medium transition ${form.favorite_topics.includes(t) ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border hover:border-primary"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </Card>

        {/* Goals */}
        <Card className="worksheet-frame">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Target className="size-5 text-secondary" /> أهداف القراءة</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>قصص في اليوم</Label>
              <Input type="number" min={0} max={50} value={form.daily_goal} onChange={(e) => setForm({ ...form, daily_goal: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>قصص في الأسبوع</Label>
              <Input type="number" min={0} max={200} value={form.weekly_goal} onChange={(e) => setForm({ ...form, weekly_goal: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>قصص في الشهر</Label>
              <Input type="number" min={0} max={1000} value={form.monthly_goal} onChange={(e) => setForm({ ...form, monthly_goal: Number(e.target.value) })} />
            </div>
          </div>
        </Card>

        <div className="sticky bottom-4">
          <Button type="submit" disabled={saving} className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground">
            {saving ? <Loader2 className="size-5 animate-spin ml-2" /> : <Save className="size-5 ml-2" />}
            حفظ التفضيلات
          </Button>
        </div>
      </form>
    </main>
  );
}
