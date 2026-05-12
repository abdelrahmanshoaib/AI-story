import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listVocabulary,
  addVocabulary,
  deleteVocabulary,
  translateWord,
} from "@/lib/vocabulary.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Loader2, Plus, Trash2, Volume2, BookMarked, GraduationCap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/vocabulary")({
  component: VocabPage,
  head: () => ({ meta: [{ title: "سجل الكلمات والمفردات" }] }),
});

function speak(word: string, lang: "ar" | "en") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(word);
  u.lang = lang === "ar" ? "ar-SA" : "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function VocabPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [word, setWord] = useState("");
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [translation, setTranslation] = useState("");
  const [adding, setAdding] = useState(false);
  const [translating, setTranslating] = useState(false);

  const listFn = useServerFn(listVocabulary);
  const addFn = useServerFn(addVocabulary);
  const delFn = useServerFn(deleteVocabulary);
  const trFn = useServerFn(translateWord);

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

  async function handleTranslate() {
    if (!word.trim()) return;
    setTranslating(true);
    try {
      const res = await trFn({ data: { word: word.trim(), from: lang } });
      setTranslation(res.translation);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الترجمة");
    } finally {
      setTranslating(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!word.trim()) return;
    setAdding(true);
    try {
      await addFn({ data: { word: word.trim(), language: lang, translation: translation.trim() || null } });
      setWord("");
      setTranslation("");
      qc.invalidateQueries({ queryKey: ["vocabulary"] });
      toast.success("تمت الإضافة ✨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await delFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["vocabulary"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
    }
  }

  if (!authed) return <div className="min-h-screen grid place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  return (
    <main dir="rtl" className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="size-4" /> العودة
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <BookMarked className="size-6 text-primary" /> سجل الكلمات
        </h1>
        <Button asChild className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
          <Link to="/study"><GraduationCap className="size-4 ml-1" /> ابدأ المذاكرة</Link>
        </Button>
      </header>

      <Card className="worksheet-frame mb-6">
        <h2 className="text-lg font-bold mb-3">إضافة كلمة جديدة</h2>
        <form onSubmit={handleAdd} className="grid sm:grid-cols-[1fr_auto_1fr_auto] gap-3 items-end">
          <div>
            <label className="text-sm font-medium">الكلمة</label>
            <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder="اكتب الكلمة" />
          </div>
          <Select value={lang} onValueChange={(v) => setLang(v as "ar" | "en")}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ar">عربي</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
          <div>
            <label className="text-sm font-medium">الترجمة (اختياري)</label>
            <div className="flex gap-2">
              <Input value={translation} onChange={(e) => setTranslation(e.target.value)} placeholder="—" />
              <Button type="button" variant="outline" onClick={handleTranslate} disabled={translating || !word.trim()}>
                {translating ? <Loader2 className="size-4 animate-spin" /> : "ترجم"}
              </Button>
            </div>
          </div>
          <Button type="submit" disabled={adding || !word.trim()}>
            {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            إضافة
          </Button>
        </form>
      </Card>

      <Card className="worksheet-frame">
        <h2 className="text-lg font-bold mb-4">كلماتي ({list.data?.length ?? 0})</h2>
        {list.isLoading ? (
          <div className="grid place-items-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : !list.data?.length ? (
          <p className="text-muted-foreground text-center py-8">لا توجد كلمات بعد. اضغط على أي كلمة في القصة لحفظها هنا!</p>
        ) : (
          <ul className="divide-y">
            {list.data.map((v) => (
              <li key={v.id} className="py-3 flex items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted shrink-0">{v.language === "ar" ? "ع" : "EN"}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{v.word}</p>
                  {v.translation && <p className="text-sm text-muted-foreground truncate">{v.translation}</p>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => speak(v.word, v.language as "ar" | "en")}>
                  <Volume2 className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(v.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
