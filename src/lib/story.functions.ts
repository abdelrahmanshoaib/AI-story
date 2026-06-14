import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveAiProvider } from "@/lib/ai-provider.server";
import { generateText, Output } from "ai";
import { z } from "zod";

const QuestionSchema = z.object({
  type: z.enum(["mcq", "true_false", "fill_blank"]),
  question: z.string(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string(),
  explanation: z.string().optional(),
});

const StorySchema = z.object({
  title: z.string(),
  story: z.string(),
  imagePrompt: z.string(),
  questions: z.array(QuestionSchema).min(3).max(8),
});

const InputSchema = z.object({
  topic: z.string().min(2).max(200),
  language: z.enum(["ar", "en"]),
  size: z.enum(["small", "medium", "large"]),
  ageOverride: z.number().int().min(3).max(14).optional(),
});

const sizeWords: Record<string, string> = {
  small: "around 60 words",
  medium: "around 130 words",
  large: "around 230 words",
};

export const generateStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { model, lovableKey } = await resolveAiProvider();
    const apiKey = lovableKey;

    const langName = data.language === "ar" ? "Arabic" : "English";

    // Personalize with profile prefs (age + language level)
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("age, arabic_level, english_level")
      .eq("user_id", context.userId)
      .maybeSingle();
    const age = data.ageOverride ?? profile?.age ?? 8;
    const level = data.language === "ar" ? (profile?.arabic_level ?? "beginner") : (profile?.english_level ?? "beginner");
    const levelHint = level === "beginner" ? "very simple vocabulary, short sentences" : level === "intermediate" ? "moderate vocabulary, varied sentence structure" : "rich vocabulary, descriptive language";

    const safetyRules = `STRICT CONTENT RULES (MUST FOLLOW):\n- 100% safe and appropriate for a ${age}-year-old child.\n- Respect Islamic and Arabic culture and values at all times.\n- Never include violence, fear, horror, romance, magic that contradicts Islam, alcohol, music idolization, or any inappropriate content.\n- Never depict or name Prophets in the image prompt; for prophet stories, describe scenery/symbols only (desert, palm trees, a cave, a ship, etc.) with NO human faces of prophets.\n- Always include a clear moral or educational value.\n- End the story with a positive, happy ending AND a short encouraging line for the child${data.language === "ar" ? ' such as: "بارك الله فيك يا بطل", "ما شاء الله عليك", "العلم نور يا بطل", "المسلم الذكي يحب التعلم".' : "."}`;

    const system = `You are an expert children's educator and storyteller for Muslim Arab kids. Write a short, engaging, age-appropriate story about the requested topic in ${langName} for a ${age}-year-old. Use ${levelHint}. Story length: ${sizeWords[data.size]}. The story MUST include: an attractive title, a fun intro, simple narration, one interesting fact or piece of useful information, a clear moral value, a positive happy ending, and a short encouraging sentence to the child at the very end of the story text.\n\n${safetyRules}\n\nReturn strictly valid JSON matching the schema. Include 4 to 6 comprehension questions: mix of mcq (with an "options" array of 3 strings), true_false (no options), and fill_blank (no options). For mcq the correctAnswer must EXACTLY match one of the options. For true_false the correctAnswer must be "true" or "false" (or "صح"/"خطأ" in Arabic). For fill_blank the correctAnswer is the single missing word. Always include a short kid-friendly "explanation" for each question in the same language. The imagePrompt must be a vivid English description for a colorful child-safe cartoon illustration of the main scene (no text, no words, no scary elements, no faces of prophets).`;

    async function tryGenerate() {
      const { experimental_output } = await generateText({
        model,
        system,
        prompt: `Topic: ${data.topic}\nLanguage: ${langName}\nLength: ${data.size}\nReturn ONLY a single JSON object, no prose, no markdown.`,
        experimental_output: Output.object({ schema: StorySchema }),
        maxOutputTokens: 4096,
      });
      return experimental_output;
    }

    async function fallbackGenerate() {
      // Plain text generation + manual JSON parse as a safety net
      const { text } = await generateText({
        model,
        system: system + `\nReturn ONLY valid JSON, no markdown fences, no commentary.`,
        prompt: `Topic: ${data.topic}\nLanguage: ${langName}\nLength: ${data.size}\nJSON shape: {"title":string,"story":string,"imagePrompt":string,"questions":[{"type":"mcq"|"true_false"|"fill_blank","question":string,"options"?:string[],"correctAnswer":string,"explanation":string}]}`,
        maxOutputTokens: 4096,
      });
      const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("AI returned no JSON");
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return StorySchema.parse(parsed);
    }

    let story: z.infer<typeof StorySchema>;
    try {
      story = await tryGenerate();
    } catch (e) {
      console.error("structured generation failed, retrying with fallback", e);
      try {
        story = await fallbackGenerate();
      } catch (e2) {
        console.error("fallback also failed", e2);
        throw new Error(
          data.language === "ar"
            ? "تعذر إنشاء القصة، حاول مرة أخرى أو غيّر الموضوع"
            : "Could not generate the story, please try again or change the topic"
        );
      }
    }

    // Generate image via gateway (raw call)
    let imageUrl: string | null = null;
    try {
      const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "vercel-ai-sdk",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: `Create a colorful, friendly cartoon illustration in a children's storybook style. Bright, warm colors. No text, no letters, no words anywhere in the image. Subject: ${story.imagePrompt}`,
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (imgRes.ok) {
        const imgJson = await imgRes.json();
        const images = imgJson?.choices?.[0]?.message?.images;
        const b64 =
          images?.[0]?.image_url?.url ??
          images?.[0]?.image_url ??
          imgJson?.choices?.[0]?.message?.content?.[0]?.image_url?.url;

        if (b64 && typeof b64 === "string") {
          // strip data URL prefix
          const match = b64.match(/^data:(image\/[a-z]+);base64,(.+)$/);
          const mime = match ? match[1] : "image/png";
          const base64Data = match ? match[2] : b64;
          const buf = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
          const ext = mime.split("/")[1] || "png";
          const path = `${context.userId}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabaseAdmin.storage
            .from("story-images")
            .upload(path, buf, { contentType: mime, upsert: false });
          if (!upErr) {
            const { data: pub } = supabaseAdmin.storage
              .from("story-images")
              .getPublicUrl(path);
            imageUrl = pub.publicUrl;
          } else {
            console.error("upload error", upErr);
          }
        }
      } else {
        console.error("image gen failed", imgRes.status, await imgRes.text());
      }
    } catch (e) {
      console.error("image gen exception", e);
    }

    const { data: row, error } = await context.supabase
      .from("stories")
      .insert({
        user_id: context.userId,
        title: story.title,
        language: data.language,
        size: data.size,
        topic: data.topic,
        story_text: story.story,
        image_url: imageUrl,
        questions: story.questions as unknown as never,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listStories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("stories")
      .select("id, title, topic, language, size, image_url, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data;
  });

export const getStory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("stories")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    return row;
  });

export const generateColoringPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const { data: row, error } = await context.supabase
      .from("stories")
      .select("title, topic, story_text")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");

    const prompt = `Black and white coloring book page for kids. Pure clean line art only: bold black outlines on a pure white background. No shading, no gray tones, no fill colors, no text, no letters. Large simple shapes suitable for a child to color. Subject: ${row.title} — ${row.topic}. Scene from this story (illustrate the main moment): ${row.story_text.slice(0, 400)}`;

    const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!imgRes.ok) {
      throw new Error("فشل توليد صفحة التلوين، حاول مرة أخرى");
    }
    const imgJson = await imgRes.json();
    const images = imgJson?.choices?.[0]?.message?.images;
    const b64 =
      images?.[0]?.image_url?.url ??
      images?.[0]?.image_url ??
      imgJson?.choices?.[0]?.message?.content?.[0]?.image_url?.url;
    if (!b64 || typeof b64 !== "string") throw new Error("لم يتم استلام الصورة");
    const dataUrl = b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
    return { dataUrl, title: row.title };
  });

export const deleteStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("stories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
