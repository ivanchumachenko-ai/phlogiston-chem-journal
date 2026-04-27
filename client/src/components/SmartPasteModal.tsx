import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wand2, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { ReagentEntry } from "@/lib/export";
import { getInventory } from "@/lib/storage";
import { parseWithFreeAI } from "@/lib/ai";
import { get_properties_async } from "@/lib/chemistry";

interface SmartPasteModalProps {
  onAddEntries: (entries: ReagentEntry[], pastedText: string) => void;
}

export function SmartPasteModal({ onAddEntries }: SmartPasteModalProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [scaleFactor, setScaleFactor] = useState<string>("1");
  const cancelledRef = useRef(false);

  const handleCancel = () => {
    cancelledRef.current = true;
    setIsAiLoading(false);
    setIsLocalLoading(false);
    setOpen(false);
    setProgress(0);
  };

  // Fallback to local parsing if AI fails or user chooses it
  const parseTextLocal = async (isFallback = false) => {
    try {
      cancelledRef.current = false;
      if (!isFallback) setIsLocalLoading(true);
      setProgress(10);
      setProgressText("Анализ текста...");
      const inventory = getInventory();
      const entries: ReagentEntry[] = [];
      const foundReagents: string[] = [];

      // Regex 1: "Name (Amount Unit, Moles mmol)" -> "benzyl bromide (1.71 g, 10.0 mmol)"
      // Allows comma, semicolon, or "and" as separator.
      const regexSolid = /([a-zA-Z0-9\-\(\)\s\,\.]+?)\s*\(\s*([\d\.]+)\s*(g|mg|kg|mL|L|μL)(?:[,;]|\s+and|\s+)\s*([\d\.]+)\s*(mmol|mol)\s*\)/gi;
      
      // Regex 1b: Inverted order "Name (Moles mmol, Amount Unit)"
      const regexSolidInverted = /([a-zA-Z0-9\-\(\)\s\,\.]+?)\s*\(\s*([\d\.]+)\s*(mmol|mol)(?:[,;]|\s+and|\s+)\s*([\d\.]+)\s*(g|mg|kg|mL|L|μL)\s*\)/gi;
      
      // Regex 2: "Name (Amount Unit)" -> "DMF (20 mL)"
      const regexSolvent = /([a-zA-Z0-9\-\(\)\s\,\.]+?)\s*\(\s*([\d\.]+)\s*(mL|L|μL|g|mg|kg)\s*\)/gi;

      // Helper to find the longest valid chemical name by checking suffixes
      // Algorithm changed to right-to-left: build from the rightmost word until we hit an invalid word.
      const findLongestValidName = async (rawName: string) => {
        if (cancelledRef.current) return null;
        // Clean trailing punctuation
        let cleanStr = rawName.replace(/^[\s,:]+|[\s,:]+$/g, '');
        const words = cleanStr.split(/\s+/);
        
        let longestValid = null;
        let currentStr = "";
        
        for (let i = words.length - 1; i >= 0; i--) {
          if (cancelledRef.current) return null;
          
          currentStr = words[i] + (currentStr ? " " + currentStr : "");
          // Skip if candidate is too short and no valid match yet
          if (currentStr.length < 3 && !/^[A-Z]/.test(currentStr) && !longestValid) continue;
          
          const props = await get_properties_async(currentStr);
          
          // STRICT FILTER: Accept if we found properties with formula or structure
          if (props && (props.formula || props.cid || props.smiles)) {
            longestValid = { name: currentStr, properties: props };
          } else if (longestValid) {
            // If we already found a valid suffix (e.g. "benzyl bromide"), but adding the next word ("of benzyl bromide") makes it invalid, STOP and return the valid one.
            break;
          }
        }
        return longestValid;
      };

      const scale = parseFloat(scaleFactor) || 1;

      regexSolid.lastIndex = 0;
      let match;
      while ((match = regexSolid.exec(text)) !== null) {
        if (cancelledRef.current) return;
        const rawName = match[1].trim();
        const validMatch = await findLongestValidName(rawName);
        if (!validMatch) continue; // Skip garbage
        
        setProgress(p => Math.min(95, p + 10));
        setProgressText(`Обработка: ${validMatch.name}`);
        
        const { name, properties } = validMatch;
        const amount = parseFloat(match[2]) * scale;
        const unitStr = match[3].toLowerCase();
        const moles = parseFloat(match[4]) * scale;
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
        
        const entry: ReagentEntry = {
          id: crypto.randomUUID(),
          nameOrFormula: name,
          molarMass: properties.mw || 0,
          mass: finalMass,
          massUnit: massUnit,
          moles: moles,
          molesUnit: molesUnitStr === 'mol' ? 'mol' : 'mmol',
          isReference: false,
          properties: properties || null,
          molfile: properties.molfile,
          structureSource: properties.cid ? "pubchem" : properties.smiles ? "local-smiles" : undefined
        };

        const invItem = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (invItem) {
          if (invItem.formula && !properties.formula) entry.nameOrFormula = `${name} (${invItem.formula})`;
        } else if (!properties.mw) {
          // Approximate molar mass from mass/moles
          if (finalMass && moles) {
            let massInG = massUnit === 'g' ? finalMass : finalMass / 1000;
            let molesInMol = entry.molesUnit === 'mol' ? moles : moles / 1000;
            entry.molarMass = massInG / molesInMol;
          }
        }

        entries.push(entry);
      }

      regexSolidInverted.lastIndex = 0;
      while ((match = regexSolidInverted.exec(text)) !== null) {
        if (cancelledRef.current) return;
        const rawName = match[1].trim();
        const validMatch = await findLongestValidName(rawName);
        if (!validMatch) continue;
        
        setProgress(p => Math.min(95, p + 10));
        setProgressText(`Обработка: ${validMatch.name}`);
        
        const { name, properties } = validMatch;
        const moles = parseFloat(match[2]) * scale;
        const molesUnitStr = match[3].toLowerCase();
        const amount = parseFloat(match[4]) * scale;
        const unitStr = match[5].toLowerCase();
        
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
        
        const entry: ReagentEntry = {
          id: crypto.randomUUID(),
          nameOrFormula: name,
          molarMass: properties.mw || 0,
          mass: finalMass,
          massUnit: massUnit,
          moles: moles,
          molesUnit: molesUnitStr === 'mol' ? 'mol' : 'mmol',
          isReference: false,
          properties: properties || null,
          molfile: properties.molfile,
          structureSource: properties.cid ? "pubchem" : properties.smiles ? "local-smiles" : undefined
        };

        const invItem = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (invItem) {
          if (invItem.formula && !properties.formula) entry.nameOrFormula = `${name} (${invItem.formula})`;
        }

        entries.push(entry);
      }

      regexSolvent.lastIndex = 0;
      while ((match = regexSolvent.exec(text)) !== null) {
        if (cancelledRef.current) return;
        const rawName = match[1].trim();
        const validMatch = await findLongestValidName(rawName);
        if (!validMatch) continue;
        
        setProgress(p => Math.min(95, p + 10));
        setProgressText(`Обработка: ${validMatch.name}`);
        
        const { name, properties } = validMatch;
        const amount = parseFloat(match[2]) * scale;
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

        const entry: ReagentEntry = {
          id: crypto.randomUUID(),
          nameOrFormula: name,
          molarMass: properties.mw || 0,
          volume: finalVol,
          massUnit: "mg",
          molesUnit: "mmol",
          isReference: false,
          density: properties.density,
          properties: properties || null,
          molfile: properties.molfile,
          structureSource: properties.cid ? "pubchem" : properties.smiles ? "local-smiles" : undefined
        };

        const invItem = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (invItem) {
          if (invItem.formula && !properties.formula) entry.nameOrFormula = `${name} (${invItem.formula})`;
          if (invItem.density && !properties.density) entry.density = parseFloat(invItem.density);
        }

        entries.push(entry);
      }

      if (entries.length === 0) {
        setError("Не удалось распознать вещества. Убедитесь, что текст содержит формат: 'Название (1.5 g, 10 mmol)' или 'Растворитель (20 mL)'.");
        setIsLocalLoading(false);
        return;
      }

      // Wait a tiny bit so user sees 100%
      setProgress(100);
      setProgressText("Готово!");
      await new Promise(r => setTimeout(r, 500));
      
      onAddEntries(entries, text);
      setOpen(false);
      setText("");
      setError("");
      setScaleFactor("1");
      setProgress(0);
    } catch (e: any) {
      if (cancelledRef.current) return;
      setError(e.message || "Ошибка локального распознавания");
    } finally {
      if (!isFallback) setIsLocalLoading(false);
    }
  };

  const parseTextAI = async () => {
    if (!text.trim()) return;
    
    cancelledRef.current = false;
    setIsAiLoading(true);
    setError("");
    setProgress(10);
    setProgressText("Ожидание ответа AI (около 5-10 сек)...");
    
    // Fake progress interval while waiting for AI
    const fakeProgressInterval = setInterval(() => {
      setProgress(p => {
        if (p < 45) return p + 2;
        return p;
      });
    }, 500);
    
    try {
      const aiChemicals = await parseWithFreeAI(text);
      clearInterval(fakeProgressInterval);
      
      if (cancelledRef.current) return;
      
      if (!aiChemicals || aiChemicals.length === 0) {
        // Fallback to local parsing
        setProgressText("Переход к локальному распознаванию...");
        await parseTextLocal(true);
        setIsAiLoading(false);
        return;
      }
      
      const inventory = getInventory();
      const scale = parseFloat(scaleFactor) || 1;
      
      const validAiChemicals = aiChemicals.filter((chem: any) => chem && chem.name && typeof chem.name === 'string');
      
      setProgress(50);
      
      const parsedEntries: (ReagentEntry | null)[] = [];
      
      for (let i = 0; i < validAiChemicals.length; i++) {
        if (cancelledRef.current) return;
        const chem = validAiChemicals[i];
        const name = String(chem.name || "Unknown");
        setProgressText(`Поиск свойств для: ${name} (${i + 1}/${validAiChemicals.length})`);
        
        let massUnit: "mg" | "g" = "mg";
        if (chem.massUnit === 'g') massUnit = 'g';
        
        let volUnit: "uL" | "mL" = "mL";
        if (chem.volumeUnit === 'uL') volUnit = 'uL';
        
        let molesUnit: "mmol" | "mol" = "mmol";
        if (chem.molesUnit === 'mol') molesUnit = 'mol';

        const properties = await get_properties_async(name) || undefined;
        
        // STRICT FILTER: Only accept if we found properties with formula or structure
        if (!properties?.formula && !properties?.cid && !properties?.smiles) {
          parsedEntries.push(null);
          continue;
        }
        
        const mass = typeof chem.mass === 'number' ? chem.mass * scale : undefined;
        const volume = typeof chem.volume === 'number' ? chem.volume * scale : undefined;
        const moles = typeof chem.moles === 'number' ? chem.moles * scale : undefined;

        const entry: ReagentEntry = {
          id: crypto.randomUUID(),
          nameOrFormula: name,
          molarMass: properties?.mw || 0,
          mass,
          massUnit,
          volume,
          volumeUnit: volUnit,
          moles,
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
        
        parsedEntries.push(entry);
        setProgress(50 + Math.round(((i + 1) / validAiChemicals.length) * 50));
      }
      
      const entries = parsedEntries.filter((e): e is ReagentEntry => e !== null);

      if (entries.length === 0) {
        setError("Не удалось распознать вещества или найденный текст — это просто посуда/предлоги. Убедитесь, что текст содержит формат: 'Название (1.5 g, 10 mmol)' или 'Растворитель (20 mL)'.");
        setIsAiLoading(false);
        return;
      }
      
      // Wait a tiny bit so user sees 100%
      setProgress(100);
      setProgressText("Готово!");
      await new Promise(r => setTimeout(r, 500));
      
      onAddEntries(entries, text);
      setOpen(false);
      setText("");
      setError("");
      setScaleFactor("1");
      setProgress(0);
    } catch (e: any) {
      if (cancelledRef.current) return;
      console.error("AI parse error:", e);
      // Fallback to local parsing on AI error
      setProgressText("Переход к локальному распознаванию...");
      await parseTextLocal(true);
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
          
          <div className="flex items-center gap-2 mb-2">
             <span className="text-sm font-medium">Масштаб (множитель):</span>
             <input 
               type="number" 
               min="0.01" 
               step="0.1" 
               className="flex h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
               value={scaleFactor}
               onChange={(e) => setScaleFactor(e.target.value)}
             />
             <span className="text-xs text-muted-foreground">(например, 2 = увеличить в 2 раза)</span>
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

          {(isAiLoading || isLocalLoading) && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-md">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>{progressText || "Распознавание..."}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 ease-in-out" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="secondary" onClick={handleCancel}>Отмена</Button>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              type="button"
              variant="outline"
              onClick={parseTextLocal} 
              disabled={!text.trim() || isAiLoading || isLocalLoading} 
              className="gap-2"
            >
              {isLocalLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              Обычный парсинг
            </Button>
            <Button 
              type="button"
              onClick={parseTextAI} 
              disabled={!text.trim() || isAiLoading || isLocalLoading} 
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
