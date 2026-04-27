import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { calculate_molar_mass, get_properties_async, ChemicalProperties } from "@/lib/chemistry";
import { ReagentEntry, SynthesisDetails, exportToTxt, exportToCsv, openPublicationPdf } from "@/lib/export";
import { parseTxtSynthesis, parseCsvSynthesis } from "@/lib/importTxt";
import { getClosestDensity, ACID_DENSITIES } from "@/lib/densityDb";
import { Button } from "@/components/ui/button";
import { CustomSectionManager } from "@/components/CustomSectionManager";
import { CustomSectionData } from "@/lib/export";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, Trash2, Beaker, Calculator, RefreshCw, ChevronRight, Scale, Droplet, ArrowRight, FlaskConical, Loader2, Moon, Sun, PenTool, Languages, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Wand2, Save, List, History, FileText, Upload, MapPin, ExternalLink, DownloadCloud, Info, ShieldCheck, Database, WifiOff, AlertCircle } from "lucide-react";
import { getSavedSyntheses, saveSynthesis, deleteSynthesis, SavedSynthesis, getInventory, saveInventory, InventoryItem, getCustomReagents, saveCustomReagent, deleteCustomReagent, CustomReagent, getGSheetsUrl, saveGSheetsUrl } from "@/lib/storage";
import React, { useRef } from "react";
import * as XLSX from "xlsx";
import { SmartPasteModal } from "@/components/SmartPasteModal";

import { StructureEditor } from "@/components/StructureEditor";
import { ReactionScheme, ReactionSchemeData } from "@/components/ReactionScheme";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { t, getLang, setLang, Language } from "@/lib/i18n";

