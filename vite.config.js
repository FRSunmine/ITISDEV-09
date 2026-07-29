import { defineConfig } from "vite";
import { resolve } from "node:path";

const pages = [
  "login",
  "student-verification",
  "student-dashboard",
  "student-applications",
  "student-messages",
  "quest-marketplace",
  "student-quest-workspace",
  "student-profile",
  "student-settings",
  "student-report",
  "client-dashboard",
  "client-messages",
  "client-organization-profile",
  "client-settings",
  "client-report",
  "create-quest",
  "applicant-selection",
  "client-quest-workspace",
  "admin-operations",
  "admin-settings",
  "platform-analytics",
  "account-profile",
];

export default defineConfig({
  server: {
    fs: {
      deny: ["data/**", "server/**", "tests/**"],
    },
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
  build: {
    rollupOptions: {
      input: Object.fromEntries([
        ["index", resolve(import.meta.dirname, "index.html")],
        ...pages.map((page) => [page, resolve(import.meta.dirname, `pages/${page}.html`)]),
      ]),
    },
  },
});
