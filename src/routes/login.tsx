import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { BookOpen, Sparkles } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول · مولد القصص" },
      { name: "description", content: "سجّل الدخول لإنشاء قصص أطفال بالذكاء الاصطناعي" },
    ],
  }),
});

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) nav({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب! يمكنك تسجيل الدخول الآن");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    try {
      const { lovable } = await import("@/integrations/lovable/index");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) toast.error("فشل تسجيل الدخول بجوجل");
    } catch {
      toast.error("سجّل الدخول بالبريد الإلكتروني");
    }
  }

  return (
    <main dir="rtl" className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="worksheet-frame w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="size-14 rounded-2xl bg-primary grid place-items-center shadow-lg">
            <BookOpen className="size-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold">مولّد قصص الأطفال</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1">
            <Sparkles className="size-4" /> قصص ممتعة بالذكاء الاصطناعي
          </p>
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full font-bold text-base h-11">
            {loading ? "..." : mode === "signin" ? "دخول" : "إنشاء حساب"}
          </Button>
        </form>

        <div className="relative text-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
          <span className="relative bg-card px-3 text-xs text-muted-foreground">أو</span>
        </div>

        <Button variant="outline" onClick={handleGoogle} className="w-full h-11 font-medium">
          المتابعة عبر Google
        </Button>

        <p className="text-center text-sm">
          {mode === "signin" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}{" "}
          <button type="button" className="text-secondary font-bold underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "أنشئ حساباً" : "سجّل الدخول"}
          </button>
        </p>
      </Card>
    </main>
  );
}
