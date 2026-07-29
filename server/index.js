import { createApp } from "./app.js";
import { createDatabase, DEMO_PASSWORD } from "./database.js";

const port = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === "production";
const db = createDatabase(process.env.DATABASE_PATH);
const app = createApp({ db, serveStatic: true, production });

const server = app.listen(port, () => {
    console.log(`SideQuest API listening at http://localhost:${port}`);
    if (!production) {
        console.log(`Demo password: ${DEMO_PASSWORD}`);
    }
});

function shutdown() {
    server.close(() => {
        db.close();
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
