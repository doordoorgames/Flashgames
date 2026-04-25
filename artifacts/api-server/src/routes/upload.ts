import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import {
  getAdminItems,
  setAdminItems,
  addAdminItem,
  removeAdminItem,
  reorderAdminItems,
  clearAdminItems,
} from "../game/adminStore.js";
import type { GameItem } from "../game/gameState.js";

const router = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.get("/api/admin/items", (_req, res) => {
  res.json({ items: getAdminItems() });
});

router.post("/api/admin/items/clear", (_req, res) => {
  clearAdminItems();
  res.json({ ok: true });
});

router.post("/api/admin/items/remove", (req, res) => {
  const { index } = req.body as { index: number };
  removeAdminItem(index);
  res.json({ items: getAdminItems() });
});

router.post("/api/admin/items/reorder", (req, res) => {
  const { fromIndex, toIndex } = req.body as { fromIndex: number; toIndex: number };
  reorderAdminItems(fromIndex, toIndex);
  res.json({ items: getAdminItems() });
});

router.post("/api/upload/excel", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    for (const row of rows) {
      if (Array.isArray(row) && row[0] !== undefined && String(row[0]).trim() !== "") {
        const val = String(row[0]).trim();
        const item: GameItem = {
          type: "text",
          prompt: val,
          correctAnswer: val,
          acceptedAnswers: [],
          flashDurationMs: 600,
        };
        addAdminItem(item);
      }
    }

    res.json({ items: getAdminItems() });
  } catch {
    res.status(500).json({ error: "Failed to parse Excel file" });
  }
});

router.post("/api/upload/image", upload.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const url = `/api/uploads/${req.file.filename}`;
  const label = (req.body as { label?: string }).label || req.file.originalname.replace(/\.[^.]+$/, "");

  const item: GameItem = {
    type: "image",
    prompt: label,
    mediaUrl: url,
    correctAnswer: label,
    acceptedAnswers: [],
    flashDurationMs: 600,
  };
  addAdminItem(item);

  res.json({ url, filename: req.file.filename, item, items: getAdminItems() });
});

router.post("/api/admin/items/label", (req, res) => {
  const { index, label, acceptedAnswers } = req.body as {
    index: number;
    label: string;
    acceptedAnswers?: string[];
  };
  const items = getAdminItems();
  if (index >= 0 && index < items.length) {
    items[index].prompt = label;
    items[index].correctAnswer = label;
    if (acceptedAnswers) items[index].acceptedAnswers = acceptedAnswers;
    setAdminItems(items);
  }
  res.json({ items: getAdminItems() });
});

router.get("/api/uploads/:filename", (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.sendFile(filepath);
});

export default router;
