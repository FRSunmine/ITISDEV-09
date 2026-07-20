import { defineConfig } from "vite";
import { resolve } from "node:path";

const pages = [
  "login",
  "student-verification",
  "student-dashboard",
  "quest-marketplace",
  "student-quest-workspace",
  "student-profile",
  "client-dashboard",
  "create-quest",
  "applicant-selection",
  "client-quest-workspace",
  "admin-operations",
  "platform-analytics",
];

export default defineConfig({
  build: {
    rollupOptions: {
      input: Object.fromEntries([
        ["index", resolve(import.meta.dirname, "index.html")],
        ...pages.map((page) => [page, resolve(import.meta.dirname, `pages/${page}.html`)]),
      ]),
    },
  },
});
