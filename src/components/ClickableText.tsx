import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Volume2, Languages, BookmarkPlus, Loader2, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { addVocabulary, translateWord } from "@/lib/vocabulary.functions";
import { toast } from "sonner";

function speak(word: string, lang: "ar" | "en") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(word);
  u.lang = lang === "ar" ? "ar-SA" : "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export function ClickableText({
  text,
  language,
  storyId,
}: {
  text: string;
  language: "ar" | "en";
  storyId: string;
}) {
  // split keeping spaces and punctuation
  const tokens = text.split(/(\s+)/);
  return (
    <>
      {tokens.map((tok, i) => {
        if (/^\s+$/.test(tok) || !tok) return <span key={i}>{tok}</span>;
        // Strip leading/trailing punctuation for the word lookup
        const m = tok.match(/^(\W*)([\s\S]*?)(\W*)$/);
        const lead = m?.[1] ?? "";
        const core = m?.[2] ?? tok;
        const trail = m?.[3] ?? "";
        if (!core) return <span key={i}>{tok}</span>;
        return (
          <span key={i}>
            {lead}
            <WordPopover word={core} language={language} storyId={storyId} />
            {trail}
          </span>
        );
      })}
    </>
  );
}

function WordPopover({ word, language, storyId }: { word: string; language: "ar" | "en"; storyId: string }) {
  const [open, setOpen] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const trFn = useServerFn(translateWord);
  const addFn = useServerFn(addVocabulary);

  async function doTranslate() {
    if (translation || loading) return;
    setLoading(true);
    try {
      const r = await trFn({ data: { word, from: language } });
      setTranslation(r.translation);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الترجمة");
    } finally {
      setLoading(false);
    }
  }

  async function doSave() {
    try {
      await addFn({
        data: { word, language, translation: translation || null, story_id: storyId },
      });
      setSaved(true);
      toast.success(language === "ar" ? "أضيفت إلى سجل الكلمات" : "Added to vocabulary");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded px-0.5 hover:bg-primary/20 focus:bg-primary/30 transition-colors cursor-pointer"
        >
          {word}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" dir={language === "ar" ? "rtl" : "ltr"}>
        <p className="font-bold text-lg mb-1">{word}</p>
        {translation && <p className="text-sm text-muted-foreground mb-3">{translation}</p>}
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant="outline" onClick={() => speak(word, language)} title="نطق">
            <Volume2 className="size-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={doTranslate} disabled={loading} title="ترجمة">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />}
          </Button>
          <Button size="sm" onClick={doSave} disabled={saved} title="حفظ">
            {saved ? <Check className="size-4" /> : <BookmarkPlus className="size-4" />}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
