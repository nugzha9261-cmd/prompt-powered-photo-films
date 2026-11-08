// Loaded only from browser event handlers; no FFmpeg evaluation during SSR.
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";
import { editSections } from "./video-edit";

export async function createVideoProcessor() {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const ff = new FFmpeg();
  await ff.load({ coreURL, wasmURL });
  const read = async (name: string) => {
    const data = await ff.readFile(name);
    if (typeof data === "string") throw new Error("Could not read the processed video.");
    return new Blob([new Uint8Array(data).buffer], { type: "video/mp4" });
  };
  const exec = async (args: string[]) => {
    if (await ff.exec(args) !== 0) throw new Error("Could not process this video. Try a smaller MP4 clip.");
  };
  return {
    async split(file: Blob, seconds: number) {
      await ff.writeFile("source", new Uint8Array(await file.arrayBuffer()));
      const parts: { file: Blob; seconds: number }[] = [];
      for (const [i, section] of editSections(seconds).entries()) {
        const name = `part-${i}.mp4`;
        await exec(["-ss", String(section.start), "-i", "source", "-t", String(section.seconds),
          "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
          "-r", "30", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
          "-c:a", "aac", "-avoid_negative_ts", "make_zero", "-y", name]);
        parts.push({ file: await read(name), seconds: section.seconds });
        await ff.deleteFile(name);
      }
      await ff.deleteFile("source");
      return parts;
    },
    async join(files: Blob[]) {
      for (const [i, file] of files.entries()) {
        await ff.writeFile(`edited-${i}.mp4`, new Uint8Array(await file.arrayBuffer()));
      }
      await ff.writeFile("list.txt", files.map((_, i) => `file 'edited-${i}.mp4'`).join("\n"));
      await exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "-movflags", "+faststart", "-y", "joined.mp4"]);
      return read("joined.mp4");
    },
    close() { ff.terminate(); },
  };
}