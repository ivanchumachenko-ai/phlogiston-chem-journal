import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wand2, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { ReagentEntry } from "@/lib/export";
import { getInventory } from "@/lib/storage";
import { parseWithFreeAI } from "@/lib/ai";
import { get_properties_async } from "@/lib/chemistry";

interface SmartPasteModalProps {
  onAddEntries: (entries: ReagentEntry[]) => void;
}

export function SmartPasteModal({ onAddEntries }: SmartPasteModalProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Fallback to local parsing if AI fails or user chooses it
  const parseTextLocal = async () => {
    try {
      setIsAiLoading(true);
      const inventory = getInventory();
      const entries: ReagentEntry[] = [];
      const foundReagents: string[] = [];

      // Regex 1: "Name (Amount Unit, Moles mmol)" -> "benzyl bromide (1.71 g, 10.0 mmol)"
      const regexSolid = /([a-zA-Z0-9\-\(\)\s\,\.]+?)\s*\(\s*([\d\.]+)\s*(g|mg|kg|mL|L|μL),\s*([\d\.]+)\s*(mmol|mol)\s*\)/gi;
      
      // Regex 2: "Name (Amount Unit)" -> "DMF (20 mL)"
      const regexSolvent = /([a-zA-Z0-9\-\(\)\s\,\.]+?)\s*\(\s*([\d\.]+)\s*(mL|L|μL)\s*\)/gi;

      // Helper to extract clean chemical name from a long regex match
      const extractName = (rawName: string) => {
        // Split by common English/Russian prepositions used in experimental procedures
        const parts = rawName.split(/\b(?:of|in|and|with|to|from|using|из|в|с|к|и)\b/i);
        let name = parts[parts.length - 1].trim();
        // Remove trailing commas, colons or spaces
        name = name.replace(/^[\s,:]+|[\s,:]+$/g, '');
        // If the name is too short (just "a" or something), fallback to the whole thing (unlikely)
        return name.length > 1 ? name : rawName.trim();
      };

      let match;
      while ((match = regexSolid.exec(text)) !== null) {
        const rawName = match[1].trim();
        const name = extractName(rawName);
        const amount = parseFloat(match[2]);
        const unitStr = match[3].toLowerCase();
        const moles = parseFloat(match[4]);
        const molesUnitStr = match[5].toLowerCase();
        
        if (foundReagents.includes(name.toLowerCase())) continue;
        foundReagents.push(name.toLowerCase());

        let massUnit: "mg" | "g" = "mg";
        let finalMass = amount;
        
        if (unitStr === 'g') {
          massUnit = "g";
        } else if (unitStr === 'kg') {
          massUnit = "g";
          finalMass = amount * 1000;
        }

        const properties = await get_properties_async(name) || undefined;
        
        // STRICT FILTER: Only accept if we found properties with formula or structure
        if (!properties?.formula && !properties?.cid && !properties?.smiles) {
          continue; // Skip this match completely, it's probably garbage
        }
        
        const entry: ReagentEntry = {
          id: crypto.randomUUID(),
          nameOrFormula: name,
          molarMass: properties?.mw || 0,
          mass: finalMass,
          massUnit: massUnit,
          moles: moles,
          molesUnit: molesUnitStr === 'mol' ? 'mol' : 'mmol',
          isReference: false,
          properties: properties || null,
          molfile: properties?.molfile,
          structureSource: properties?.cid ? "pubchem" : properties?.smiles ? "local-smiles" : undefined
        };

        const invItem = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (invItem) {
          if (invItem.formula && !properties?.formula) entry.nameOrFormula = `${name} (${invItem.formula})`;
        } else if (!properties?.mw) {
          // Approximate molar mass from mass/moles
          if (finalMass && moles) {
            let massInG = massUnit === 'g' ? finalMass : finalMass / 1000;
            let molesInMol = entry.molesUnit === 'mol' ? moles : moles / 1000;
            entry.molarMass = massInG / molesInMol;
          }
        }

        entries.push(entry);
      }

      regexSolvent.lastIndex = 0;
      while ((match = regexSolvent.exec(text)) !== null) {
        const rawName = match[1].trim();
        const name = extractName(rawName);
        const amount = parseFloat(match[2]);
        const unitStr = match[3].toLowerCase();

        if (foundReagents.includes(name.toLowerCase())) continue;
        foundReagents.push(name.toLowerCase());

        let volUnit: "uL" | "mL" = "mL";
        let finalVol = amount;
        
        if (unitStr === 'μl' || unitStr === 'ul') {
          volUnit = "uL";
        } else if (unitStr === 'l') {
          volUnit = "mL";
          finalVol = amount * 1000;
        }

        const properties = await get_properties_async(name) || undefined;

        // STRICT FILTER: Only accept if we found properties with formula or structure
        if (!properties?.formula && !properties?.cid && !properties?.smiles) {
          continue; // Skip this match completely
        }

        const entry: ReagentEntry = {
          id: crypto.randomUUID(),
          nameOrFormula: name,
          molarMass: properties?.mw || 0,
          volume: finalVol,
          massUnit: "mg",
          molesUnit: "mmol",
          isReference: false,
          density: properties?.density,
          properties: properties || null,
          molfile: properties?.molfile,
          structureSource: properties?.cid ? "pubchem" : properties?.smiles ? "local-smiles" : undefined
        };

        const invItem = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (invItem) {
          if (invItem.formula && !properties?.formula) entry.nameOrFormula = `${name} (${invItem.formula})`;
          if (invItem.density && !properties?.density) entry.density = parseFloat(invItem.density);
        }

        entries.push(entry);
      }

      if (entries.length === 0) {
        setError("Не удалось распознать вещества. Убедитесь, что текст содержит формат: 'Название (1.5 g, 10 mmol)' или 'Растворитель (20 mL)'.");
        setIsAiLoading(false);
        return;
      }

      onAddEntries(entries);
      setOpen(false);
      setText("");
      setError("");
    } catch (e: any) {
      setError(e.message || "Ошибка локального распознавания");
    } finally {
      setIsAiLoading(false);
    }
  };

  const parseTextAI = async () => {
    if (!text.trim()) return;
    
    setIsAiLoading(true);
    setError("");
    
    try {
      const aiChemicals = await parseWithFreeAI(text);
      
      if (!aiChemicals || aiChemicals.length === 0) {
        // Fallback to local parsing
        parseTextLocal();
        setIsAiLoading(false);
        return;
      }
      
      const inventory = getInventory();
      
      const validAiChemicals = aiChemicals.filter((chem: any) => chem && chem.name && typeof chem.name === 'string');
      
      const parsedEntries = await Promise.all(validAiChemicals.map(async (chem: any) => {
        const name = String(chem.name || "Unknown");
        
        let massUnit: "mg" | "g" = "mg";
        if (chem.massUnit === 'g') massUnit = 'g';
        
        let volUnit: "uL" | "mL" = "mL";
        if (chem.volumeUnit === 'uL') volUnit = 'uL';
        
        let molesUnit: "mmol" | "mol" = "mmol";
        if (chem.molesUnit === 'mol') molesUnit = 'mol';

        const properties = await get_properties_async(name) || undefined;
        
        // STRICT FILTER: Only accept if we found properties with formula or structure
        if (!properties?.formula && !properties?.cid && !properties?.smiles) {
          return null; // Return null so we can filter it out later
        }
        
        const entry: ReagentEntry = {
          id: crypto.randomUUID(),
          nameOrFormula: name,
          molarMass: properties?.mw || 0,
          mass: typeof chem.mass === 'number' ? chem.mass : undefined,
          massUnit,
          volume: typeof chem.volume === 'number' ? chem.volume : undefined,
          volumeUnit: volUnit,
          moles: typeof chem.moles === 'number' ? chem.moles : undefined,
          molesUnit,
          isReference: false,
          properties: properties || null,
          molfile: properties?.molfile,
          structureSource: properties?.cid ? "pubchem" : properties?.smiles ? "local-smiles" : undefined
        };
        
        // Try to match with inventory
        const invItem = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (invItem) {
          if (invItem.formula && !properties?.formula) entry.nameOrFormula = `${name} (${invItem.formula})`;
          if (invItem.density && !properties?.density) entry.density = parseFloat(invItem.density);
        } else if (!properties?.mw && entry.mass && entry.moles) {
          // Approximate molar mass
          let massInG = entry.massUnit === 'g' ? entry.mass : entry.mass / 1000;
          let molesInMol = entry.molesUnit === 'mol' ? entry.moles : entry.moles / 1000;
          if (molesInMol > 0) {
            entry.molarMass = massInG / molesInMol;
          }
        }
        
        return entry;
      }));
      
      const entries = parsedEntries.filter((e): e is ReagentEntry => e !== null);

      if (entries.length === 0) {
        setError("Не удалось распознать вещества или найденный текст — это просто посуда/предлоги. Убедитесь, что текст содержит формат: 'Название (1.5 g, 10 mmol)' или 'Растворитель (20 mL)'.");
        setIsAiLoading(false);
        return;
      }
      
      onAddEntries(entries);
      setOpen(false);
      setText("");
      setError("");
    } catch (e: any) {
      console.error("AI parse error:", e);
      // Fallback to local parsing on AI error
      parseTextLocal();
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 shrink-0">
          <Wand2 className="w-4 h-4 text-purple-500" />
          <span className="hidden sm:inline">Smart Paste</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-500" />
            Распознавание текста (Beta)
          </DialogTitle>
          <DialogDescription>
            Вставьте фрагмент текста из методики статьи (Experimental Section). Приложение автоматически найдет вещества и добавит их в таблицу.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
            <p className="font-medium mb-1">Пример поддерживаемого формата:</p>
            <p className="font-mono">To a solution of benzyl bromide (1.71 g, 10.0 mmol) in DMF (20 mL) was added K2CO3 (2.07 g, 15.0 mmol)...</p>
          </div>
          
          <Textarea 
            placeholder="Вставьте текст методики на английском или русском..."
            className="min-h-[150px] resize-none"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
          />
          
          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-2 rounded">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={isAiLoading}>Отмена</Button>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              variant="outline"
              onClick={parseTextLocal} 
              disabled={!text.trim() || isAiLoading} 
              className="gap-2"
            >
              <Wand2 className="w-4 h-4" />
              Обычный парсинг
            </Button>
            <Button 
              onClick={parseTextAI} 
              disabled={!text.trim() || isAiLoading} 
              className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0"
            >
              {isAiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              AI Парсинг
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
