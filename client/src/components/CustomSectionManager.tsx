import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Image as ImageIcon, Type, Table as TableIcon, CheckSquare, Square } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { CustomSectionData, CustomSectionType } from "@/lib/export";

function evaluateCell(value: string, rows: string[][], visited = new Set<string>()): string {
  if (!value || typeof value !== 'string' || !value.startsWith("=")) return value;
  
  try {
    let expr = value.substring(1).toUpperCase();
    
    // Replace cell references (e.g., A1, B2) with their evaluated values
    const cellRegex = /([A-Z]+)([0-9]+)/g;
    let hasCircularRef = false;

    expr = expr.replace(cellRegex, (match, colStr, rowStr) => {
      const cellId = `${colStr}${rowStr}`;
      if (visited.has(cellId)) {
        hasCircularRef = true;
        return "0";
      }
      
      let col = 0;
      for (let i = 0; i < colStr.length; i++) {
        col = col * 26 + (colStr.charCodeAt(i) - 64);
      }
      col -= 1; // 0-indexed
      const row = parseInt(rowStr, 10) - 1; // 0-indexed
      
      if (rows[row] && rows[row][col] !== undefined) {
        const newVisited = new Set(visited);
        newVisited.add(cellId);
        const cellVal = evaluateCell(rows[row][col], rows, newVisited);
        const num = parseFloat(cellVal);
        return isNaN(num) ? "0" : num.toString();
      }
      return "0";
    });

    if (hasCircularRef) return "#REF!";

    // Basic math evaluation (only allow numbers and basic operators for safety)
    // Replace ^ with ** for exponentiation
    expr = expr.replace(/\^/g, '**');
    
    if (/^[0-9+\-*/().\s*]+$/.test(expr)) {
      // Using Function constructor to evaluate safe math string
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${expr}`)();
      if (typeof result === 'number') {
        // Format to avoid long decimals like 0.30000000000000004
        return Number.isInteger(result) ? result.toString() : parseFloat(result.toFixed(6)).toString();
      }
    }
    return "#ERROR!";
  } catch (e) {
    return "#ERROR!";
  }
}

interface Props {
  sections: CustomSectionData[];
  onChange: (sections: CustomSectionData[]) => void;
  lang: "ru" | "en";
}

const copy = {
  ru: {
    addSection: "+ Добавить подраздел",
    typeText: "Текст",
    typeImage: "Изображение",
    typeTable: "Таблица",
    typeChecklist: "Чеклист",
    typeEmpty: "Пустой блок",
    sectionTitle: "Заголовок раздела",
    delete: "Удалить",
    contentPlaceholder: "Введите текст...",
    uploadImage: "Загрузить фото",
    addColumn: "+ Колонка",
    addRow: "+ Строка",
    addTodo: "+ Пункт",
    emptyBlock: "Оставьте пустым для заполнения от руки"
  },
  en: {
    addSection: "+ Add Subsection",
    typeText: "Text",
    typeImage: "Image",
    typeTable: "Table",
    typeChecklist: "Checklist",
    typeEmpty: "Empty block",
    sectionTitle: "Section Title",
    delete: "Delete",
    contentPlaceholder: "Enter text...",
    uploadImage: "Upload photo",
    addColumn: "+ Column",
    addRow: "+ Row",
    addTodo: "+ Item",
    emptyBlock: "Leave empty to fill by hand"
  }
};

export function CustomSectionManager({ sections = [], onChange, lang }: Props) {
  const t = copy[lang];
  const [focusedCell, setFocusedCell] = useState<{ sectionId: string; rowIndex: number; colIndex: number } | null>(null);

  // Helper to handle clicking on another cell while editing a formula
  const handleCellClickForFormula = (sectionId: string, clickedRow: number, clickedCol: number, e: React.MouseEvent) => {
    if (!focusedCell || focusedCell.sectionId !== sectionId) return;
    if (focusedCell.rowIndex === clickedRow && focusedCell.colIndex === clickedCol) return;
    
    const section = sections.find(s => s.id === sectionId);
    if (!section || section.type !== "table") return;
    
    let data = { headers: [], rows: [] };
    try { data = JSON.parse(section.content); } catch (e) {}
    
    const focusedValue = data.rows[focusedCell.rowIndex][focusedCell.colIndex];
    if (typeof focusedValue === 'string' && focusedValue.startsWith("=")) {
      e.preventDefault(); // Prevent blur
      const cellAddress = `${String.fromCharCode(65 + clickedCol)}${clickedRow + 1}`;
      const newRows = [...data.rows];
      newRows[focusedCell.rowIndex][focusedCell.colIndex] = focusedValue + cellAddress;
      updateSection(sectionId, { content: JSON.stringify({ ...data, rows: newRows }) });
      
      // Keep focus on the original input by re-focusing it after a tiny delay
      setTimeout(() => {
        const activeInput = document.getElementById(`cell-${sectionId}-${focusedCell.rowIndex}-${focusedCell.colIndex}`);
        if (activeInput) activeInput.focus();
      }, 0);
    }
  };

  const handleAdd = (type: CustomSectionType) => {
    let defaultContent = "";
    if (type === "table") {
      defaultContent = JSON.stringify({ headers: ["Col 1", "Col 2"], rows: [["", ""]] });
    } else if (type === "checklist") {
      defaultContent = JSON.stringify([{ text: "", checked: false }]);
    }
    
    onChange([
      ...sections,
      {
        id: uuidv4(),
        type,
        title: "",
        content: defaultContent,
        order: sections.length
      }
    ]);
  };

  const updateSection = (id: string, updates: Partial<CustomSectionData>) => {
    onChange(sections.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSection = (id: string) => {
    onChange(sections.filter(s => s.id !== id));
  };

  const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        // Aggressive compression for localStorage (max 5MB limit)
        const max_dim = 800;
        
        if (width > height && width > max_dim) {
          height *= max_dim / width;
          width = max_dim;
        } else if (height > max_dim) {
          width *= max_dim / height;
          height = max_dim;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // 0.5 quality for JPEG is usually fine for documents and saves a lot of space
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.5);
          updateSection(id, { content: compressedDataUrl });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const renderContentEditor = (section: CustomSectionData) => {
    if (section.type === "text") {
      return (
        <Textarea 
          value={section.content}
          onChange={(e) => updateSection(section.id, { content: e.target.value })}
          placeholder={t.contentPlaceholder}
          className="min-h-[100px] mt-2 text-sm"
        />
      );
    }
    
    if (section.type === "image") {
      return (
        <div className="mt-2">
          {section.content ? (
            <div className="relative group rounded-md overflow-hidden border">
              <img src={section.content} alt="Upload" className="max-h-[300px] w-auto object-contain mx-auto" />
              <Button 
                variant="destructive" 
                size="sm" 
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => updateSection(section.id, { content: "" })}
              >
                {t.delete}
              </Button>
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-md p-8 text-center bg-slate-50">
              <label className="cursor-pointer flex flex-col items-center gap-2">
                <ImageIcon className="h-8 w-8 text-slate-400" />
                <span className="text-sm font-medium text-blue-600">{t.uploadImage}</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => handleImageUpload(section.id, e)}
                />
              </label>
            </div>
          )}
        </div>
      );
    }

    if (section.type === "table") {
      let data = { headers: [], rows: [] };
      try { data = JSON.parse(section.content); } catch (e) {}
      
      return (
        <div className="mt-2 overflow-x-auto border rounded-md p-2">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {data.headers?.map((h: string, i: number) => (
                  <th key={i} className="p-1">
                    <Input 
                      value={h} 
                      className="h-8 text-xs font-semibold"
                      onChange={(e) => {
                        const newHeaders = [...data.headers];
                        newHeaders[i] = e.target.value;
                        updateSection(section.id, { content: JSON.stringify({ ...data, headers: newHeaders }) });
                      }}
                    />
                  </th>
                ))}
                <th className="w-8">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                    const newHeaders = [...(data.headers || []), `Col ${(data.headers?.length || 0) + 1}`];
                    const newRows = (data.rows || []).map((r: any) => [...r, ""]);
                    updateSection(section.id, { content: JSON.stringify({ headers: newHeaders, rows: newRows }) });
                  }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows?.map((row: string[], ri: number) => (
                <tr key={ri}>
                  {row.map((cell: string, ci: number) => {
                    const isFocused = focusedCell?.sectionId === section.id && focusedCell?.rowIndex === ri && focusedCell?.colIndex === ci;
                    const displayValue = isFocused ? cell : evaluateCell(cell, data.rows);
                    
                    return (
                      <td 
                        key={ci} 
                        className="p-1 relative group/cell cursor-pointer"
                        onMouseDown={(e) => handleCellClickForFormula(section.id, ri, ci, e)}
                      >
                        <div className="absolute top-0 left-0 text-[8px] text-slate-300 opacity-0 group-hover/cell:opacity-100 pointer-events-none select-none z-10 p-0.5">
                          {String.fromCharCode(65 + ci)}{ri + 1}
                        </div>
                        <Input 
                          id={`cell-${section.id}-${ri}-${ci}`}
                          value={displayValue} 
                          className="h-8 text-xs font-mono cursor-text"
                          onFocus={() => setFocusedCell({ sectionId: section.id, rowIndex: ri, colIndex: ci })}
                          onBlur={() => setFocusedCell(null)}
                          onChange={(e) => {
                            const newRows = [...data.rows];
                            newRows[ri][ci] = e.target.value;
                            updateSection(section.id, { content: JSON.stringify({ ...data, rows: newRows }) });
                          }}
                        />
                      </td>
                    );
                  })}
                  <td>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => {
                      const newRows = data.rows.filter((_: any, idx: number) => idx !== ri);
                      updateSection(section.id, { content: JSON.stringify({ ...data, rows: newRows }) });
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={(data.headers?.length || 0) + 1} className="p-1">
                  <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => {
                    const newRows = [...(data.rows || []), Array(data.headers?.length || 1).fill("")];
                    updateSection(section.id, { content: JSON.stringify({ ...data, rows: newRows }) });
                  }}>
                    {t.addRow}
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (section.type === "checklist") {
      let items = [];
      try { items = JSON.parse(section.content); } catch (e) {}
      
      return (
        <div className="mt-2 space-y-2">
          {items.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={item.checked} 
                onChange={(e) => {
                  const newItems = [...items];
                  newItems[i].checked = e.target.checked;
                  updateSection(section.id, { content: JSON.stringify(newItems) });
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              <Input 
                value={item.text} 
                className="h-8 text-sm"
                placeholder="..."
                onChange={(e) => {
                  const newItems = [...items];
                  newItems[i].text = e.target.value;
                  updateSection(section.id, { content: JSON.stringify(newItems) });
                }}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-red-500" onClick={() => {
                const newItems = items.filter((_: any, idx: number) => idx !== i);
                updateSection(section.id, { content: JSON.stringify(newItems) });
              }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => {
            const newItems = [...items, { text: "", checked: false }];
            updateSection(section.id, { content: JSON.stringify(newItems) });
          }}>
            {t.addTodo}
          </Button>
        </div>
      );
    }

    if (section.type === "empty") {
      return (
        <div className="mt-2 h-[100px] border-2 border-dashed border-slate-200 rounded-md flex items-center justify-center bg-slate-50/50">
          <span className="text-sm text-slate-400">{t.emptyBlock}</span>
        </div>
      );
    }

    return null;
  };

  const getIcon = (type: CustomSectionType) => {
    switch (type) {
      case "text": return <Type className="h-4 w-4" />;
      case "image": return <ImageIcon className="h-4 w-4" />;
      case "table": return <TableIcon className="h-4 w-4" />;
      case "checklist": return <CheckSquare className="h-4 w-4" />;
      case "empty": return <Square className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4 mt-6">
      {sections.map((section, index) => (
        <div key={section.id} className="border rounded-md p-3 bg-white shadow-sm relative group transition-all">
          <div className="flex items-center gap-2 mb-2">
            <GripVertical className="h-4 w-4 text-slate-300 cursor-move" />
            {getIcon(section.type)}
            <Input 
              value={section.title} 
              onChange={(e) => updateSection(section.id, { title: e.target.value })}
              placeholder={t.sectionTitle}
              className="h-8 font-medium border-transparent hover:border-slate-200 focus-visible:ring-0 px-1 shadow-none"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeSection(section.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="pl-6">
            {renderContentEditor(section)}
          </div>
        </div>
      ))}
      
      <div className="flex justify-center">
        <Select onValueChange={(val: CustomSectionType) => handleAdd(val)} value="">
          <SelectTrigger className="w-[200px] h-9 border-dashed border-2 bg-slate-50 text-slate-500 hover:text-slate-900 hover:border-slate-400 transition-colors shadow-none">
            <SelectValue placeholder={t.addSection} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text"><div className="flex items-center gap-2"><Type className="h-4 w-4"/> {t.typeText}</div></SelectItem>
            <SelectItem value="image"><div className="flex items-center gap-2"><ImageIcon className="h-4 w-4"/> {t.typeImage}</div></SelectItem>
            <SelectItem value="table"><div className="flex items-center gap-2"><TableIcon className="h-4 w-4"/> {t.typeTable}</div></SelectItem>
            <SelectItem value="checklist"><div className="flex items-center gap-2"><CheckSquare className="h-4 w-4"/> {t.typeChecklist}</div></SelectItem>
            <SelectItem value="empty"><div className="flex items-center gap-2"><Square className="h-4 w-4"/> {t.typeEmpty}</div></SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
