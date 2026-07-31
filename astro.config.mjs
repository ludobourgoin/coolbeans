// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import clerk from "@clerk/astro";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  integrations: [clerk(), mdx()],
  adapter: node({ mode: "standalone" }),
  markdown: {
    shikiConfig: { theme: "github-dark" },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
