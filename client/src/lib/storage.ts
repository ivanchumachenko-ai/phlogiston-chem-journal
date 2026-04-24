import { ReagentEntry, SynthesisDetails } from "./export";
import { v4 as uuidv4 } from "uuid";

export interface SavedSynthesis {
  id: string;
  createdAt: number;
  updatedAt: number;
  entries: ReagentEntry[];
  details: SynthesisDetails;
}

export interface InventoryItem {
  name: string;
  formula: string;
  cas: string;
  concentration: string;
  location: string;
  amount: number | string;
  unit: string;
  notes: string;
}

export interface CustomReagent {
  id: string;
  shortcut: string;
  name: string;
  formula: string;
  smiles?: string;
  molfile?: string;
  density?: number;
  mp?: number;
  bp?: number;
}

const STORAGE_KEY = "chemcalc_saved_syntheses";
const INVENTORY_KEY = "chemcalc_inventory";
const CUSTOM_REAGENTS_KEY = "chemcalc_custom_reagents";
const GSHEETS_URL_KEY = "chemcalc_gsheets_url";

export function getSavedSyntheses(): SavedSynthesis[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as SavedSynthesis[];
  } catch (e) {
    console.error("Failed to load saved syntheses", e);
    return [];
  }
}

export function saveSynthesis(
  entries: ReagentEntry[],
  details: SynthesisDetails,
  id?: string
): string {
  const syntheses = getSavedSyntheses();
  const now = Date.now();
  
  if (id) {
    // Update existing
    const index = syntheses.findIndex(s => s.id === id);
    if (index >= 0) {
      syntheses[index] = {
        ...syntheses[index],
        entries,
        details,
        updatedAt: now
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(syntheses));
      } catch (e) {
        console.error("Storage quota exceeded", e);
        alert("Error: Not enough space in browser storage. Please delete old syntheses.");
      }
      return id;
    }
  }
  
  // Create new
  const newId = uuidv4();
  const newSynthesis: SavedSynthesis = {
    id: newId,
    createdAt: now,
    updatedAt: now,
    entries,
    details
  };
  
  syntheses.push(newSynthesis);
  // Sort by newest first
  syntheses.sort((a, b) => b.updatedAt - a.updatedAt);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(syntheses));
  } catch (e) {
    console.error("Storage quota exceeded", e);
    alert("Error: Not enough space in browser storage. Please delete old syntheses.");
  }
  return newId;
}

export function deleteSynthesis(id: string): void {
  const syntheses = getSavedSyntheses();
  const filtered = syntheses.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function getInventory(): InventoryItem[] {
  try {
    const data = localStorage.getItem(INVENTORY_KEY);
    if (!data) return [];
    return JSON.parse(data) as InventoryItem[];
  } catch (e) {
    console.error("Failed to load inventory", e);
    return [];
  }
}

export function saveInventory(items: InventoryItem[]): void {
  try {
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Storage quota exceeded", e);
    alert("Error: Database is too large. Not enough space in browser storage (limit ~5 MB).");
  }
}

export function getGSheetsUrl(): string {
  return localStorage.getItem(GSHEETS_URL_KEY) || "";
}

export function saveGSheetsUrl(url: string): void {
  localStorage.setItem(GSHEETS_URL_KEY, url);
}

export function getCustomReagents(): CustomReagent[] {
  try {
    const data = localStorage.getItem(CUSTOM_REAGENTS_KEY);
    if (!data) return [];
    return JSON.parse(data) as CustomReagent[];
  } catch (e) {
    console.error("Failed to load custom reagents", e);
    return [];
  }
}

export function saveCustomReagent(reagent: Omit<CustomReagent, "id">, id?: string): void {
  const reagents = getCustomReagents();
  if (id) {
    const index = reagents.findIndex(r => r.id === id);
    if (index >= 0) {
      reagents[index] = { ...reagent, id };
      try {
        localStorage.setItem(CUSTOM_REAGENTS_KEY, JSON.stringify(reagents));
      } catch (e) {
        console.error("Storage quota exceeded", e);
        alert("Error: Not enough space in browser storage.");
      }
      return;
    }
  }
  
  const newReagent: CustomReagent = { ...reagent, id: uuidv4() };
  reagents.push(newReagent);
  try {
    localStorage.setItem(CUSTOM_REAGENTS_KEY, JSON.stringify(reagents));
  } catch (e) {
    console.error("Storage quota exceeded", e);
    alert("Ошибка: Недостаточно места в памяти браузера.");
  }
}

export function deleteCustomReagent(id: string): void {
  const reagents = getCustomReagents();
  const filtered = reagents.filter(r => r.id !== id);
  localStorage.setItem(CUSTOM_REAGENTS_KEY, JSON.stringify(filtered));
}
