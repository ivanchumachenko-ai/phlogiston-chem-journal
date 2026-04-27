import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wand2, AlertCircle } from "lucide-react";
import { ReagentEntry } from "@/lib/export";
import { getInventory } from "@/lib/storage";

interface SmartPasteModalProps {
  onAddEntries: (entries: ReagentEntry[]) => void;
}

export function SmartPasteModal({ onAddEntries }: SmartPasteModalProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const parseText = () => {
    try {
      const inventory = getInventory();
      const entries: ReagentEntry[] = [];
      const foundReagents: string[] = [];

      // Regex 1: "Name (Amount Unit, Moles mmol)" -> "benzyl bromide (1.71 g, 10.0 mmol)"
      const regexSolid = /([a-zA-Z0-9\-\(\)\s\,\.]+?)\s*\(\s*([\d\.]+)\s*(g|mg|kg|mL|L|μL),\s*([\d\.]+)\s*(mmol|mol)\s*\)/gi;
      
      // Regex 2: "Name (Amount Unit)" -> "DMF (20 mL)"
      const regexSolvent = /([a-zA-Z0-9\-\(\)\s\,\.]+?)\s*\(\s*([\d\.]+)\s*(mL|L|μL)\s*\)/gi;

      let match;
      while ((match = regexSolid.exec(text)) !== null) {
        const name = match[1].trim();
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

        const entry: ReagentEntry = {
          id: crypto.randomUUID(),
          nameOrFormula: name,
          molarMass: 0,
          mass: finalMass,
          massUnit: massUnit,
          moles: moles,
          molesUnit: molesUnitStr === 'mol' ? 'mol' : 'mmol',
          properties: {}
        };

        const invItem = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (invItem) {
          entry.molarMass = parseFloat(invItem.molarMass || "0") || 0;
          if (invItem.formula) entry.nameOrFormula = `${name} (${invItem.formula})`;
        } else {
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
        const name = match[1].trim();
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

        const entry: ReagentEntry = {
          id: crypto.randomUUID(),
          nameOrFormula: name,
          molarMass: 0,
          volume: finalVol,
          massUnit: "mg",
          molesUnit: "mmol",
          properties: {}
        };

        const invItem = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (invItem) {
          entry.molarMass = parseFloat(invItem.molarMass || "0") || 0;
          if (invItem.formula) entry.nameOrFormula = `${name} (${invItem.formula})`;
          if (invItem.density) entry.density = parseFloat(invItem.density);
        }

        entries.push(entry);
      }

      if (entries.length === 0) {
        setError("Не удалось распознать вещества. Убедитесь, что текст содержит формат: 'Название (1.5 g, 10 mmol)' или 'Растворитель (20 mL)'.");
        return;
      }

      onAddEntries(entries);
      setOpen(false);
      setText("");
      setError("");
    } catch (e: any) {
      setError(e.message || "Ошибка распознавания");
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
        
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>Отмена</Button>
          <Button onClick={parseText} disabled={!text.trim()} className="gap-2">
            <Wand2 className="w-4 h-4" />
            Распознать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
