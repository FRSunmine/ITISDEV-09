import { spawn } from "node:child_process";

const children = [
    spawn(process.execPath, ["--watch", "server/index.js"], { stdio: "inherit" }),
    spawn(process.execPath, ["node_modules/vite/bin/vite.js"], { stdio: "inherit" }),
];

let stopping = false;
function stop(exitCode = 0) {
    if (stopping) return;
    stopping = true;
    children.forEach((child) => child.kill());
    process.exit(exitCode);
}

children.forEach((child) => {
    child.on("exit", (code) => {
        if (!stopping && code) stop(code);
    });
});

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
