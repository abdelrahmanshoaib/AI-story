import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { generateText } from "ai";
import { z } from "zod";

export const listVocabulary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vocabulary")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data;
  });

export const addVocabulary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      word: z.string().trim().min(1).max(100),
      translation: z.string().trim().max(500).nullable().optional(),
      language: z.enum(["ar", "en"]),
      story_id: z.string().uuid().nullable().optional(),
      note: z.string().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("vocabulary")
      .upsert(
        {
          user_id: context.userId,
          word: data.word,
          translation: data.translation ?? null,
          language: data.language,
          story_id: data.story_id ?? null,
          note: data.note ?? null,
        },
        { onConflict: "user_id,word,language" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteVocabulary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vocabulary").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const translateWord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      word: z.string().trim().min(1).max(100),
      from: z.enum(["ar", "en"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash-lite");
    const target = data.from === "ar" ? "English" : "Arabic";
    const source = data.from === "ar" ? "Arabic" : "English";
    const { text } = await generateText({
      model,
      system: `You are a precise translator. Translate the given ${source} word to ${target}. Reply with ONLY the translation, no quotes, no explanation, max 6 words.`,
      prompt: data.word,
      maxOutputTokens: 60,
    });
    return { translation: text.trim().replace(/^["'`]+|["'`]+$/g, "") };
  });
