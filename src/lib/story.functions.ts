import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
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
  questions: z.array(QuestionSchema).min(4).max(6),
});

const InputSchema = z.object({
  topic: z.string().min(2).max(200),
  language: z.enum(["ar", "en"]),
  size: z.enum(["small", "medium", "large"]),
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
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const langName = data.language === "ar" ? "Arabic" : "English";
    const system = `You are a children's story writer. Generate a short, age-appropriate, engaging story for kids about the requested topic, in ${langName}. Return strictly valid JSON matching the schema. Story length: ${sizeWords[data.size]}. Include 5 comprehension questions: mix of mcq (3 options each), true_false, and fill_blank. For mcq the correctAnswer must EXACTLY match one of the options. For true_false the correctAnswer must be "true" or "false" (or "صح"/"خطأ" in Arabic). For fill_blank the correctAnswer is the single missing word. Provide a short kid-friendly explanation for each answer in the same language. The imagePrompt should be a vivid English description for an illustration of the main scene (no text, no words in the image).`;

    const { experimental_output } = await generateText({
      model,
      system,
      prompt: `Topic: ${data.topic}\nLanguage: ${langName}\nLength: ${data.size}\nGenerate the story now.`,
      experimental_output: Output.object({ schema: StorySchema }),
    });

    const story = experimental_output;

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

export const deleteStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("stories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
