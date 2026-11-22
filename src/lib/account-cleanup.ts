import { z } from "zod";

export const deleteAccountSchema = z.object({ confirmation: z.literal("DELETE") }).strict();

type StoredEntry = { name: string; id: string | null };
export type AccountCleanup = {
  list: (prefix: string, offset: number) => Promise<StoredEntry[]>;
  remove: (paths: string[]) => Promise<void>;
  deleteVideos: (userId: string) => Promise<void>;
  deleteCredits: (userId: string) => Promise<void>;
  deleteIdentity: (userId: string) => Promise<void>;
};

/** Only the authenticated user's UUID is accepted, never a client-supplied path. */
export async function eraseAccount(userId: string, ops: AccountCleanup) {
  z.string().uuid().parse(userId);
  async function eraseFolder(prefix: string) {
    const files: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const entries = await ops.list(prefix, offset);
      for (const entry of entries) {
        if (!entry.name || entry.name.includes("/") || entry.name === "." || entry.name === "..") {
          throw new Error("Invalid stored file path");
        }
        const path = `${prefix}/${entry.name}`;
        if (entry.id === null) await eraseFolder(path);
        else files.push(path);
      }
      if (entries.length < 100) break;
    }
    for (let i = 0; i < files.length; i += 100) await ops.remove(files.slice(i, i + 100));
  }
  await eraseFolder(userId);
  await ops.deleteVideos(userId);
  await ops.deleteCredits(userId);
  // Retain the identity on cleanup errors so the user can retry.
  await ops.deleteIdentity(userId);
}