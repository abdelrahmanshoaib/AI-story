import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { generateText, Output } from "ai";
import { z } from "zod";

const FactsSchema = z.object({
  title: z.string(),
  intro: z.string(),
  facts: z.array(z.string()).min(3).max(8),
  didYouKnow: z.string(),
  lesson: z.string(),
  closing: z.string(),
  encouragement: z.string(),
});

export type FactsContent = z.infer<typeof FactsSchema>;

const InputSchema = z.object({
  topic: z.string().min(2).max(200),
  language: z.enum(["ar", "en"]),
  size: z.enum(["small", "medium", "large"]),
  ageOverride: z.number().int().min(3).max(14).optional(),
});

const sizeHint: Record<string, string> = {
  small: "3-4 facts, very short sentences",
  medium: "5-6 facts, short clear sentences",
  large: "7-8 facts with a bit more detail but still simple",
};

export const generateFacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const langName = data.language === "ar" ? "Arabic" : "English";
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("age")
      .eq("user_id", context.userId)
      .maybeSingle();
    const age = data.ageOverride ?? profile?.age ?? 8;

    const rules = `STRICT RULES (MUST FOLLOW):\n- This is EDUCATIONAL / INFORMATIONAL content, NOT a story. Do NOT invent characters or narrative.\n- All facts MUST be 100% scientifically/historically ACCURATE. If unsure, omit. Never fabricate.\n- 100% safe for a ${age}-year-old child. Very simple words, short sentences.\n- Respect Islamic and Arabic identity. No content that contradicts Islam (no magic, no inappropriate themes, no music idolization, no alcohol, no violence/horror).\n- For religious topics (prophets, sahaba, Islamic etiquette) only use authentic well-known information.\n- Include a clear educational/moral takeaway suited for the child.\n- End with a short Islamic encouraging phrase${data.language === "ar" ? ' such as: "بارك الله فيك يا بطل", "ما شاء الله", "العلم نور يا صغيري", "المسلم الذكي يحب المعرفة", "استمر في التعلم".' : "."}`;

    const system = `You are an expert children's educator producing accurate, age-appropriate INFORMATIONAL content (NOT a story) for Muslim Arab kids in ${langName}, age ${age}. Style: ${sizeHint[data.size]}. Use a friendly, exciting "did you know" tone — bullet-style facts, NOT a narrative.\n\n${rules}\n\nReturn strictly valid JSON: title (catchy), intro (1-2 short sentences introducing the topic), facts (array of short standalone factual sentences — each fact MUST be true), didYouKnow (one surprising true fact), lesson (educational or moral value), closing (1 short sentence wrapping up), encouragement (short Islamic encouraging phrase to the child).`;

    async function tryGenerate() {
      const { experimental_output } = await generateText({
        model,
        system,
        prompt: `Topic: ${data.topic}\nLanguage: ${langName}\nSize: ${data.size}\nReturn ONLY a single JSON object.`,
        experimental_output: Output.object({ schema: FactsSchema }),
        maxOutputTokens: 3000,
      });
      return experimental_output;
    }

    async function fallback() {
      const { text } = await generateText({
        model,
        system: system + `\nReturn ONLY valid JSON, no markdown.`,
        prompt: `Topic: ${data.topic}\nLanguage: ${langName}\nSize: ${data.size}`,
        maxOutputTokens: 3000,
      });
      const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
      const s = cleaned.indexOf("{");
      const e = cleaned.lastIndexOf("}");
      if (s === -1 || e === -1) throw new Error("No JSON");
      return FactsSchema.parse(JSON.parse(cleaned.slice(s, e + 1)));
    }

    try {
      return await tryGenerate();
    } catch (e) {
      console.error("facts structured failed", e);
      try {
        return await fallback();
      } catch (e2) {
        console.error("facts fallback failed", e2);
        throw new Error(
          data.language === "ar"
            ? "تعذر إنشاء المحتوى، حاول مرة أخرى"
            : "Could not generate content, please try again"
        );
      }
    }
  });
