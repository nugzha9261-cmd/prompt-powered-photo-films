import type { CapacitorConfig } from "@capacitor/cli";

// The native apps load the live, published site so web updates reach phones without a store release.
// Change appId to your own reverse-domain id (e.g. com.nexonelabs.cineflow) BEFORE the first store upload;
// it can't be changed afterwards.
const config: CapacitorConfig = {
  appId: "com.nexonelabs.cineflow",
  appName: "CineFlow AI",
  webDir: "mobile-shell",
  backgroundColor: "#0b0907",
  server: {
    url: "https://prompt-powered-photo-films.lovable.app",
    cleartext: false,
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#0b0907",
  },
  android: {
    backgroundColor: "#0b0907",
  },
};

export default config;