function resolveReagentLabel(input: string, props: ChemicalProperties | null): string {
  const trimmed = input.trim();
  if (!trimmed) return props?.name || props?.formula || "";

  const looksLikeSmiles = /[=#@\\/]/.test(trimmed);
  if (looksLikeSmiles) {
    return props?.name || props?.formula || trimmed;
  }

  return trimmed;
}

function getEntryLookupValue(entry: ReagentEntry): string {
  return entry.properties?.formula || entry.properties?.name || entry.properties?.smiles || entry.nameOrFormula;
}

function emptyReactionScheme(): ReactionSchemeData {
  return {
    reactants: [],
    conditions: "",
    products: [],
    stages: [{ reactants: [], conditions: "", products: [] }],
    isCompleted: false,
  };
}

function normalizeReactionSchemeData(scheme?: SynthesisDetails["reactionScheme"]): ReactionSchemeData {
  if (!scheme) return emptyReactionScheme();

  const normalizeCompound = (compound: any) => {
    if (typeof compound === "string") {
      return { label: compound };
    }

    return {
      label: compound?.label || "",
      entryId: compound?.entryId,
      smiles: compound?.smiles,
      molfile: compound?.molfile,
      cid: compound?.cid,
    };
  };

  const stages = scheme.stages && scheme.stages.length > 0
    ? scheme.stages
    : [{ reactants: scheme.reactants || [], conditions: scheme.conditions || "", products: scheme.products || [] }];

  return {
    reactants: (stages[0]?.reactants || []).map(normalizeCompound),
    conditions: stages[0]?.conditions || "",
    products: (stages[stages.length - 1]?.products || []).map(normalizeCompound),
    stages: stages.map((stage) => ({
      reactants: (stage.reactants || []).map(normalizeCompound),
      conditions: stage.conditions || "",
      products: (stage.products || []).map(normalizeCompound),
    })),
    isCompleted: Boolean(scheme.isCompleted),
  };
}

import { FormatToolbar } from "@/components/FormatToolbar";

export default function Home() {
  const [entries, setEntries] = useState<ReagentEntry[]>([]);
  const [lang, setCurrentLang] = useState<Language>(getLang());
  
  // Storage state
  const [currentSynthesisId, setCurrentSynthesisId] = useState<string | undefined>(undefined);
  const [savedSyntheses, setSavedSyntheses] = useState<SavedSynthesis[]>([]);
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const [isDesktopHistoryOpen, setIsDesktopHistoryOpen] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customReagents, setCustomReagents] = useState<CustomReagent[]>([]);
  const [isCustomReagentsOpen, setIsCustomReagentsOpen] = useState(false);
  const [isEditingCustomReagent, setIsEditingCustomReagent] = useState(false);
  const [editingReagentId, setEditingReagentId] = useState<string | undefined>(undefined);
  const [gsheetsUrl, setGSheetsUrl] = useState("");
  const [isSyncingGSheets, setIsSyncingGSheets] = useState(false);
  
  // Custom reagent form state
  const [crShortcut, setCrShortcut] = useState("");
  const [crName, setCrName] = useState("");
  const [crFormula, setCrFormula] = useState("");
  const [crSmiles, setCrSmiles] = useState("");
  const [crMolfile, setCrMolfile] = useState("");
  const [crDensity, setCrDensity] = useState("");
  const [crMp, setCrMp] = useState("");
  const [crBp, setCrBp] = useState("");

  const [activePickerContext, setActivePickerContext] = useState<{stageIndex: number, side: "reactant" | "product"} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOpenStructureEditor = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.mode === "custom") {
        setActivePickerContext({
          stageIndex: customEvent.detail.stageIndex,
          side: customEvent.detail.side
        });
        setCrSmiles("");
        setCrMolfile("");
      }
      setIsStructureEditorOpen(customEvent.detail.mode);
    };

    window.addEventListener("openStructureEditor", handleOpenStructureEditor);
    return () => window.removeEventListener("openStructureEditor", handleOpenStructureEditor);
  }, []);

  useEffect(() => {
    setSavedSyntheses(getSavedSyntheses());
    setInventory(getInventory());
    setCustomReagents(getCustomReagents());
    setGSheetsUrl(getGSheetsUrl());
  }, []);

  const toggleLang = () => {
    const newLang = lang === 'ru' ? 'en' : 'ru';
    setCurrentLang(newLang);
    setLang(newLang);
  };

  const downloadUrl = typeof window !== "undefined"
    ? new URL(`${import.meta.env.BASE_URL}phlogiston.zip`, window.location.origin).toString()
    : `${import.meta.env.BASE_URL}phlogiston.zip`;
  const macDownloadCommand = `curl -L "${downloadUrl}" -o phlogiston.zip`;
  const macExtractCommand = "unzip phlogiston.zip -d phlogiston-offline";
  const macRunCommand = "cd phlogiston-offline && python3 -m http.server 8000";
  const windowsDownloadCommand = `Invoke-WebRequest -Uri "${downloadUrl}" -OutFile "phlogiston.zip"`;
  const windowsExtractCommand = 'Expand-Archive -Path ".\\phlogiston.zip" -DestinationPath ".\\phlogiston-offline" -Force';
  const windowsRunCommand = 'Set-Location ".\\phlogiston-offline"; py -m http.server 8000';

  const handleGSheetsSync = async () => {
    if (!gsheetsUrl) {
      toast({
        title: t('error'),
        description: t('errorGSheetsUrl'),
        variant: "destructive"
      });
      return;
    }
    
    // Save URL for future use
    saveGSheetsUrl(gsheetsUrl);

    setIsSyncingGSheets(true);
    try {
      // Allow fetching through proxy or direct
      const response = await fetch(gsheetsUrl);
      if (!response.ok) throw new Error("Failed to fetch");
      
      const csvText = await response.text();
      
      // Parse CSV manually
      const lines = csvText.split('\n');
      if (lines.length < 2) throw new Error("Empty or invalid CSV");
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      
      const parsedInventory: InventoryItem[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // Better CSV parsing handling quotes
        const row: string[] = [];
        let inQuotes = false;
        let currentVal = '';
        for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(currentVal.trim());
                currentVal = '';
            } else {
                currentVal += char;
            }
        }
        row.push(currentVal.trim());
        
        const rowData: Record<string, string> = {};
        headers.forEach((h, idx) => {
            rowData[h] = row[idx] ? row[idx].replace(/^"|"$/g, '') : '';
        });
        
        const item = {
          name: rowData['Название'] || rowData['Name'] || '',
          formula: rowData['Формула'] || rowData['Formula'] || '',
          cas: rowData['CAS'] || '',
          concentration: rowData['Концентрация'] || rowData['Concentration'] || '',
          location: rowData['Местоположение'] || rowData['Location'] || '',
          amount: rowData['Количество'] || rowData['Amount'] || 0,
          unit: rowData['Единица измерения'] || rowData['Unit'] || '',
          notes: rowData['Примечание'] || rowData['Notes'] || ''
        };
        
        if (item.name || item.formula) {
            parsedInventory.push(item);
        }
      }
      
      saveInventory(parsedInventory);
      setInventory(parsedInventory);
      
      toast({
        title: t('successGSheets'),
        description: `${t('helpDensityFor')} ${parsedInventory.length} ${t('helpSolution')}` // Or add a specific translation for "Loaded X items from Google Sheets"
      });
    } catch (e) {
      console.error(e);
      toast({
        title: t('msgSyncError'),
        description: t('errorGSheetsFormat'),
        variant: "destructive"
      });
    } finally {
      setIsSyncingGSheets(false);
    }
  };

  const applyImportedSynthesis = (parsedEntries: ReagentEntry[], parsedDetails: SynthesisDetails) => {
    setEntries(parsedEntries);
    setSynthTitle(parsedDetails.title || "");
    setSynthNumber(parsedDetails.number || "");
    setSynthFormula(parsedDetails.formula || "");
    setSynthProductName(parsedDetails.productName || "");

    if (parsedDetails.productMass) {
      const match = parsedDetails.productMass.match(/^([\d.]+)\s*(mg|g)$/);
      if (match) {
        setSynthProductMass(match[1]);
        setSynthProductMassUnit(match[2] as "mg" | "g");
      } else {
        setSynthProductMass(parsedDetails.productMass);
      }
    } else {
      setSynthProductMass("");
      setSynthProductMassUnit("g");
    }

    setSynthYield(parsedDetails.yield || "");
    setSynthProcedure(parsedDetails.procedure || "");
    setSynthReaction(parsedDetails.reaction || "");
    setSynthSmiles(parsedDetails.productSmiles || "");
    setSynthMolfile(parsedDetails.productMolfile || "");
    setSynthReactionScheme(normalizeReactionSchemeData(parsedDetails.reactionScheme));
    setCurrentSynthesisId(undefined);
  };

  const applyImportedInventory = (rows: Record<string, any>[]) => {
    const parsedInventory: InventoryItem[] = rows.map((row) => ({
      name: row['Название'] || row['Name'] || '',
      formula: row['Формула'] || row['Formula'] || '',
      cas: row['CAS'] || '',
      concentration: row['Концентрация'] || row['Concentration'] || '',
      location: row['Местоположение'] || row['Location'] || '',
      amount: row['Количество'] || row['Amount'] || 0,
      unit: row['Единица измерения'] || row['Unit'] || '',
      notes: row['Примечание'] || row['Notes'] || ''
    })).filter((item) => item.name || item.formula);

    saveInventory(parsedInventory);
    setInventory(parsedInventory);

    toast({
      title: t('successInventoryUpdated'),
      description: `${t('helpDensityFor')} ${parsedInventory.length} ${t('helpSolution')}`
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    if (fileExt === 'txt' || fileExt === 'csv') {
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;

          if (fileExt === 'txt') {
            const { entries: parsedEntries, details: parsedDetails } = parseTxtSynthesis(text);
            if (parsedEntries.length === 0) {
              toast({
                title: t('error'),
                description: t('errorTxtParse'),
                variant: "destructive"
              });
              return;
            }

            applyImportedSynthesis(parsedEntries, parsedDetails);
            toast({
              title: t('successTxtParse'),
              description: `${t('msgImported')} ${parsedEntries.length} ${t('schemeReactants').toLowerCase()}`
            });
            return;
          }

          const parsedCsvSynthesis = parseCsvSynthesis(text);
          if (parsedCsvSynthesis && parsedCsvSynthesis.entries.length > 0) {
            applyImportedSynthesis(parsedCsvSynthesis.entries, parsedCsvSynthesis.details);
            toast({
              title: t('successTxtParse'),
              description: `${t('msgImported')} ${parsedCsvSynthesis.entries.length} ${t('schemeReactants').toLowerCase()}`
            });
            return;
          }

          const workbook = XLSX.read(text, { type: 'string' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
          applyImportedInventory(rows);
        } catch (err) {
          console.error(err);
          toast({
            title: t('msgImportError'),
            description: fileExt === 'csv' ? "Failed to read CSV file. Check format." : "Failed to read synthesis file.",
            variant: "destructive"
          });
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
      return;
    }

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws) as Record<string, any>[];
        applyImportedInventory(rows);
      } catch (err) {
        console.error(err);
        toast({
          title: t('msgImportError'),
          description: "Failed to read Excel file. Check format.",
          variant: "destructive"
        });
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const findLocation = (nameOrFormula: string, parsedFormula?: string) => {
    if (!nameOrFormula && !parsedFormula) return null;
    
    const term1 = nameOrFormula.toLowerCase();
    const term2 = parsedFormula?.toLowerCase() || "";
    
    const found = inventory.find(item => {
      const iName = (item.name || "").toLowerCase();
      const iForm = (item.formula || "").toLowerCase();
      
      return (iName && iName === term1) || 
             (iForm && iForm === term1) ||
             (term2 && iForm && iForm === term2) ||
             (term2 && iName && iName === term2);
    });
    
    return found?.location || null;
  };

  const buildSynthesisDetails = (): SynthesisDetails => ({
    title: synthTitle,
    number: synthNumber,
    formula: synthFormula,
    productName: synthProductName,
    productMass: synthProductMass ? `${synthProductMass} ${synthProductMassUnit}` : "",
    yield: synthYield,
    procedure: synthProcedure,
      customSections,
    reaction: synthReaction,
    productSmiles: synthSmiles,
    productMolfile: synthMolfile,
    reactionScheme: synthReactionScheme,
  });

  const handleSaveSynthesis = () => {
    if (entries.length === 0) {
      toast({
        title: t('error'),
        description: t('errorEmptySynthesis'),
        variant: "destructive"
      });
      return;
    }

    const details = buildSynthesisDetails();

    const id = saveSynthesis(entries, details, currentSynthesisId);
    setCurrentSynthesisId(id);
    setSavedSyntheses(getSavedSyntheses());
    
    toast({
      title: t('msgSaved'),
      description: t('successSynthesisSaved')
    });
  };

  const loadSynthesis = (synth: SavedSynthesis, isCopy: boolean = false) => {
    // If copying, generate new IDs for all entries so they don't conflict, and unset current synthesis ID
    if (isCopy) {
      const copiedEntries = synth.entries.map(e => ({
        ...e,
        id: uuidv4()
      }));
      setEntries(copiedEntries);
      setCurrentSynthesisId(undefined);
      setSynthTitle(synth.details.title ? `${synth.details.title} (${t('msgCopy')})` : t('msgCopyOfSynthesis'));
    } else {
      setEntries(synth.entries);
      setCurrentSynthesisId(synth.id);
      setSynthTitle(synth.details.title || "");
    }
    
    setSynthNumber(synth.details.number || "");
    setSynthFormula(synth.details.formula || "");
    setSynthProductName(synth.details.productName || "");
    
    // Parse product mass and unit
    if (synth.details.productMass) {
      const match = synth.details.productMass.match(/^([\d.]+)\s*(mg|g)$/);
      if (match) {
        setSynthProductMass(match[1]);
        setSynthProductMassUnit(match[2] as "mg" | "g");
      } else {
        setSynthProductMass(synth.details.productMass);
      }
    } else {
      setSynthProductMass("");
    }
    
    setSynthYield(synth.details.yield || "");
    setSynthProcedure(synth.details.procedure || "");
    setCustomSections(synth.details.customSections || []);
    setSynthReaction(synth.details.reaction || "");
    setSynthSmiles(synth.details.productSmiles || "");
    setSynthMolfile(synth.details.productMolfile || "");
    setSynthReactionScheme(normalizeReactionSchemeData(synth.details.reactionScheme));
    
    setIsMobileHistoryOpen(false);
    setIsDesktopHistoryOpen(false);
    toast({
      title: isCopy ? t('successSynthesisCopied') : t('msgSynthesisLoaded'),
      description: synth.details.title ? `${t('msgSynthesisLoaded')} "${synth.details.title}"` : t('msgSynthesisLoaded')
    });
  };

  const handleDeleteSynthesis = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSynthesis(id);
    setSavedSyntheses(getSavedSyntheses());
    if (id === currentSynthesisId) {
      setCurrentSynthesisId(undefined);
    }
    toast({
      title: t('successSynthesisDeleted'),
      description: t('successSynthesisDeleted')
    });
  };

  const handleNewSynthesis = () => {
    setEntries([]);
    setCurrentSynthesisId(undefined);
    setSynthTitle("");
    setSynthNumber("");
    setSynthFormula("");
    setSynthSmiles("");
    setSynthMolfile("");
    setSynthProductName("");
    setSynthProductMass("");
    setSynthYield("");
    setSynthProcedure("");
    setCustomSections([]);
    setSynthReaction("");
    setSynthReactionScheme(emptyReactionScheme());
  };

  const handleOpenNewCustomReagent = () => {
    setIsEditingCustomReagent(true);
    setEditingReagentId(undefined);
    setCrShortcut("");
    setCrName("");
    setCrFormula("");
    setCrSmiles("");
    setCrMolfile("");
    setCrDensity("");
    setCrMp("");
    setCrBp("");
  };

  const handleEditCustomReagent = (cr: CustomReagent) => {
    setIsEditingCustomReagent(true);
    setEditingReagentId(cr.id);
    setCrShortcut(cr.shortcut);
    setCrName(cr.name);
    setCrFormula(cr.formula);
    setCrSmiles(cr.smiles || "");
    setCrMolfile(cr.molfile || "");
    setCrDensity(cr.density !== undefined ? cr.density.toString() : "");
    setCrMp(cr.mp !== undefined ? cr.mp.toString() : "");
    setCrBp(cr.bp !== undefined ? cr.bp.toString() : "");
  };

  const handleSaveCustomReagent = () => {
    if (!crShortcut || !crName || !crFormula) {
      toast({
        title: t('error'),
        description: t('errorRequiredFields'),
        variant: "destructive"
      });
      return;
    }

    const newCr = {
      shortcut: crShortcut,
      name: crName,
      formula: crFormula,
      smiles: crSmiles || undefined,
      molfile: crMolfile || undefined,
      density: crDensity ? parseFloat(crDensity) : undefined,
      mp: crMp ? parseFloat(crMp) : undefined,
      bp: crBp ? parseFloat(crBp) : undefined,
    };

    saveCustomReagent(newCr, editingReagentId);
    setCustomReagents(getCustomReagents());
    setIsEditingCustomReagent(false);
    toast({
      title: t('msgSaved'),
      description: t('successCustomSaved')
    });
  };

  const handleDeleteCustomReagent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomReagent(id);
    setCustomReagents(getCustomReagents());
    toast({
      title: t('successCustomDeleted'),
      description: t('successCustomDeleted')
    });
  };

  // Theme state
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // Synthesis Details State
  const [synthTitle, setSynthTitle] = useState("");
  const [synthNumber, setSynthNumber] = useState("");
  const [synthFormula, setSynthFormula] = useState("");
  const [synthSmiles, setSynthSmiles] = useState("");
  const [synthMolfile, setSynthMolfile] = useState("");
  const [synthProductName, setSynthProductName] = useState("");
  const [synthProductMass, setSynthProductMass] = useState("");
  const [synthProductMassUnit, setSynthProductMassUnit] = useState<"mg" | "g">("g");
  const [synthYield, setSynthYield] = useState("");
  const [synthProcedure, setSynthProcedure] = useState("");
  const [customSections, setCustomSections] = useState<CustomSectionData[]>([]);
  const [synthReaction, setSynthReaction] = useState("");
  const [synthReactionScheme, setSynthReactionScheme] = useState<ReactionSchemeData>(emptyReactionScheme());

  // Product Moles calculation
  const synthProductMoles = React.useMemo(() => {
    if (!synthProductMass || !synthFormula) return null;
    
    // Try to calculate molar mass of product formula
    const mw = calculate_molar_mass(synthFormula);
    if (mw === 0) return null;

    const mass = parseFloat(synthProductMass);
    if (isNaN(mass)) return null;

    // Convert mass to mg for calculation
    const massMg = synthProductMassUnit === "g" ? mass * 1000 : mass;
    const molesMmol = massMg / mw;

    // Return string formatted appropriately
    if (molesMmol >= 1000) {
      return `${(molesMmol / 1000).toFixed(3)} mol`;
    }
    return `${molesMmol.toFixed(3)} mmol`;
  }, [synthProductMass, synthFormula, synthProductMassUnit]);

  // Current input state
  const [inputName, setInputName] = useState("");
  const [inputLabel, setInputLabel] = useState("");
  const [inputSmiles, setInputSmiles] = useState("");
  const [inputMolfile, setInputMolfile] = useState("");
  const [isStructureEditorOpen, setIsStructureEditorOpen] = useState<"reagent" | "product" | "custom" | "reaction" | false>(false);
  const [molarMass, setMolarMass] = useState<number>(0);
  const [properties, setProperties] = useState<ChemicalProperties | null>(null);
  const [isLoadingProps, setIsLoadingProps] = useState(false);
  
  // Calculation mode: 'mass' (calculate moles/eq from mass), 'moles', 'eq', 'volume'
  const [calcMode, setCalcMode] = useState<"mass" | "moles" | "eq" | "volume">("mass");
  
  // Input values for calculation
  const [inputValue, setInputValue] = useState<string>("");
  const [density, setDensity] = useState<string>("");

  // Units
  const [massUnit, setMassUnit] = useState<"mg" | "g">("mg");
  const [molesUnit, setMolesUnit] = useState<"mmol" | "mol">("mmol");
  const [volumeUnit, setVolumeUnit] = useState<"mL" | "uL">("mL");
  
  // Clear temporary PDF export data on mount to free up 5MB of localStorage
  useEffect(() => {
    try {
      localStorage.removeItem("chemcalc_pdf_export");
    } catch (e) {}
  }, []);

  // Solution mode
  const [isSolution, setIsSolution] = useState(false);
  const [concentrationM, setConcentrationM] = useState<string>("");
  const [concentrationWt, setConcentrationWt] = useState<string>("");
  const [concentrationInputMode, setConcentrationInputMode] = useState<"M" | "wt" | null>(null);
  const [suggestedDensity, setSuggestedDensity] = useState<{percent: number, density: number} | null>(null);
  const [availablePercents, setAvailablePercents] = useState<number[]>([]);

  // Auto-suggest density for solutions
  useEffect(() => {
    let percents: number[] = [];
    if (properties?.formula) {
        let lookupFormula = properties.formula;
        if (properties.name) {
            if (properties.name.toLowerCase().includes('acetic acid')) lookupFormula = 'CH3COOH';
            if (properties.name.toLowerCase().includes('formic acid')) lookupFormula = 'HCOOH';
            if (properties.name.toLowerCase().includes('hydrogen peroxide')) lookupFormula = 'H2O2';
        }
        
        const table = ACID_DENSITIES[lookupFormula];
        if (table) {
            percents = Object.keys(table).map(Number).sort((a, b) => a - b);
        }
    }
    setAvailablePercents(percents);

    if (isSolution && properties?.formula && concentrationWt) {
      const wt = parseFloat(concentrationWt);
      if (!isNaN(wt)) {
        // Some formulas in DB might not exactly match the keys in densityDb, try direct match or special cases
        let lookupFormula = properties.formula;
        if (properties.name) {
            if (properties.name.toLowerCase().includes('acetic acid')) lookupFormula = 'CH3COOH';
            if (properties.name.toLowerCase().includes('formic acid')) lookupFormula = 'HCOOH';
            if (properties.name.toLowerCase().includes('hydrogen peroxide')) lookupFormula = 'H2O2';
        }
        
        const closest = getClosestDensity(lookupFormula, wt);
        if (closest) {
          setSuggestedDensity(closest);
          return;
        }
      }
    }
    setSuggestedDensity(null);
  }, [concentrationWt, properties, isSolution]);

  const applySuggestedDensity = () => {
    if (suggestedDensity) {
      setDensity(suggestedDensity.density.toString());
      setConcentrationWt(suggestedDensity.percent.toString());
      setConcentrationInputMode("wt");
      toast({
        title: t('successDensityApplied'),
        description: `${t('helpDensity')} ${suggestedDensity.density} g/mL ${t('helpDensityFor')} ${suggestedDensity.percent}% ${t('helpSolution')}`
      });
    }
  };

  // Handle unit changes appropriately
  useEffect(() => {
    // If calcMode changes, ensure input value corresponds correctly to unit
  }, [calcMode]);
  
  // Reference entry for equivalents calculation
  const referenceEntry = entries.find(e => e.isReference);

  // Auto-calculate molar mass and properties when input changes
  useEffect(() => {
    let isMounted = true;

    async function fetchProps() {
      const lookupQuery = inputSmiles.trim() || inputName.trim();

      if (lookupQuery) {
        setIsLoadingProps(true);
        const props = await get_properties_async(lookupQuery);
        
        if (!isMounted) return;

        setProperties(props);
        
        if (props) {
          if (props.formula && !props.formula.includes('=') && !props.formula.includes('\\') && !props.formula.includes('/')) {
            setMolarMass(calculate_molar_mass(props.formula));
          } else if (props.mw) {
            setMolarMass(props.mw);
          } else {
             setMolarMass(calculate_molar_mass(props.formula || inputName));
          }
          if (props.density) setDensity(props.density.toString());
          
          // Auto-detect acids/bases for solution mode
          const nameLower = (props.name || "").toLowerCase();
          const formulaLower = (props.formula || "").toLowerCase();
          if (
            nameLower.includes("acid") || nameLower.includes("кислота") || 
            formulaLower.includes("hcl") || formulaLower.includes("h2so4") || formulaLower.includes("hno3") || formulaLower.includes("h3po4") ||
            nameLower.includes("hydroxide") || nameLower.includes("гидроксид") ||
            formulaLower.includes("naoh") || formulaLower.includes("koh") || formulaLower.includes("lioh") ||
            nameLower.includes("ammonia") || nameLower.includes("аммиак")
          ) {
             // Don't auto-enable, but could be a hint
          }
        } else {
          setMolarMass(calculate_molar_mass(inputName));
          setDensity("");
        }
        setIsLoadingProps(false);
      } else {
        setMolarMass(0);
        setProperties(null);
        setDensity("");
        setIsLoadingProps(false);
      }
    }

    const timer = setTimeout(() => {
      fetchProps();
    }, 500); // 500ms debounce to prevent API spam

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [inputName, inputSmiles]);

  const handleAddEntry = () => {
    if (!inputName.trim() || molarMass === 0) {
      toast({
        title: t('error'),
        description: t('errorInvalidName'),
        variant: "destructive"
      });
      return;
    }

    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) {
      toast({
        title: t('error'),
        description: t('errorInvalidValue'),
        variant: "destructive"
      });
      return;
    }

    const isFirst = entries.length === 0;
    const dens = parseFloat(density);
    const hasDensity = !isNaN(dens) && dens > 0;
    const concM = parseFloat(concentrationM);
    const hasConcM = !isNaN(concM) && concM > 0;
    const concWt = parseFloat(concentrationWt);
    const hasConcWt = !isNaN(concWt) && concWt > 0;

    let newMass: number | undefined;
    let newMoles: number | undefined;
    let newEq: number | undefined;
    let volume: number | undefined;
    let solutionMass: number | undefined;
    let finalConcentrationM: number | undefined;
    let finalConcentrationWt: number | undefined;

    if (calcMode === "mass") {
      const massInMg = massUnit === "g" ? val * 1000 : val;
      newMass = massInMg;
      newMoles = massInMg / molarMass;
    } else if (calcMode === "moles") {
      const molesInMmol = molesUnit === "mol" ? val * 1000 : val;
      newMoles = molesInMmol;
      newMass = molesInMmol * molarMass;
    } else if (calcMode === "eq") {
      if (isFirst) {
        newEq = 1;
        const baseMoles = molesUnit === "mol" ? 1000 : 1;
        newMoles = val * baseMoles;
        newMass = newMoles * molarMass;
      } else if (referenceEntry?.moles) {
        newEq = val;
        newMoles = val * referenceEntry.moles;
        newMass = newMoles * molarMass;
      } else {
        toast({
          title: t('error'),
          description: t('errorNoReference'),
          variant: "destructive"
        });
        return;
      }
    } else if (calcMode === "volume") {
      const volumeInMl = volumeUnit === "uL" ? val / 1000 : val;
      volume = volumeInMl;

      if (isSolution) {
        if (concentrationInputMode === "wt") {
          if (!hasDensity) {
            toast({
              title: t('error'),
              description: t('errorVolumeNeedsDensity'),
              variant: "destructive"
            });
            return;
          }
          if (!hasConcWt) {
            toast({
              title: t('error'),
              description: t('errorSolutionNeedsConcentration'),
              variant: "destructive"
            });
            return;
          }
          solutionMass = volumeInMl * dens * 1000;
          newMass = solutionMass * (concWt / 100);
          newMoles = newMass / molarMass;
          finalConcentrationWt = concWt;
        } else {
          if (!hasConcM) {
            toast({
              title: t('error'),
              description: t('errorSolutionNeedsConcentration'),
              variant: "destructive"
            });
            return;
          }
          newMoles = volumeInMl * concM;
          newMass = newMoles * molarMass;
          finalConcentrationM = concM;
          if (hasDensity) {
            solutionMass = volumeInMl * dens * 1000;
          }
        }
      } else {
        if (!hasDensity) {
          toast({
            title: t('error'),
            description: t('errorVolumeNeedsDensity'),
            variant: "destructive"
          });
          return;
        }
        newMass = volumeInMl * dens * 1000;
        newMoles = newMass / molarMass;
      }
    }

    if (newEq === undefined) {
      if (isFirst) {
        newEq = 1;
      } else if (referenceEntry?.moles && newMoles !== undefined) {
        newEq = newMoles / referenceEntry.moles;
      }
    }

    if (isSolution && calcMode !== "volume") {
      if (concentrationInputMode === "wt") {
        if (hasConcWt && newMass !== undefined) {
          solutionMass = newMass / (concWt / 100);
          if (hasDensity) {
            volume = (solutionMass / 1000) / dens;
          }
          finalConcentrationWt = concWt;
        }
      } else if (hasConcM && newMoles !== undefined) {
        volume = newMoles / concM;
        finalConcentrationM = concM;
        if (hasDensity) {
          solutionMass = volume * dens * 1000;
        }
      } else if (hasDensity && newMass !== undefined) {
        volume = (newMass / 1000) / dens;
      }
    } else if (!isSolution && calcMode !== "volume" && hasDensity && newMass !== undefined) {
      volume = (newMass / 1000) / dens;
    }

    const hasManualStructure = Boolean(inputMolfile || inputSmiles);
    const mergedProperties = {
      ...properties,
      smiles: inputSmiles || properties?.smiles,
      molfile: inputMolfile || properties?.molfile,
      cid: hasManualStructure ? undefined : properties?.cid,
    } as ChemicalProperties;

    const newEntry: ReagentEntry = {
      id: uuidv4(),
      nameOrFormula: inputLabel.trim() || resolveReagentLabel(inputName, properties),
      molarMass,
      mass: newMass,
      massUnit: "mg",
      moles: newMoles,
      molesUnit: "mmol",
      equivalents: newEq,
      density: hasDensity ? dens : undefined,
      volume,
      isReference: isFirst,
      properties: mergedProperties,
      molfile: inputMolfile || properties?.molfile,
      structureSource: inputMolfile ? "local-molfile" : inputSmiles ? "local-smiles" : properties?.cid ? "pubchem" : properties?.smiles ? "local-smiles" : undefined,
      isSolution: isSolution && (finalConcentrationM !== undefined || finalConcentrationWt !== undefined),
      concentrationM: finalConcentrationM,
      concentrationWt: finalConcentrationWt,
      solutionMass
    };

    setEntries([...entries, newEntry]);
    
    setInputName("");
    setInputLabel("");
    setInputSmiles("");
    setInputMolfile("");
    setInputValue("");
    setDensity("");
    setConcentrationM("");
    setConcentrationWt("");
    setConcentrationInputMode(null);
    toast({
      title: t('successReagentAdded'),
      description: `${newEntry.nameOrFormula} ${t('successReagentAdded')}`
    });
  };

  const handleEditEntry = (entry: ReagentEntry) => {
    setInputName(getEntryLookupValue(entry));
    setInputLabel(entry.nameOrFormula);
    if (entry.properties?.smiles) {
        setInputSmiles(entry.properties.smiles);
    } else {
        setInputSmiles("");
    }
    if (entry.molfile || entry.properties?.molfile) {
        setInputMolfile(entry.molfile || entry.properties?.molfile || "");
    } else {
        setInputMolfile("");
    }
    setCalcMode("mass");
    setVolumeUnit("mL");
    
    if (entry.isSolution) {
      setIsSolution(true);
      setConcentrationM(entry.concentrationM !== undefined ? entry.concentrationM.toString() : "");
      setConcentrationWt(entry.concentrationWt !== undefined ? entry.concentrationWt.toString() : "");
      setConcentrationInputMode(entry.concentrationWt !== undefined ? "wt" : entry.concentrationM !== undefined ? "M" : null);
      setDensity(entry.density !== undefined ? entry.density.toString() : "");
      
      if (entry.moles !== undefined) {
        setCalcMode("moles");
        if (entry.moles >= 1000) {
          setInputValue((entry.moles / 1000).toString());
          setMolesUnit("mol");
        } else {
          setInputValue(entry.moles.toString());
          setMolesUnit("mmol");
        }
      }
    } else {
      setIsSolution(false);
      setConcentrationM("");
      setConcentrationWt("");
      setConcentrationInputMode(null);
      setDensity(entry.density !== undefined ? entry.density.toString() : "");
      
      if (entry.mass !== undefined) {
        setCalcMode("mass");
        if (entry.mass >= 1000) {
          setInputValue((entry.mass / 1000).toString());
          setMassUnit("g");
        } else {
          setInputValue(entry.mass.toString());
          setMassUnit("mg");
        }
      } else if (entry.moles !== undefined) {
        setCalcMode("moles");
        if (entry.moles >= 1000) {
          setInputValue((entry.moles / 1000).toString());
          setMolesUnit("mol");
        } else {
          setInputValue(entry.moles.toString());
          setMolesUnit("mmol");
        }
      }
    }
    
    handleRemove(entry.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemove = (id: string) => {
    const newEntries = entries.filter(e => e.id !== id);
    // If we removed the reference, make the new first item the reference and recalculate
    if (entries.find(e => e.id === id)?.isReference && newEntries.length > 0) {
      newEntries[0].isReference = true;
      const newRefMoles = newEntries[0].moles;
      
      // Recalculate equivalents for all other entries
      if (newRefMoles) {
        newEntries.forEach(e => {
            if (e.moles) {
                e.equivalents = e.moles / newRefMoles;
            }
        });
      }
    }
    setEntries(newEntries);
  };

  const handleSetReference = (id: string) => {
    const updated = entries.map(e => ({
      ...e,
      isReference: e.id === id
    }));
    
    const newRef = updated.find(e => e.isReference);
    if (newRef?.moles) {
      updated.forEach(e => {
        if (e.moles) {
          e.equivalents = e.moles / newRef.moles!;
        }
      });
    }
    setEntries(updated);
  };

  // Helper to format formula (subscripts)
  const formatFormula = (formula?: string) => {
    if (!formula) return null;
    // Basic regex to wrap numbers in a span with a smaller class
    const parts = formula.split(/([0-9]+(?:\.[0-9]+)?)/);
    return (
      <span className="chem-formula">
        {parts.map((part, i) => {
          if (/^[0-9]+(?:\.[0-9]+)?$/.test(part)) {
            return <span key={i} className="chem-sub">{part}</span>;
          }
          return part;
        })}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8 flex flex-col items-center">
      {/* Hidden File Input for Excel Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".xlsx, .xls, .csv, .txt" 
        onChange={handleFileUpload} 
      />
      
      {/* iOS Style Header */}
      <header className="sticky top-0 w-full z-10 glass-panel px-4 py-4 md:py-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Sheet open={isMobileHistoryOpen} onOpenChange={setIsMobileHistoryOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden mr-1">
                <List className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  {t('headerHistory')}
                </SheetTitle>
                <SheetDescription>
                  {t('uiInventoryDesc')}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-4">
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 justify-start gap-2" onClick={() => {
                    handleNewSynthesis();
                    setIsMobileHistoryOpen(false);
    setIsDesktopHistoryOpen(false);
                  }}>
                    <Plus className="w-4 h-4" />
                    {t('uiNew')}
                  </Button>
                  <Button variant="outline" className="flex-1 justify-start gap-2 text-foreground" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4" />
                    Excel
                  </Button>
                </div>

                <div className="rounded-lg border p-3 bg-card/50 flex flex-col gap-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <DownloadCloud className="w-3.5 h-3.5 text-primary" />
                    {t('uiSyncGSheets')}
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                        placeholder={t('uiPasteUrl')} 
                        value={gsheetsUrl} 
                        onChange={e => setGSheetsUrl(e.target.value)}
                        className="h-8 text-xs font-mono"
                    />
                    <Button 
                      size="sm" 
                      className="h-8 px-3 flex gap-1.5 items-center transition-all"
                      onClick={handleGSheetsSync} 
                      disabled={isSyncingGSheets}
                    >
                        {isSyncingGSheets ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        <span className="text-xs hidden sm:inline">{t('uiLoad')}</span>
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{t('uiPasteDesc')}</p>
                </div>

                <Separator />
                <ScrollArea className="h-[calc(100vh-200px)]">
                  {savedSyntheses.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      {t('uiNoSavedSynthesis')}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 pr-4">
                      {savedSyntheses.map(synth => (
                        <div 
                          key={synth.id}
                          className={`relative group flex flex-col p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50 ${currentSynthesisId === synth.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                          onClick={() => loadSynthesis(synth)}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-sm pr-16">
                              {synth.details.title || t('uiUnnamed')}
                            </span>
                            <div className="absolute top-2 right-2 flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-muted-foreground hover:text-primary bg-background/80 hover:bg-accent backdrop-blur-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  loadSynthesis(synth, true);
                                }}
                                title={t('uiCreateCopy')}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-muted-foreground hover:text-destructive bg-background/80 hover:bg-accent backdrop-blur-sm"
                                onClick={(e) => handleDeleteSynthesis(synth.id, e)}
                                title={t('uiDelete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground truncate">
                            {synth.details.productName || t('uiProductNotSpecified')}
                          </span>
                          <div className="flex justify-between items-center mt-2 text-[10px] text-muted-foreground">
                            <span>{new Date(synth.updatedAt).toLocaleDateString()}</span>
                            <span>{synth.entries.length} {t('uiReagentsCount')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </SheetContent>
          </Sheet>

          <div className="bg-primary/10 p-2 rounded-xl">
             <FlaskConical className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight hidden sm:block">Phlogiston</h1>
        </div>
        <div className="flex items-center gap-2">
           <Sheet>
             <SheetTrigger asChild>
               <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                 <Info className="w-5 h-5" />
               </Button>
             </SheetTrigger>
             <SheetContent side="bottom" className="h-[85vh] sm:h-[85vh] sm:max-w-2xl mx-auto rounded-t-xl sm:rounded-xl sm:mb-8 flex flex-col p-0">
                <div className="px-6 pt-6 pb-2">
                  <SheetHeader>
                    <SheetTitle className="text-xl">{t('helpHowItWorks')}</SheetTitle>
                    <SheetDescription>
                      {t('helpShortInstruction')}
                    </SheetDescription>
                  </SheetHeader>
                </div>
                    <ScrollArea className="flex-1 px-6 pb-6 overflow-y-auto">
                  <div className="space-y-6 text-sm">
                    {/* Введение и безопасность */}
                    <div className="space-y-3">
                      <p className="text-muted-foreground leading-relaxed">
                        {t('helpIntroText')}
                      </p>
                      <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg mt-3">
                        <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-primary" />
                          {t('helpWhySafeTitle')}
                        </p>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {t('helpWhySafeText')}
                        </p>
                      </div>

                      <div className="bg-destructive/10 p-3 rounded-md border border-destructive/20 mt-3">
                        <p className="font-semibold text-destructive mb-1 flex items-center gap-1.5 text-xs">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {t('legalDisclaimerTitle')}
                        </p>
                        <p className="text-destructive/80 text-[11px] leading-relaxed">
                          {t('legalDisclaimerText')}
                        </p>
                      </div>
                    </div>

                    <Separator />

                  {/* Функционал */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-lg text-foreground mb-2">{t('helpHowToUse')}</h4>
                    
                    <div className="space-y-3">
                      <h5 className="font-medium text-foreground flex items-center gap-2">
                        <Database className="w-4 h-4 text-primary" />
                        {t('helpLoadInventory')}
                      </h5>
                      <p className="text-muted-foreground leading-relaxed">
                        {t('helpLoadInventoryText')}
                      </p>
                      
                      <div className="pl-3 border-l-2 border-border space-y-3">
                        <div>
                          <p className="font-medium flex items-center gap-1.5 text-foreground"><DownloadCloud className="w-4 h-4 text-primary" /> {t('helpSyncGSheets')}</p>
                          <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                            {t('helpSyncGSheetsStep1')}<br/>
                            {t('helpSyncGSheetsStep2')}<br/>
                            {t('helpSyncGSheetsStep3')}<br/>
                            {t('helpSyncGSheetsStep4')}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium flex items-center gap-1.5 text-foreground"><Upload className="w-4 h-4 text-primary" /> {t('helpSyncExcel')}</p>
                          <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                            {t('helpSyncExcelText')}
                          </p>
                        </div>
                      </div>

                      <div className="bg-muted p-3 rounded-md mt-2">
                        <p className="font-semibold mb-1 text-xs">{t('helpTableHeaderDesc')}</p>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {t('helpHeadersLine1')}<br/>
                          <code className="text-foreground font-mono bg-background px-1 py-0.5 rounded border border-border/50">{t('helpHeadersLine2')}</code><br/>
                          {t('helpHeadersLine3')}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h5 className="font-medium text-foreground flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-primary" />
                        {t('helpCalcTitle')}
                      </h5>
                      <p className="text-muted-foreground leading-relaxed">
                        {t('helpCalcText1')}
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        {t('helpSolutionMode')}
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h5 className="font-medium text-foreground flex items-center gap-2">
                        <History className="w-4 h-4 text-primary" />
                        {t('helpHistory')}
                      </h5>
                      <p className="text-muted-foreground leading-relaxed">
                        {t('helpSave')}
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h5 className="font-medium text-foreground flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-primary" />
                        {t('helpEditorTitle')}
                      </h5>
                      <p className="text-muted-foreground leading-relaxed">
                        {t('helpEditorText')}
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h5 className="font-medium text-foreground flex items-center gap-2">
                        <DownloadCloud className="w-4 h-4 text-primary" />
                        {t('helpOfflineTitle')}
                      </h5>
                      <div className="text-muted-foreground leading-relaxed">
                        <p>{t('helpOfflineText')}</p>
                        <a
                          href={downloadUrl}
                          download="phlogiston.zip"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium inline-flex items-center gap-1 mt-2"
                          data-testid="link-download-offline-zip"
                        >
                          <DownloadCloud className="w-3 h-3" />
                          {lang === 'ru' ? 'Скачать Phlogiston.zip + инструкция' : 'Download Phlogiston.zip + install guide'}
                        </a>
                        <p className="text-xs mt-2" data-testid="text-install-guide-note">
                          {lang === 'ru'
                            ? 'В архив уже добавлен файл INSTALL_PHLOGISTON.txt с инструкцией по запуску и командами для скачивания через терминал на macOS и Windows.'
                            : 'The archive already includes INSTALL_PHLOGISTON.txt with launch instructions and terminal download commands for macOS and Windows.'}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                          <div className="rounded-xl border border-border/50 bg-background/80 p-3 space-y-2">
                            <p className="text-xs font-semibold text-foreground">macOS Terminal</p>
                            <p className="text-[11px] text-muted-foreground">
                              {lang === 'ru' ? 'Скачать архив:' : 'Download archive:'}
                            </p>
                            <code className="block rounded-lg bg-secondary/60 px-3 py-2 text-[11px] break-all text-foreground" data-testid="text-command-macos-download">{macDownloadCommand}</code>
                            <p className="text-[11px] text-muted-foreground">
                              {lang === 'ru' ? 'Распаковать:' : 'Extract:'}
                            </p>
                            <code className="block rounded-lg bg-secondary/60 px-3 py-2 text-[11px] break-all text-foreground" data-testid="text-command-macos-extract">{macExtractCommand}</code>
                            <p className="text-[11px] text-muted-foreground">
                              {lang === 'ru' ? 'Запустить локально:' : 'Run locally:'}
                            </p>
                            <code className="block rounded-lg bg-secondary/60 px-3 py-2 text-[11px] break-all text-foreground" data-testid="text-command-macos-run">{macRunCommand}</code>
                          </div>

                          <div className="rounded-xl border border-border/50 bg-background/80 p-3 space-y-2">
                            <p className="text-xs font-semibold text-foreground">Windows PowerShell</p>
                            <p className="text-[11px] text-muted-foreground">
                              {lang === 'ru' ? 'Скачать архив:' : 'Download archive:'}
                            </p>
                            <code className="block rounded-lg bg-secondary/60 px-3 py-2 text-[11px] break-all text-foreground" data-testid="text-command-windows-download">{windowsDownloadCommand}</code>
                            <p className="text-[11px] text-muted-foreground">
                              {lang === 'ru' ? 'Распаковать:' : 'Extract:'}
                            </p>
                            <code className="block rounded-lg bg-secondary/60 px-3 py-2 text-[11px] break-all text-foreground" data-testid="text-command-windows-extract">{windowsExtractCommand}</code>
                            <p className="text-[11px] text-muted-foreground">
                              {lang === 'ru' ? 'Запустить локально:' : 'Run locally:'}
                            </p>
                            <code className="block rounded-lg bg-secondary/60 px-3 py-2 text-[11px] break-all text-foreground" data-testid="text-command-windows-run">{windowsRunCommand}</code>
                          </div>
                        </div>

                        <p className="text-xs mt-3" data-testid="text-offline-open-url">
                          {lang === 'ru'
                            ? 'После запуска откройте: http://localhost:8000'
                            : 'After launching, open: http://localhost:8000'}
                        </p>
                      </div>
                    </div>

                  <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg mt-4">
                    <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                      <WifiOff className="w-4 h-4 text-primary" />
                      {t('helpOfflineModeTitle')}
                    </p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {t('helpOfflineModeText')}
                    </p>
                  </div>

                  <Separator className="my-4" />

                  {/* New Features & Downloads */}
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <h5 className="font-medium text-foreground flex items-center gap-2">
                        <Download className="w-4 h-4 text-primary" />
                        {t('helpDownloadTitle')}
                      </h5>
                      <div className="text-muted-foreground leading-relaxed flex flex-col gap-3">
                        <p>{t('helpDownloadText')}</p>
                        <div className="flex flex-col sm:flex-row gap-3 mt-1">
                          <a
                            href={`${import.meta.env.BASE_URL}phlogiston.zip`}
                            download="phlogiston.zip"
                            className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-4 py-2.5 rounded-md font-medium inline-flex items-center justify-center gap-2 text-sm shadow-sm"
                            data-testid="link-download-pwa"
                          >
                            <Download className="w-4 h-4" />
                            {t('btnDownloadPwa')}
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mt-6">
                      <h5 className="font-medium text-foreground flex items-center gap-2">
                        <Star className="w-4 h-4 text-primary fill-primary/20" />
                        {t('helpNewFeaturesTitle')}
                      </h5>
                      <ul className="text-muted-foreground leading-relaxed list-disc pl-5 space-y-1.5 text-sm">
                        <li>{t('helpNewFeaturesText1')}</li>
                        <li>{t('helpNewFeaturesText2')}</li>
                        <li>{t('helpNewFeaturesText3')}</li>
                      </ul>
                    </div>
                  </div>

                  </div>
                  </div>
                </ScrollArea>
             </SheetContent>
           </Sheet>

           {/* Desktop History Button */}
           <div className="hidden md:block">
             <Sheet open={isDesktopHistoryOpen} onOpenChange={setIsDesktopHistoryOpen}>
               <SheetTrigger asChild>
                 <Button variant="outline" size="sm" className="flex gap-2">
                   <History className="w-4 h-4" />
                   {t('headerHistory')}
                 </Button>
               </SheetTrigger>
               <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <History className="w-5 h-5" />
                      {t('headerHistory')}
                    </SheetTitle>
                    <SheetDescription>
                      Ваши сохраненные расчеты
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 flex flex-col gap-4">
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 justify-start gap-2" onClick={() => {
                        handleNewSynthesis();
                        setIsDesktopHistoryOpen(false);
                      }}>
                        <Plus className="w-4 h-4" />
                        Новый
                      </Button>
                      <Button variant="outline" className="flex-1 justify-start gap-2" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4" />
                        База (Excel)
                      </Button>
                    </div>

                    <div className="rounded-lg border p-3 bg-card/50 flex flex-col gap-2">
                      <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                        <DownloadCloud className="w-3.5 h-3.5 text-primary" />
                        Синхронизация Google Sheets (Инвентарь)
                      </Label>
                      <div className="flex gap-2">
                        <Input 
                            placeholder="Вставьте ссылку на CSV..." 
                            value={gsheetsUrl} 
                            onChange={e => setGSheetsUrl(e.target.value)}
                            className="h-8 text-xs font-mono"
                        />
                        <Button 
                          size="sm" 
                          className={`h-8 px-3 flex gap-1.5 items-center transition-all ${!gsheetsUrl ? 'opacity-50' : 'opacity-100'}`}
                          onClick={handleGSheetsSync} 
                          disabled={isSyncingGSheets || !gsheetsUrl}
                          variant={gsheetsUrl ? "default" : "secondary"}
                        >
                            {isSyncingGSheets ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            <span className="text-xs hidden sm:inline">{t('uiLoad')}</span>
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{t('uiPasteDesc')}</p>
                    </div>

                    <Separator />
                    <ScrollArea className="h-[calc(100vh-200px)]">
                      {savedSyntheses.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-8">
                          {t('uiNoSavedSynthesis')}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 pr-4">
                          {savedSyntheses.map(synth => (
                            <div 
                              key={synth.id}
                              className={`relative group flex flex-col p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50 ${currentSynthesisId === synth.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                              onClick={() => loadSynthesis(synth)}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-sm truncate pr-16">
                                  {synth.details.title || t('uiUnnamed')}
                                </span>
                                <div className="absolute top-2 right-2 flex gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-primary bg-background/50 hover:bg-accent backdrop-blur-sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      loadSynthesis(synth, true);
                                    }}
                                    title={t('uiCreateCopy')}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive bg-background/50 hover:bg-accent backdrop-blur-sm"
                                    onClick={(e) => handleDeleteSynthesis(synth.id, e)}
                                    title={t('uiDelete')}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground truncate">
                                {synth.details.productName || t('uiProductNotSpecified')}
                              </span>
                              <div className="flex justify-between items-center mt-2 text-[10px] text-muted-foreground">
                                <span>{new Date(synth.updatedAt).toLocaleDateString()}</span>
                                <span>{synth.entries.length} {t('uiReagentsCount')}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
               </SheetContent>
             </Sheet>
           </div>
           
           <div className="flex items-center ml-2">
             <Button variant="ghost" size="icon" onClick={toggleLang} className="text-muted-foreground hover:text-foreground font-semibold text-xs h-8 w-8">
               {lang === 'ru' ? 'EN' : 'RU'}
             </Button>

             <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground hover:text-foreground h-8 w-8">
               {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
             </Button>
           </div>

           {entries.length > 0 && (
             <div className="hidden md:flex items-center gap-2">
               <Button variant="default" size="sm" className="gap-2" onClick={handleSaveSynthesis} data-testid="button-save-synthesis">
                 <Save className="w-4 h-4" />
                 {t('headerSave')}
               </Button>
               <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                const rootElement = document.getElementById("root");
                if (rootElement) {
                  openPublicationPdf(entries, buildSynthesisDetails(), lang, findLocation, rootElement);
                } else {
                  openPublicationPdf(entries, buildSynthesisDetails(), lang, findLocation);
                }
              }} data-testid="button-export-pdf">
                  <FileText className="w-4 h-4" />
                  PDF
               </Button>
               <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToTxt(entries, buildSynthesisDetails(), findLocation)} data-testid="button-export-txt">
                  <Download className="w-4 h-4" />
                  TXT
               </Button>
               <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToCsv(entries, buildSynthesisDetails(), findLocation)} data-testid="button-export-csv">
                  <Download className="w-4 h-4" />
                  CSV
               </Button>
             </div>
           )}
        </div>
      </header>

      <main className="w-full max-w-4xl px-4 mt-6 flex flex-col md:flex-row gap-6">
        
        {/* Input Section */}
        <section className="w-full md:w-1/3 flex flex-col gap-4">
          <Card className="border-0 shadow-md ring-1 ring-border/50 overflow-hidden">
            <div className="bg-primary/5 p-4 border-b border-border/50">
               <CardTitle className="text-lg flex items-center gap-2">
                 <Plus className="w-5 h-5 text-primary" />
                 {t('uiNewReagent')}
               </CardTitle>
            </div>
            <CardContent className="p-4 flex flex-col gap-5 pt-6">
              <div className="space-y-2">
                <Label htmlFor="formula" className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                  {t('uiSubstanceLabel')}
                </Label>
                <div className="flex gap-2 items-start">
                  <div className="relative flex-1 flex flex-col gap-1">
                    <Input 
                      id="formula"
                      placeholder={t('uiExampleDcm')} 
                      value={inputName}
                      onChange={(e) => setInputName(e.target.value)}
                      className="text-lg py-6 bg-secondary/50 border-secondary-foreground/10 focus-visible:ring-primary"
                      data-testid="input-formula"
                    />
                    <div className="flex justify-end min-h-[24px]">
                      {isLoadingProps ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs pr-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{t('uiSearching')}</span>
                        </div>
                      ) : molarMass > 0 ? (
                         <div className="bg-background shadow-sm px-2 py-1 rounded-md text-xs font-mono font-medium text-primary border border-border inline-block">
                           {molarMass} g/mol
                         </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="h-[56px] w-[56px] shrink-0 border-secondary-foreground/20 hover:bg-secondary"
                      onClick={() => setIsStructureEditorOpen("reagent")}
                      title={t('drawStructure')}
                      data-testid="button-draw-structure"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary-foreground"><path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21"/><path d="m14 19.5 3-3 3 3"/><path d="m17 22.5-3-3"/></svg>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="display-name" className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                  {t('uiName')} ({t('uiOptional')})
                </Label>
                <Input
                  id="display-name"
                  placeholder={t('uiExName')}
                  value={inputLabel}
                  onChange={(e) => setInputLabel(e.target.value)}
                  className="py-5 bg-background"
                  data-testid="input-display-name"
                />
              </div>

              {/* Physical Properties Card - Appears when found */}
              <div className={`transition-all duration-300 overflow-hidden ${properties ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                {properties && (
                  <div className="bg-accent/50 rounded-xl p-3 border border-accent flex gap-3 relative overflow-hidden group">
                    {(properties.cid || properties.smiles) && (
                      <div className="w-16 h-16 shrink-0 bg-white rounded-lg p-1 border shadow-sm flex items-center justify-center overflow-hidden">
                        {properties.cid ? (
                          <img 
                            src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${properties.cid}/PNG?record_type=2d`}
                            alt={`Structure of ${properties.name}`}
                            className="max-w-full max-h-full object-contain mix-blend-multiply"
                          />
                        ) : (
                          <div className="text-[10px] text-muted-foreground text-center leading-tight px-1">{properties.formula}</div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-2 flex-1 justify-center min-w-0">
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-semibold text-accent-foreground text-sm leading-tight break-words whitespace-normal w-full">{properties.name}</span>
                        <div className="flex flex-col gap-2 mt-0.5 w-full">
                          <Badge variant="outline" className="bg-background font-mono text-[10px] px-1.5 py-0 w-fit">{formatFormula(properties.formula)}</Badge>
                          {/* External Link to PubChem moved here */}
                          {properties.cid && (
                            <a 
                              href={`https://pubchem.ncbi.nlm.nih.gov/compound/${properties.cid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-[10px] w-fit"
                              title="Открыть в PubChem"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>PubChem</span>
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-[10px] sm:text-xs mt-1">
                        {properties.density !== undefined && (
                          <div className="flex flex-col bg-background/50 p-1 rounded-md">
                            <span className="text-muted-foreground text-[9px] uppercase tracking-wider">{t('colDensity')}</span>
                            <span className="font-mono font-medium">{properties.density}</span>
                          </div>
                        )}
                        {properties.mp !== undefined && (
                          <div className="flex flex-col bg-background/50 p-1 rounded-md">
                            <span className="text-muted-foreground text-[9px] uppercase tracking-wider">{t('propMp')}</span>
                            <span className="font-mono font-medium">{properties.mp}°C</span>
                          </div>
                        )}
                        {properties.bp !== undefined && (
                          <div className="flex flex-col bg-background/50 p-1 rounded-md">
                            <span className="text-muted-foreground text-[9px] uppercase tracking-wider">{t('propBp')}</span>
                            <span className="font-mono font-medium">{properties.bp}°C</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">{t('calcMode')}</Label>
                <Tabs value={calcMode} onValueChange={(v: any) => setCalcMode(v)} className="w-full">
                  <TabsList className="grid w-full grid-cols-4 bg-secondary/50 p-1 h-auto rounded-xl">
                    <TabsTrigger value="mass" className="py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="button-calc-mode-mass"><Scale className="w-4 h-4 mr-1.5"/>{t('colMass').split(' ')[0]}</TabsTrigger>
                    <TabsTrigger value="moles" className="py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[14px] sm:text-sm" data-testid="button-calc-mode-moles"><Beaker className="w-4 h-4 mr-1 sm:mr-1.5"/>{t('calcModeAmount')}</TabsTrigger>
                    <TabsTrigger value="volume" className="py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="button-calc-mode-volume"><Droplet className="w-4 h-4 mr-1.5"/>{t('calcModeVolume')}</TabsTrigger>
                    <TabsTrigger value="eq" className="py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="button-calc-mode-eq"><Calculator className="w-4 h-4 mr-1.5"/>{t('colEq')}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="value" className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                    {calcMode === 'mass' ? t('calcModeMass') : calcMode === 'moles' ? t('calcModeAmount') : calcMode === 'volume' ? t('calcModeVolume') : t('calcModeEq')}
                  </Label>
                  
                  <div className="h-[32px] flex items-center">
                    {calcMode === 'mass' && (
                      <div className="flex bg-secondary/50 rounded p-1 h-full w-full max-w-[140px]">
                        <button 
                          className={`text-[11px] flex-1 rounded transition-colors ${massUnit === 'mg' ? 'bg-background shadow-sm font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setMassUnit('mg')}
                          data-testid="button-unit-mg"
                        >mg</button>
                        <button 
                          className={`text-[11px] flex-1 rounded transition-colors ${massUnit === 'g' ? 'bg-background shadow-sm font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setMassUnit('g')}
                          data-testid="button-unit-g"
                        >g</button>
                      </div>
                    )}
                    {calcMode === 'moles' && (
                      <div className="flex bg-secondary/50 rounded p-1 h-full w-full max-w-[140px]">
                        <button 
                          className={`text-[11px] flex-1 rounded transition-colors ${molesUnit === 'mmol' ? 'bg-background shadow-sm font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setMolesUnit('mmol')}
                          data-testid="button-unit-mmol"
                        >mmol</button>
                        <button 
                          className={`text-[11px] flex-1 rounded transition-colors ${molesUnit === 'mol' ? 'bg-background shadow-sm font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setMolesUnit('mol')}
                          data-testid="button-unit-mol"
                        >mol</button>
                      </div>
                    )}
                    {calcMode === 'volume' && (
                      <div className="flex bg-secondary/50 rounded p-1 h-full w-full max-w-[140px]">
                        <button 
                          className={`text-[11px] flex-1 rounded transition-colors ${volumeUnit === 'mL' ? 'bg-background shadow-sm font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setVolumeUnit('mL')}
                          data-testid="button-unit-ml"
                        >mL</button>
                        <button 
                          className={`text-[11px] flex-1 rounded transition-colors ${volumeUnit === 'uL' ? 'bg-background shadow-sm font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setVolumeUnit('uL')}
                          data-testid="button-unit-ul"
                        >μL</button>
                      </div>
                    )}
                    {calcMode === 'eq' && (
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-1">{t('colEq').toLowerCase()}</span>
                    )}
                  </div>

                  <Input 
                    id="value"
                    type="number"
                    step="any"
                    placeholder="0.00" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="font-mono text-lg py-5 w-full"
                    data-testid="input-value"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddEntry();
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="density" className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                    {t('colDensity')}
                  </Label>
                  
                  <div className="h-[32px] flex items-center">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-1">g/mL</span>
                  </div>

                  <Input 
                    id="density"
                    type="number"
                    step="any"
                    placeholder={t('uiOptional')} 
                    value={density}
                    onChange={(e) => setDensity(e.target.value)}
                    className="font-mono text-lg py-5 w-full"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddEntry();
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">{t('uiIsSolution')}</Label>
                  <div className="flex bg-secondary/50 rounded p-1">
                    <button 
                      className={`text-xs px-3 py-1 rounded transition-colors ${!isSolution ? 'bg-background shadow-sm font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={() => {
                        setIsSolution(false);
                        setConcentrationM("");
                        setConcentrationWt("");
                        setConcentrationInputMode(null);
                        setSuggestedDensity(null);
                      }}
                      data-testid="button-solution-no"
                    >{t('uiNo')}</button>
                    <button 
                      className={`text-xs px-3 py-1 rounded transition-colors ${isSolution ? 'bg-background shadow-sm font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={() => setIsSolution(true)}
                      data-testid="button-solution-yes"
                    >{t('uiYes')}</button>
                  </div>
                </div>
                
                {isSolution && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <Label htmlFor="concM" className="text-muted-foreground font-medium text-[10px] uppercase tracking-wider">{t('uiMolarity')}</Label>
                      <Input 
                        id="concM"
                        type="number"
                        placeholder={t('uiExMolarity')} 
                        value={concentrationM}
                        onChange={(e) => {
                          setConcentrationM(e.target.value);
                          setConcentrationInputMode(e.target.value ? "M" : null);
                          if (e.target.value) setConcentrationWt("");
                        }}
                        className="font-mono text-sm"
                        data-testid="input-concentration-m"
                      />
                    </div>
                    <div className="space-y-2 relative">
                      <Label htmlFor="concWt" className="text-muted-foreground font-medium text-[10px] uppercase tracking-wider">{t('uiMassPercent')}</Label>
                      <Input 
                        id="concWt"
                        type="number"
                        placeholder={t('uiExPercent')} 
                        value={concentrationWt}
                        onChange={(e) => {
                          const val = e.target.value;
                          setConcentrationWt(val);
                          setConcentrationInputMode(val ? "wt" : null);
                          
                          if (val && density && molarMass > 0) {
                            const wt = parseFloat(val);
                            const d = parseFloat(density);
                            if (!isNaN(wt) && !isNaN(d)) {
                              const newMolarity = (wt * d * 10) / molarMass;
                              setConcentrationM(newMolarity.toFixed(2));
                            }
                          } else if (val) {
                             setConcentrationM("");
                          }
                        }}
                        className="font-mono text-sm"
                        data-testid="input-concentration-wt"
                      />
                      
                      {/* Density auto-suggestion UI */}
                      {suggestedDensity && parseFloat(concentrationWt) !== suggestedDensity.percent && (
                        <div className="absolute top-full left-0 right-0 z-10 mt-1 flex flex-col gap-1 bg-primary/10 border border-primary/20 p-2 rounded-lg text-xs shadow-md">
                          <span className="text-foreground/90">Значение из базы:</span>
                          <div className="flex items-center justify-between">
                            <span className="font-medium"><strong className="text-primary">{suggestedDensity.percent}%</strong> (d = {suggestedDensity.density})</span>
                            <Button variant="default" size="sm" className="h-6 px-2 text-[10px] shadow-sm" onClick={applySuggestedDensity}>
                              Применить
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* Available concentrations buttons */}
                      {availablePercents.length > 0 && properties && (
                        <div className="mt-2 flex flex-col gap-1.5">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Выберите концентрацию из базы:</span>
                          <div className="w-full pb-2 overflow-x-auto hide-scrollbar">
                            <div className="flex gap-1.5 w-max px-1">
                              {availablePercents.map(p => {
                                let lookupFormula = properties.formula;
                                if (properties.name) {
                                  if (properties.name.toLowerCase().includes('acetic acid')) lookupFormula = 'CH3COOH';
                                  if (properties.name.toLowerCase().includes('formic acid')) lookupFormula = 'HCOOH';
                                  if (properties.name.toLowerCase().includes('hydrogen peroxide')) lookupFormula = 'H2O2';
                                }
                                const table = ACID_DENSITIES[lookupFormula];
                                if (!table) return null;
                                const d = table[p];
                                
                                return (
                                  <Button 
                                    key={p}
                                    variant={parseFloat(concentrationWt) === p ? "default" : "secondary"} 
                                    size="sm" 
                                    className="h-6 text-[10px] px-2 shrink-0"
                                    onClick={() => {
                                      setConcentrationWt(p.toString());
                                      setConcentrationInputMode("wt");
                                      setDensity(d.toString());
                                      const newMolarity = (p * d * 10) / molarMass;
                                      setConcentrationM(newMolarity.toFixed(2));
                                    }}
                                  >
                                    {p}%
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Button 
                onClick={handleAddEntry} 
                className="w-full mt-4 py-6 text-lg rounded-xl shadow-md hover:shadow-lg transition-all"
                disabled={!inputName || molarMass === 0 || !inputValue}
                data-testid="button-add"
              >
                {t('schemeAdd')}
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Table Section */}
        <section className="w-full md:w-2/3">
          <Card className="border-0 shadow-md ring-1 ring-border/50 h-full flex flex-col overflow-hidden">
            <div className="bg-secondary/20 p-4 border-b border-border/50 flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                {t('uiReagentTable')}
                <Badge variant="secondary" className="ml-2">{entries.length}</Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <SmartPasteModal onAddEntries={(newEntries, pastedText) => {
                  setEntries(prev => [...prev, ...newEntries]);
                  if (pastedText && !synthProcedure) {
                    setSynthProcedure(pastedText);
                  } else if (pastedText) {
                    setSynthProcedure(prev => prev + "\n\n" + pastedText);
                  }
                }} />
                {entries.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setEntries([])}>
                    {t('headerClear')}
                  </Button>
                )}
              </div>
            </div>
            
            <CardContent className="p-0 flex-1 relative">
              <ScrollArea className="h-[500px] w-full md:h-auto md:min-h-[500px]">
                <div className="p-4 space-y-6">
                  <div className="bg-secondary/10 border border-border/50 rounded-xl p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Beaker className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-lg">{t('uiSynthesis')}</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="synthTitle" className="text-xs text-muted-foreground">{t('synthTitle')}</Label>
                        <Input 
                          id="synthTitle" 
                          placeholder={t('uiExTitle')} 
                          value={synthTitle}
                          onChange={(e) => setSynthTitle(e.target.value)}
                          className="h-8"
                          data-testid="input-synth-title"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="synthNumber" className="text-xs text-muted-foreground">{t('synthNumber')}</Label>
                        <Input 
                          id="synthNumber" 
                          placeholder={t('uiExNumber')} 
                          value={synthNumber}
                          onChange={(e) => setSynthNumber(e.target.value)}
                          className="h-8"
                          data-testid="input-synth-number"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t('schemeReactants')}</h4>
                      {entries.length === 0 && (
                        <span className="text-xs text-muted-foreground">{t('uiAddReagentsToStart')}</span>
                      )}
                    </div>

                    {entries.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-secondary/10 p-8 text-center text-muted-foreground">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                          <FlaskConical className="w-6 h-6 opacity-60" />
                        </div>
                        <p className="font-medium text-foreground">{t('uiInventoryEmpty')}</p>
                        <p className="text-sm mt-1">{t('uiAddReagentsToStart')}</p>
                      </div>
                    ) : (
                      entries.map((entry, index) => (
                        <div 
                          key={entry.id} 
                          className={`group relative flex flex-col bg-background rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${entry.isReference ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:justify-between items-start mb-3 gap-2 sm:gap-0">
                            <div className="flex items-center gap-2">
                              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${entry.isReference ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                                {index + 1}
                              </div>
                              <h3 className="font-semibold text-lg flex flex-wrap items-center gap-2 leading-tight">
                                {entry.properties ? entry.properties.name : entry.nameOrFormula}
                                {entry.properties && entry.properties.name !== entry.nameOrFormula && (
                                  <span className="text-xs text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded break-all">
                                    {formatFormula(entry.properties.formula)}
                                  </span>
                                )}
                              </h3>
                            </div>
                            <div className="flex gap-1 mt-3 sm:mt-0 w-full sm:w-auto justify-end">
                              {!entry.isReference && (
                                <Button variant="outline" size="sm" className="h-8 text-muted-foreground hover:text-primary" onClick={() => handleSetReference(entry.id)} title="Сделать референсом (Экв. = 1.0)">
                                  <RefreshCw className="w-4 h-4 mr-1.5 hidden sm:inline" />
                                  <span className="sm:hidden text-xs">Референс</span>
                                </Button>
                              )}
                              <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditEntry(entry)} title="Редактировать">
                                <FileText className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(entry.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {entry.properties && (entry.properties.density !== undefined || entry.properties.mp !== undefined || entry.properties.bp !== undefined) && (
                            <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                              {entry.properties.density !== undefined && (
                                <div className="flex flex-col bg-accent/20 p-1.5 rounded-lg border border-accent/30">
                                  <span className="text-muted-foreground">{t('colDensity')}</span>
                                  <span className="font-mono font-medium">{entry.properties.density} {t('uiGMl')}</span>
                                </div>
                              )}
                              {entry.properties.mp !== undefined && (
                                <div className="flex flex-col bg-accent/20 p-1.5 rounded-lg border border-accent/30">
                                  <span className="text-muted-foreground">{t('propMp')}</span>
                                  <span className="font-mono font-medium">{entry.properties.mp}°C</span>
                                </div>
                              )}
                              {entry.properties.bp !== undefined && (
                                <div className="flex flex-col bg-accent/20 p-1.5 rounded-lg border border-accent/30">
                                  <span className="text-muted-foreground">{t('propBp')}</span>
                                  <span className="font-mono font-medium">{entry.properties.bp}°C</span>
                                </div>
                              )}
                            </div>
                          )}

                          {(() => {
                            const loc = findLocation(entry.nameOrFormula, entry.properties?.formula);
                            if (!loc) return null;
                            return (
                              <div className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary-foreground/90 p-1.5 rounded-lg border border-primary/20 mb-3 w-fit">
                                <MapPin className="w-3.5 h-3.5 text-primary" />
                                <span className="font-medium text-primary">{t('uiLoc')}: {loc}</span>
                              </div>
                            );
                          })()}

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                            <div className="bg-secondary/30 p-2 rounded-lg flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{t('colMW')}</span>
                              <span className="font-mono text-sm">{entry.molarMass.toFixed(2)}</span>
                            </div>
                            
                            <div className="bg-secondary/30 p-2 rounded-lg flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                                {entry.isSolution ? t('propSubstanceMass') : t('propMass')}
                              </span>
                              <span className="font-mono text-sm font-medium">
                                {entry.mass !== undefined ? 
                                  (entry.mass >= 1000 ? `${(entry.mass / 1000).toFixed(2)} g` : `${entry.mass.toFixed(2)} mg`) 
                                  : '-'}
                              </span>
                            </div>

                            <div className="bg-secondary/30 p-2 rounded-lg flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{t('calcModeAmount')}</span>
                              <span className="font-mono text-sm text-primary font-medium">
                                {entry.moles !== undefined ? 
                                  (entry.moles >= 1000 ? `${(entry.moles / 1000).toFixed(3)} mol` : `${entry.moles.toFixed(3)} mmol`) 
                                  : '-'}
                              </span>
                            </div>

                            <div className={`p-2 rounded-lg flex flex-col ${entry.isReference ? 'bg-primary/10' : 'bg-secondary/30'}`}>
                              <span className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${entry.isReference ? 'text-primary' : 'text-muted-foreground'}`}>{t('colEq')}</span>
                              <span className="font-mono text-sm font-bold flex items-center gap-1">
                                {entry.equivalents?.toFixed(2) || '-'}
                                {entry.isReference && <span className="text-[10px] bg-primary text-primary-foreground px-1 rounded ml-1">REF</span>}
                              </span>
                            </div>

                            {(entry.volume !== undefined || entry.solutionMass !== undefined) && (
                              <div className="col-span-2 md:col-span-4 mt-1 bg-accent/20 border border-accent/30 p-2 rounded-lg flex flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {(entry.volume !== undefined || entry.solutionMass !== undefined) && <Droplet className="w-4 h-4 text-accent-foreground" />}
                                  
                                  {entry.volume !== undefined && (
                                    <span className="text-xs font-medium text-accent-foreground">
                                      {t('uiVol')}: <span className="font-mono font-bold text-sm ml-1">{entry.volume.toFixed(3)} {t('uiMl')}</span>
                                    </span>
                                  )}
                                  
                                  {entry.solutionMass !== undefined && (
                                    <span className="text-xs font-medium text-accent-foreground ml-2">
                                      {t('uiMassSol')}: <span className="font-mono font-bold text-sm ml-1">
                                        {entry.solutionMass >= 1000 ? `${(entry.solutionMass / 1000).toFixed(2)} ${t('uiGram')}` : `${entry.solutionMass.toFixed(2)} ${t('uiMg')}`}
                                      </span>
                                    </span>
                                  )}

                                  {entry.density !== undefined && !entry.isSolution && (
                                    <span className="text-xs text-muted-foreground ml-auto">
                                      (d = {entry.density} g/mL)
                                    </span>
                                  )}
                                </div>
                                {entry.isSolution && (
                                  <div className="pl-6 text-[10px] text-muted-foreground font-medium">
                                    {entry.concentrationM !== undefined && `${t('uiSolution')} ${entry.concentrationM} M`}
                                    {entry.concentrationWt !== undefined && `${t('uiSolution')} ${entry.concentrationWt} wt%`}
                                    {entry.density !== undefined && ` (d = ${entry.density} ${t('uiGMl')})`}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="bg-secondary/10 border border-border/50 rounded-xl p-4 space-y-4 mt-6">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">{t('synthProduct')}</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="synthProductName" className="text-xs text-muted-foreground">{t('synthProduct')}</Label>
                        <Input 
                          id="synthProductName" 
                          placeholder={t('uiExName')} 
                          value={synthProductName}
                          onChange={(e) => setSynthProductName(e.target.value)}
                          className="h-8"
                          data-testid="input-product-name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="synthFormula" className="text-xs text-muted-foreground">{t('uiGrossFormula')}</Label>
                        <div className="flex gap-2">
                          <Input 
                            id="synthFormula" 
                            placeholder={t('uiExFormula')} 
                            value={synthFormula}
                            onChange={(e) => setSynthFormula(e.target.value)}
                            className="h-8"
                            data-testid="input-product-formula"
                          />
                          <div className="hidden md:block">
                            <Button 
                              variant="outline" 
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => setIsStructureEditorOpen("product")}
                              title={t('drawStructure')}
                              data-testid="button-draw-product-structure"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21"/><path d="m14 19.5 3-3 3 3"/><path d="m17 22.5-3-3"/></svg>
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="synthProductMass" className="text-xs text-muted-foreground">{t('propMass')}</Label>
                        <div className="flex gap-2">
                          <Input 
                            id="synthProductMass" 
                            placeholder={t('uiExMass')} 
                            value={synthProductMass}
                            onChange={(e) => setSynthProductMass(e.target.value)}
                            className="h-8 flex-1"
                            data-testid="input-product-mass"
                          />
                          <Select value={synthProductMassUnit} onValueChange={(val: "mg" | "g") => setSynthProductMassUnit(val)}>
                            <SelectTrigger className="w-16 h-8 text-xs px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="g">{t('uiGram')}</SelectItem>
                              <SelectItem value="mg">{t('uiMg')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('uiAmountCalc')}</Label>
                        <div className="h-8 bg-background border border-border/50 rounded-md px-3 flex items-center text-sm font-mono text-primary font-medium" data-testid="text-product-moles">
                          {synthProductMoles || "-"}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="synthYield" className="text-xs text-muted-foreground">{t('synthYield')} (%)</Label>
                        <Input 
                          id="synthYield" 
                          placeholder={t('uiExYield')} 
                          value={synthYield}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val && /^\d+\/\d+$/.test(val)) {
                              const parts = val.split('/');
                              const num = parseFloat(parts[0]);
                              const den = parseFloat(parts[1]);
                              if (!isNaN(num) && !isNaN(den) && den !== 0) {
                                setSynthYield(((num / den) * 100).toFixed(1));
                                return;
                              }
                            }
                            setSynthYield(val);
                          }}
                          className="h-8"
                          data-testid="input-synth-yield"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">{t('schemeTitle')}</Label>
                      </div>

                      <div className="pt-1">
                        <ReactionScheme 
                          data={synthReactionScheme} 
                          onChange={setSynthReactionScheme}
                          availableReagents={entries}
                          productName={synthProductName}
                          productFormula={synthFormula}
                          productSmiles={synthSmiles}
                          productMolfile={synthMolfile}
                          lang={lang}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="synthProcedure" className="text-xs text-muted-foreground">{t('synthProcedure')}</Label>
                        <FormatToolbar 
                          elementId="synthProcedure" 
                          value={synthProcedure} 
                          onChange={setSynthProcedure} 
                        />
                      </div>
                      <Textarea 
                        id="synthProcedure" 
                        placeholder={t('synthProcedurePlaceholder')} 
                        value={synthProcedure}
                        onChange={(e) => setSynthProcedure(e.target.value)}
                        className="min-h-[120px] resize-y text-sm"
                        data-testid="textarea-synth-procedure"
                      />
                      
                      <CustomSectionManager 
                        sections={customSections} 
                        onChange={setCustomSections} 
                        lang={lang} 
                      />
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="fixed bottom-1 right-2 text-[10px] text-slate-500 z-[100] pointer-events-none">
        made by Ivan Chumachenko
      </footer>

      {/* Mobile Export FAB */}
      {entries.length > 0 && (
        <div className="fixed bottom-6 right-6 md:hidden z-50 flex flex-col gap-2">
          <Button size="lg" className="rounded-full w-14 h-14 shadow-xl bg-primary text-primary-foreground" onClick={handleSaveSynthesis} data-testid="button-save-synthesis-mobile">
            <Save className="w-6 h-6" />
          </Button>
          <Button size="lg" className="rounded-full w-14 h-14 shadow-xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => {
            const rootElement = document.getElementById("root");
            if (rootElement) {
              openPublicationPdf(entries, buildSynthesisDetails(), lang, findLocation, rootElement);
            } else {
              openPublicationPdf(entries, buildSynthesisDetails(), lang, findLocation);
            }
          }} data-testid="button-export-pdf-mobile">
            <span className="font-bold text-xs">PDF</span>
          </Button>
          <Button size="lg" className="rounded-full w-14 h-14 shadow-xl bg-secondary text-secondary-foreground hover:bg-secondary/80" onClick={() => exportToTxt(entries, buildSynthesisDetails(), findLocation)} data-testid="button-export-txt-mobile">
            <span className="font-bold text-xs">TXT</span>
          </Button>
          <Button size="lg" className="rounded-full w-14 h-14 shadow-xl" onClick={() => exportToCsv(entries, buildSynthesisDetails(), findLocation)} data-testid="button-export-csv-mobile">
            <span className="font-bold text-xs">CSV</span>
          </Button>
        </div>
      )}

      {/* Structure Editor */}
      <Dialog open={isStructureEditorOpen !== false} onOpenChange={(open) => !open && setIsStructureEditorOpen(false)}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl p-0 overflow-hidden border-none bg-transparent shadow-none">
          <StructureEditor 
            key={String(isStructureEditorOpen)}
            mode={isStructureEditorOpen === "reaction" ? "reaction" : "molecule"}
            initialStructure={isStructureEditorOpen === "reagent" ? (inputMolfile || inputSmiles || undefined) : isStructureEditorOpen === "product" ? (synthMolfile || synthSmiles || undefined) : isStructureEditorOpen === "custom" ? (crMolfile || crSmiles || undefined) : undefined}
            onClose={() => setIsStructureEditorOpen(false)}
            onFormulaCalculated={(formula, smiles, molfile, name, rxnCode) => {
              if (isStructureEditorOpen === "reagent") {
                setInputName(name || formula || smiles);
                if (smiles) setInputSmiles(smiles);
                if (molfile) setInputMolfile(molfile);
              } else if (isStructureEditorOpen === "product") {
                if (formula) setSynthFormula(formula);
                if (smiles) setSynthSmiles(smiles);
                if (molfile) setSynthMolfile(molfile);
                if (name && !synthProductName) {
                  setSynthProductName(name);
                }
              } else if (isStructureEditorOpen === "custom") {
                if (activePickerContext) {
                  // This came from the ReactionScheme custom compound picker
                  const compound = {
                    label: name || formula || smiles || "Compound",
                    smiles,
                    molfile
                  };
                  const event = new CustomEvent("addCompoundToScheme", {
                    detail: {
                      ...activePickerContext,
                      compound
                    }
                  });
                  window.dispatchEvent(event);
                  setActivePickerContext(null);
                } else {
                  // Came from the custom reagent dialog
                  if (formula) setCrFormula(formula);
                  if (smiles) setCrSmiles(smiles);
                  if (molfile) setCrMolfile(molfile);
                  if (name && !crName) {
                    setCrName(name);
                  }
                }
              }
              setIsStructureEditorOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}