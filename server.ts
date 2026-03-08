import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("safeloop.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    picture TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    type TEXT,
    description TEXT,
    latitude REAL,
    longitude REAL,
    image_url TEXT,
    is_ai_generated INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Auth Mock/Simple for demo (Real OAuth would be here)
  app.post("/api/auth/login", (req, res) => {
    const { id, email, name, picture } = req.body;
    const stmt = db.prepare("INSERT OR REPLACE INTO users (id, email, name, picture) VALUES (?, ?, ?, ?)");
    stmt.run(id, email, name, picture);
    res.json({ success: true });
  });

  app.get("/api/reports", (req, res) => {
    const reports = db.prepare("SELECT reports.*, users.name as user_name FROM reports JOIN users ON reports.user_id = users.id ORDER BY created_at DESC").all();
    res.json(reports);
  });

  app.post("/api/reports", (req, res) => {
    const { user_id, type, description, latitude, longitude, image_url, is_ai_generated } = req.body;
    const stmt = db.prepare(`
      INSERT INTO reports (user_id, type, description, latitude, longitude, image_url, is_ai_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(user_id, type, description, latitude, longitude, image_url, is_ai_generated ? 1 : 0);
    res.json({ success: true, id: info.lastInsertRowid });
  });

  app.get("/api/stats", (req, res) => {
    const total = db.prepare("SELECT COUNT(*) as count FROM reports").get();
    const byType = db.prepare("SELECT type, COUNT(*) as count FROM reports GROUP BY type").all();
    res.json({ total: total.count, byType });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
