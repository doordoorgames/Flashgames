import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { GameItem } from "./gameState.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "..", "data");
const storeFile = path.join(dataDir, "admin-items.json");

function ensureDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function loadFromDisk(): GameItem[] {
  try {
    ensureDir();
    if (fs.existsSync(storeFile)) {
      const raw = fs.readFileSync(storeFile, "utf8");
      return JSON.parse(raw) as GameItem[];
    }
  } catch {}
  return [];
}

function saveToDisk(): void {
  try {
    ensureDir();
    fs.writeFileSync(storeFile, JSON.stringify(storedItems, null, 2));
  } catch {}
}

let storedItems: GameItem[] = loadFromDisk();

export function getAdminItems(): GameItem[] {
  return storedItems;
}

export function setAdminItems(items: GameItem[]): void {
  storedItems = items;
  saveToDisk();
}

export function addAdminItem(item: GameItem): void {
  storedItems.push(item);
  saveToDisk();
}

export function removeAdminItem(index: number): void {
  storedItems.splice(index, 1);
  saveToDisk();
}

export function clearAdminItems(): void {
  storedItems = [];
  saveToDisk();
}

export function reorderAdminItems(fromIndex: number, toIndex: number): void {
  if (
    fromIndex < 0 ||
    fromIndex >= storedItems.length ||
    toIndex < 0 ||
    toIndex >= storedItems.length
  )
    return;
  const [item] = storedItems.splice(fromIndex, 1);
  storedItems.splice(toIndex, 0, item);
  saveToDisk();
}
