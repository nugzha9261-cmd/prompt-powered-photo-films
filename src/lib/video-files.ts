import { supabase } from "@/integrations/supabase/client";

const BUCKET = "videos";
const ONE_HOUR = 60 * 60;

/** Short-lived private links for a user's own files (RLS limits them to their folder). */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, ONE_HOUR);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}

export async function downloadVideo(path: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, ONE_HOUR, { download: "cineflow-video.mp4" });
  if (error || !data) throw error ?? new Error("Download link failed");
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function deleteVideo(video: {
  id: string;
  storage_path: string | null;
  poster_path: string | null;
}) {
  const paths = [video.storage_path, video.poster_path].filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from("videos").delete().eq("id", video.id);
  if (error) throw error;
}
