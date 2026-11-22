import type { CapacitorConfig } from "@capacitor/cli";

// The native apps load the live, published site so web updates reach phones without a store release.
// Keep the bundle identifier stable after the first store upload.
const config: CapacitorConfig = {
  appId: "com.nexonelabs.cineflow",
  appName: "CineFlow AI",
  webDir: "mobile-shell",
  backgroundColor: "#0b0907",
  server: {
    url: "https://cineflow.adsai.studio",
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
