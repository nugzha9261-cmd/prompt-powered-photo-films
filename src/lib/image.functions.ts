import { createServerFn } from "@tanstack/react-start";
import { editImage, generateImage, GatewayError } from "@lovable.dev/ai-gateway";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OUT_OF_CREDITS } from "./credits";
import { CREDITS_PER_IMAGE_RUN, IMAGES_PER_RUN, IMAGE_SHAPES, buildImagePrompt, generateImagesSchema } from "./image-lab";

function base64ToBlob(b64: string, type: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return new Blob([out], { type });
}

export const generateImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => generateImagesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: spent, error } = await supabaseAdmin.rpc("spend_credits", { _user_id: context.userId, _amount: CREDITS_PER_IMAGE_RUN });
    if (error) return { ok: false as const, error: "Could not check your credits. Please try again." };
    if (spent === null) return { ok: false as const, error: "You're out of credits. Get more to keep creating.", code: OUT_OF_CREDITS };

    const common = {
      model: "openai/gpt-image-2.5-sunburst" as const,
      prompt: buildImagePrompt(data.prompt, data.style, Boolean(data.source)),
      n: IMAGES_PER_RUN,
      size: IMAGE_SHAPES[data.shape].size,
      quality: "medium" as const,
      output_format: "jpeg" as const,
      output_compression: 85,
    };
    try {
      const res = data.source
        ? await editImage({ ...common, image: base64ToBlob(data.source, "image/jpeg") })
        : await generateImage(common);
      const images = (res.data ?? []).map((d) => d.b64_json).filter((b): b is string => Boolean(b));
      if (!images.length) throw new Error("No images returned");
      return { ok: true as const, images };
    } catch (e) {
      console.error("Image generation failed", e);
      await supabaseAdmin.rpc("add_credits", { _user_id: context.userId, _amount: CREDITS_PER_IMAGE_RUN });
      const msg = e instanceof GatewayError && e.httpStatus === 429
        ? "Too many images are being made right now. Try again in a minute."
        : e instanceof GatewayError && e.httpStatus === 400
          ? "That request couldn't be drawn. Try different wording."
          : "The images couldn't be made. Your credit was returned.";
      return { ok: false as const, error: msg };
    }
  });
