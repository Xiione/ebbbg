import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const fullReloadAlways = {
  name: "Full reload on HMR",
  handleHotUpdate({ server }: any) {
    server.ws.send({ type: "full-reload" });
    return [];
  },
};

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), fullReloadAlways],
  server: {
    allowedHosts: ["irunlosethos.tail1152b.ts.net"],
  },
});
