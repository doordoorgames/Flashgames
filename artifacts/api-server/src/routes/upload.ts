import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";

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
    const items: string[] = [];
    for (const row of rows) {
      if (Array.isArray(row) && row[0] !== undefined && row[0] !== "") {
        items.push(String(row[0]).trim());
      }
    }
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: "Failed to parse Excel file" });
  }
});

router.post("/api/upload/image", upload.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const url = `/api/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
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
