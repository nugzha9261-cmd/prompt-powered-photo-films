export type MusicTrack = { id: string; label: string; src: string };

/** Simple royalty-free background tracks bundled with the app (30 s each, looped to fit). */
export const MUSIC_TRACKS: MusicTrack[] = [
  { id: "piano", label: "Cinematic piano", src: "/music/piano.mp3" },
  { id: "ambient", label: "Ambient darkroom", src: "/music/ambient.mp3" },
  { id: "synth", label: "Upbeat synth", src: "/music/synth.mp3" },
  { id: "lofi", label: "Lo-fi nostalgia", src: "/music/lofi.mp3" },
];
