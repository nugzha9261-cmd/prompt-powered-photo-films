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
    /** Adds music / voiceover, reshapes for social platforms and stamps the free-plan mark. */
    async finish(video: Blob, seconds: number, opts: {
      music?: Blob | undefined; voice?: Blob | undefined; width?: number | undefined; height?: number | undefined; watermark?: Blob | undefined;
    }) {
      await ff.writeFile("film.mp4", new Uint8Array(await video.arrayBuffer()));
      const inputs = ["-i", "film.mp4"];
      let n = 1;
      const idx: Record<string, number> = {};
      const add = async (key: string, blob: Blob | undefined, extra: string[] = []) => {
        if (!blob) return;
        await ff.writeFile(key, new Uint8Array(await blob.arrayBuffer()));
        inputs.push(...extra, "-i", key);
        idx[key] = n++;
      };
      await add("music.mp3", opts.music, ["-stream_loop", "-1"]);
      await add("voice.wav", opts.voice);
      await add("mark.png", opts.watermark);

      const v: string[] = [];
      let vin = "[0:v]";
      if (opts.width && opts.height) {
        const { width: w, height: h } = opts;
        v.push(`${vin}scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x0b0907,setsar=1[sz]`);
        vin = "[sz]";
      }
      if (idx["mark.png"] != null) {
        v.push(`[${idx["mark.png"]}:v]scale=-1:'max(28,ih*0.6)'[wm]`, `${vin}[wm]overlay=W-w-16:H-h-16[vo]`);
        vin = "[vo]";
      }
      const fade = `afade=t=out:st=${Math.max(0, seconds - 1.5)}:d=1.5`;
      const extras: string[] = [];
      const a: string[] = [];
      if (idx["music.mp3"] != null) { a.push(`[${idx["music.mp3"]}:a]volume=${opts.voice ? 0.25 : 0.45}[mu]`); extras.push("[mu]"); }
      if (idx["voice.wav"] != null) { a.push(`[${idx["voice.wav"]}:a]volume=1.6,apad[vc]`); extras.push("[vc]"); }

      const run = async (withOriginal: boolean) => {
        const srcs = withOriginal ? ["[0:a]", ...extras] : extras;
        const audio = srcs.length === 0 ? [] : srcs.length === 1
          ? [`${srcs[0]}${fade}[ao]`]
          : [`${srcs.join("")}amix=inputs=${srcs.length}:duration=longest:normalize=0,${fade}[ao]`];
        const graph = [...v, ...a, ...audio].join(";");
        const args = [...inputs];
        if (graph) args.push("-filter_complex", graph);
        args.push("-map", vin === "[0:v]" ? "0:v" : vin);
        if (audio.length) args.push("-map", "[ao]"); else if (withOriginal) args.push("-map", "0:a?");
        args.push(...(vin === "[0:v]" ? ["-c:v", "copy"] : ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "22"]),
          "-c:a", "aac", "-t", String(seconds), "-movflags", "+faststart", "-y", "final.mp4");
        return ff.exec(args);
      };
      if ((await run(true)) !== 0 && (await run(false)) !== 0) {
        throw new Error("Could not finish this video. Try again.");
      }
      return read("final.mp4");
    },
    /** Joins different films into one movie, normalising size, frame rate and sound. */
    async joinMovie(files: Blob[], width: number, height: number) {
      const names: string[] = [];
      for (const [i, file] of files.entries()) {
        await ff.writeFile(`in-${i}.mp4`, new Uint8Array(await file.arrayBuffer()));
        const out = `norm-${i}.mp4`;
        const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0b0907,setsar=1,fps=30`;
        const common = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-c:a", "aac", "-ar", "44100", "-ac", "2", "-shortest", "-y", out];
        // Films without sound get a silent track so every part joins cleanly.
        if (await ff.exec(["-i", `in-${i}.mp4`, "-vf", vf, "-map", "0:v", "-map", "0:a", ...common]) !== 0) {
          await exec(["-i", `in-${i}.mp4`, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-vf", vf, "-map", "0:v", "-map", "1:a", ...common]);
        }
        await ff.deleteFile(`in-${i}.mp4`);
        names.push(out);
      }
      await ff.writeFile("movie.txt", names.map((n) => `file '${n}'`).join("\n"));
      await exec(["-f", "concat", "-safe", "0", "-i", "movie.txt", "-c", "copy", "-movflags", "+faststart", "-y", "movie.mp4"]);
      return read("movie.mp4");
    },
    close() { ff.terminate(); },
  };
}