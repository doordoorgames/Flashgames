import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "..", "data");
const storeFile = path.join(dataDir, "yesno-questions.json");

function ensureDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function loadFromDisk(): string[] {
  try {
    ensureDir();
    if (fs.existsSync(storeFile)) {
      const raw = fs.readFileSync(storeFile, "utf8");
      return JSON.parse(raw) as string[];
    }
  } catch {}
  return [];
}

function saveToDisk(): void {
  try {
    ensureDir();
    fs.writeFileSync(storeFile, JSON.stringify(questions, null, 2));
  } catch {}
}

let questions: string[] = loadFromDisk();

export function getYesNoQuestions(): string[] {
  return questions;
}

export function setYesNoQuestions(q: string[]): void {
  questions = q;
  saveToDisk();
}

export function addYesNoQuestions(q: string[]): void {
  questions.push(...q);
  saveToDisk();
}

export function clearYesNoQuestions(): void {
  questions = [];
  saveToDisk();
}
