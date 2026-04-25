import type { GameItem } from "./gameState.js";

let storedItems: GameItem[] = [];

export function getAdminItems(): GameItem[] {
  return storedItems;
}

export function setAdminItems(items: GameItem[]): void {
  storedItems = items;
}

export function addAdminItem(item: GameItem): void {
  storedItems.push(item);
}

export function removeAdminItem(index: number): void {
  storedItems.splice(index, 1);
}

export function clearAdminItems(): void {
  storedItems = [];
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
}
