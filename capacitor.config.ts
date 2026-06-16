import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.jbcom.blobolines",
  appName: "Blobolines",
  webDir: "dist",
  backgroundColor: "#0e1822",
  server: {
    androidScheme: "https",
  },
  plugins: {
    ScreenOrientation: {
      // Vertical climber — lock to portrait on device.
    },
  },
};

export default config;
