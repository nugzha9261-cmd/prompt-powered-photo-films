import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deleteAccountSchema, eraseAccount } from "./account-cleanup";

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteAccountSchema.parse(input))
  .handler(async ({ context }) => {
    // Self-deletion only: identity comes exclusively from verified auth middleware.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bucket = supabaseAdmin.storage.from("videos");
    try {
      await eraseAccount(context.userId, {
        list: async (prefix, offset) => {
          const { data, error } = await bucket.list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
          if (error) throw error;
          return (data ?? []).map((entry) => ({ name: entry.name, id: entry.id ?? null }));
        },
        remove: async (paths) => {
          const { error } = await bucket.remove(paths);
          if (error) throw error;
        },
        deleteVideos: async (userId) => {
          const { error } = await supabaseAdmin.from("videos").delete().eq("user_id", userId);
          if (error) throw error;
        },
        deleteCredits: async (userId) => {
          const { error } = await supabaseAdmin.from("user_credits").delete().eq("user_id", userId);
          if (error) throw error;
        },
        deleteIdentity: async (userId) => {
          const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (error) throw error;
        },
      });
      return { ok: true as const };
    } catch (error) {
      console.error("Account deletion failed", error);
      return { ok: false as const, error: "Deletion did not finish. Some data may already be removed. Please retry or contact support." };
    }
  });