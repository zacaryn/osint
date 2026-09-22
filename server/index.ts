import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app.ts";

const PORT = Number(process.env.PORT ?? 8787);
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");

app.use(express.static(dist));
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(dist, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`OSINT Watch listening on port ${PORT} (API + static UI when dist/ is present)`);
});
