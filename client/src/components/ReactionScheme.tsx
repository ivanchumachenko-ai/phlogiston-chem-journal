import { useEffect, useMemo, useRef, useState } from "react";
import SmilesDrawer from "smiles-drawer";
import { Plus, X, ArrowRight, Check, Trash2, GitCommitHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReagentEntry } from "@/lib/export";
import { ChemicalProperties, get_properties_async } from "@/lib/chemistry";
import { t } from "@/lib/i18n";

import { FormatToolbar } from "@/components/FormatToolbar";

export interface SchemeCompound {
  label: string;
  entryId?: string;
  smiles?: string;
  molfile?: string;
  cid?: string;
}

export interface ReactionSchemeStage {
  reactants: SchemeCompound[];
  conditions: string;
  products: SchemeCompound[];
}

export interface ReactionSchemeData {
  reactants: SchemeCompound[];
  conditions: string;
  products: SchemeCompound[];
  stages?: ReactionSchemeStage[];
  isCompleted?: boolean;
}

interface ReactionSchemeProps {
  data: ReactionSchemeData;
  onChange: (data: ReactionSchemeData) => void;
  availableReagents: ReagentEntry[];
  productName: string;
  productFormula?: string;
  productSmiles?: string;
  productMolfile?: string;
  lang?: "ru" | "en";
  readOnly?: boolean;
  printMode?: boolean;
}

interface StructureCardProps {
  label: string;
  smiles?: string;
  molfile?: string;
  cid?: string;
  highlight?: boolean;
  secondaryLabel?: string;
  cleanMode?: boolean;
  printMode?: boolean;
}

function emptyStage(): ReactionSchemeStage {
  return {
    reactants: [],
    conditions: "",
    products: [],
  };
}

function normalizeStages(data: ReactionSchemeData): ReactionSchemeStage[] {
  if (data.stages && data.stages.length > 0) {
    return data.stages.map((stage) => ({
      reactants: (stage.reactants || []).map(normalizeCompound),
      conditions: stage.conditions || "",
      products: (stage.products || []).map(normalizeCompound),
    }));
  }

  return [
    {
      reactants: (data.reactants || []).map(normalizeCompound),
      conditions: data.conditions || "",
      products: (data.products || []).map(normalizeCompound),
    },
  ];
}

function buildSchemeData(base: ReactionSchemeData, stages: ReactionSchemeStage[], isCompleted?: boolean): ReactionSchemeData {
  const normalizedStages = stages.length > 0 ? stages : [emptyStage()];
  const firstStage = normalizedStages[0];
  const lastStage = normalizedStages[normalizedStages.length - 1];

  return {
    ...base,
    reactants: firstStage.reactants,
    conditions: firstStage.conditions,
    products: lastStage.products,
    stages: normalizedStages,
    isCompleted: isCompleted ?? base.isCompleted,
  };
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeCompound(compound: SchemeCompound | string): SchemeCompound {
  if (typeof compound === "string") {
    return { label: compound };
  }

  return {
    label: compound.label || "",
    entryId: compound.entryId,
    smiles: compound.smiles,
    molfile: compound.molfile,
    cid: compound.cid,
  };
}

function getCompoundLabel(compound: SchemeCompound | string) {
  return typeof compound === "string" ? compound : compound.label;
}

function StructureCanvas({ smiles, cleanMode = false, printMode = false }: { smiles: string; cleanMode?: boolean; printMode?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasError(false);

    SmilesDrawer.parse(
      smiles,
      (tree: any) => {
        try {
          const width = printMode ? 360 : cleanMode ? 264 : 240; // Double resolution
          const height = printMode ? 252 : cleanMode ? 200 : 192;
          const padding = printMode ? 12 : cleanMode ? 8 : 20;
          const drawer = new SmilesDrawer.Drawer({
            width,
            height,
            padding,
            compactDrawing: true,
            bondThickness: printMode ? 2.5 : cleanMode ? 2.0 : 1.8,
            fontSizeLarge: printMode ? 18 : 14,
            fontSizeSmall: printMode ? 14 : 10,
            terminalCarbons: true,
            disableColors: true,
          });
          drawer.draw(tree, canvas, "light", false);
        } catch (error) {
          console.error("Failed to draw SMILES locally", error);
          setHasError(true);
        }
      },
      (error: unknown) => {
        console.error("Failed to parse SMILES", error);
        setHasError(true);
      },
    );
  }, [smiles, cleanMode, printMode]);

  if (hasError) return null;

  const width = printMode ? 360 : cleanMode ? 264 : 240; // Double resolution for drawing
  const height = printMode ? 252 : cleanMode ? 200 : 192;

  // Use CSS class for display size, canvas attributes for internal resolution
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={printMode ? "h-[126px] w-[180px] object-contain" : cleanMode ? "h-[100px] w-[132px] object-contain" : "h-[96px] w-[120px] object-contain"}
      aria-hidden="true"
    />
  );
}

function StructureCard({ label, smiles, molfile, cid, highlight, secondaryLabel, cleanMode = false, printMode = false }: StructureCardProps) {
  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  const hasStructure = Boolean(smiles || cid || molfile);

  const wrapperClass = printMode
    ? "flex shrink-0 min-w-[120px] w-full max-w-[200px] flex-col items-center text-center gap-1.5"
    : `flex min-w-[124px] max-w-[152px] flex-col items-center text-center ${cleanMode ? "gap-0" : "gap-2"}`;
  const frameClass = printMode
    ? `flex min-h-[126px] w-[180px] items-center justify-center overflow-hidden rounded-md border bg-white p-1.5 text-slate-900 ${
        highlight ? "border-slate-900 shadow-sm" : "border-stone-200"
      }`
    : cleanMode
      ? "flex min-h-[100px] w-[132px] items-center justify-center overflow-hidden rounded-md bg-transparent p-0 text-slate-900"
      : `flex h-[108px] w-[124px] items-center justify-center overflow-hidden rounded-md bg-transparent p-2 text-slate-900 ${
          highlight ? "ring-1 ring-slate-900 shadow-sm" : ""
        }`;
  const imageClass = printMode
    ? "max-h-[126px] max-w-[180px] object-contain mix-blend-multiply"
    : cleanMode
      ? "max-h-[100px] max-w-[132px] object-contain mix-blend-multiply"
      : "max-h-full max-w-full object-contain mix-blend-multiply";
  const fallbackClass = printMode
    ? "px-3 text-sm font-medium leading-tight text-slate-600"
    : cleanMode
      ? "px-1 text-[11px] leading-tight text-slate-500"
      : "flex h-full w-full items-center justify-center px-2 text-center text-xs leading-tight text-slate-500";

  return (
    <div className={wrapperClass}>
      <div className={frameClass}>
        {cid && isOnline ? (
          <img
            src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?record_type=2d`}
            alt={label}
            className={imageClass}
            crossOrigin="anonymous"
          />
        ) : smiles ? (
          <StructureCanvas smiles={smiles} cleanMode={cleanMode} printMode={printMode} />
        ) : (
          <div className={fallbackClass}>{label}</div>
        )}
      </div>

      {printMode ? (
        <div className="space-y-1 pb-1 w-full px-1">
          <div className="text-[11px] font-medium leading-tight text-slate-900 break-words" title={label}>
            {label}
          </div>
          {secondaryLabel && (
            <div className="text-[9px] uppercase tracking-[0.16em] text-slate-400 break-words">{secondaryLabel}</div>
          )}
        </div>
      ) : !cleanMode && (
        <div className="space-y-0.5">
          <div className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-900" title={label}>
            {label}
          </div>
          {secondaryLabel && (
            <div className="line-clamp-1 text-[10px] uppercase tracking-[0.12em] text-slate-400">{secondaryLabel}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function ReactionScheme({
  data,
  onChange,
  availableReagents,
  productName,
  productFormula,
  productSmiles,
  productMolfile,
  readOnly = false,
  printMode = false,
}: ReactionSchemeProps) {
  const [activePicker, setActivePicker] = useState<{ stageIndex: number; side: "reactant" | "product" } | null>(null);
  const [customValue, setCustomValue] = useState("");
  const [resolvedStructures, setResolvedStructures] = useState<Record<string, ChemicalProperties | null>>({});

  const stages = useMemo(() => normalizeStages(data), [data]);
  const isCompleted = readOnly || Boolean(data.isCompleted);
  const hasTargetProduct = Boolean(productName || productFormula || productSmiles || productMolfile);
  const targetProductLabel = productName || productFormula || t("uiTargetProduct");

  const availableReagentLookup = useMemo(() => {
    const lookup = new Map<string, ReagentEntry>();

    availableReagents.forEach((reagent) => {
      lookup.set(`id:${reagent.id}`, reagent);

      const aliases = [reagent.nameOrFormula, reagent.properties?.name, reagent.properties?.formula];
      aliases.forEach((alias) => {
        if (!alias) return;
        const normalized = normalizeLabel(alias);
        if (!lookup.has(normalized)) {
          lookup.set(normalized, reagent);
        }
      });
    });

    return lookup;
  }, [availableReagents]);

  const resolveReagent = (compound: SchemeCompound | string) => {
    const normalizedCompound = normalizeCompound(compound);
    if (normalizedCompound.entryId) {
      const byId = availableReagentLookup.get(`id:${normalizedCompound.entryId}`);
      if (byId) return byId;
    }

    return availableReagentLookup.get(normalizeLabel(normalizedCompound.label));
  };

  const targetProductEntry = useMemo(() => {
    const candidates = [productName, productFormula, targetProductLabel];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const match = resolveReagent(candidate);
      if (match) return match;
    }
    return undefined;
  }, [availableReagentLookup, productFormula, productName, targetProductLabel]);

  useEffect(() => {
    const queries = new Set<string>();

    stages.forEach((stage) => {
      stage.reactants.forEach((reactant) => {
        const normalized = normalizeCompound(reactant);
        if (!normalized.cid && !normalized.smiles && !normalized.molfile && normalized.label) {
          queries.add(normalized.label);
        }
      });
      stage.products.forEach((product) => {
        const normalized = normalizeCompound(product);
        if (!normalized.cid && !normalized.smiles && !normalized.molfile && normalized.label) {
          queries.add(normalized.label);
        }
      });
    });

    [productName, productFormula].forEach((value) => {
      if (value) queries.add(value);
    });

    const missing = Array.from(queries).filter((query) => {
      const normalized = normalizeLabel(query);
      const entry = resolveReagent(query);
      const entryHasStructure = Boolean(entry?.properties?.cid || entry?.properties?.smiles || entry?.molfile || entry?.properties?.molfile);
      return query.trim() && (!entryHasStructure || !entry) && !(normalized in resolvedStructures);
    });

    if (missing.length === 0) return;

    let cancelled = false;

    (async () => {
      const loaded = await Promise.all(
        missing.map(async (query) => ({
          query,
          properties: await get_properties_async(query),
        })),
      );

      if (cancelled) return;

      setResolvedStructures((current) => {
        const next = { ...current };
        loaded.forEach(({ query, properties }) => {
          next[normalizeLabel(query)] = properties;
        });
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [stages, productName, productFormula, resolveReagent, resolvedStructures]);

  useEffect(() => {
    const handleAddCompound = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { stageIndex, side, compound } = customEvent.detail;
      addCompound(stageIndex, side, compound);
    };
    window.addEventListener("addCompoundToScheme", handleAddCompound);
    return () => window.removeEventListener("addCompoundToScheme", handleAddCompound);
  }, [stages, availableReagents]);

  const updateStages = (nextStages: ReactionSchemeStage[], completed = data.isCompleted) => {
    onChange(buildSchemeData(data, nextStages, completed));
  };

  const updateStage = (stageIndex: number, nextStage: ReactionSchemeStage) => {
    const nextStages = stages.map((stage, index) => (index === stageIndex ? nextStage : stage));
    updateStages(nextStages);
  };

  const addCompound = (stageIndex: number, side: "reactant" | "product", compound: SchemeCompound | ReagentEntry | string) => {
    const nextCompound = typeof compound === "string"
      ? normalizeCompound(compound)
      : "nameOrFormula" in compound
        ? {
            label: compound.nameOrFormula,
            entryId: compound.id,
            smiles: compound.properties?.smiles || (compound as any).smiles,
            molfile: compound.properties?.molfile || (compound as any).molfile,
            cid: compound.properties?.cid,
          }
        : normalizeCompound(compound);

    if (!nextCompound.label.trim()) return;

    const stage = stages[stageIndex];
    const key = side === "reactant" ? "reactants" : "products";
    if (stage[key].length >= 5) return;

    updateStage(stageIndex, {
      ...stage,
      [key]: [...stage[key], nextCompound],
    });
    setCustomValue("");
    setActivePicker(null);
  };

  const removeCompound = (stageIndex: number, side: "reactant" | "product", compoundIndex: number) => {
    const stage = stages[stageIndex];
    const key = side === "reactant" ? "reactants" : "products";
    const nextItems = [...stage[key]];
    nextItems.splice(compoundIndex, 1);
    updateStage(stageIndex, {
      ...stage,
      [key]: nextItems,
    });
  };

  const addStage = () => {
    updateStages([...stages, emptyStage()]);
  };

  const removeStage = (stageIndex: number) => {
    if (stages.length === 1) {
      updateStages([emptyStage()]);
      return;
    }

    updateStages(stages.filter((_, index) => index !== stageIndex));
    if (activePicker?.stageIndex === stageIndex) {
      setActivePicker(null);
      setCustomValue("");
    }
  };

  const toggleCompleted = () => {
    updateStages(stages, !data.isCompleted);
  };

  const clearScheme = () => {
    if (window.confirm(t("msgClearedDesc"))) {
      onChange({
        reactants: [],
        conditions: "",
        products: [],
        stages: [emptyStage()],
        isCompleted: false,
      });
      setActivePicker(null);
      setCustomValue("");
    }
  };

  const renderStructure = (
    compound: SchemeCompound | string,
    entry?: ReagentEntry | null,
    explicitSmiles?: string,
    explicitMolfile?: string,
    highlight?: boolean,
    secondaryLabel?: string,
  ) => {
    const normalizedCompound = normalizeCompound(compound);
    const label = normalizedCompound.label;
    const resolved = resolvedStructures[normalizeLabel(label)];
    const hasLocalStructure = Boolean(explicitSmiles || explicitMolfile || normalizedCompound.smiles || normalizedCompound.molfile);
    const smiles = explicitSmiles || normalizedCompound.smiles || entry?.properties?.smiles || resolved?.smiles;
    const molfile = explicitMolfile || normalizedCompound.molfile || entry?.molfile || entry?.properties?.molfile || resolved?.molfile;
    const cid = hasLocalStructure ? undefined : normalizedCompound.cid || entry?.properties?.cid || resolved?.cid;

    return (
      <StructureCard
        label={label}
        smiles={smiles}
        molfile={molfile}
        cid={cid}
        highlight={highlight}
        secondaryLabel={secondaryLabel}
        cleanMode={isCompleted && !printMode}
        printMode={printMode}
      />
    );
  };

  const renderPicker = (stageIndex: number, side: "reactant" | "product") => {
    const isOpen = activePicker?.stageIndex === stageIndex && activePicker?.side === side;
    if (!isOpen) return null;

    const stage = stages[stageIndex];
    const excluded = side === "reactant" ? stage.reactants : stage.products;
    const excludedLabels = excluded.map((compound) => normalizeCompound(compound).label);
    const options = availableReagents.filter((reagent) => !excludedLabels.includes(reagent.nameOrFormula));

    return (
      <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3 shadow-sm" data-testid={`panel-${side}-picker-${stageIndex}`}>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t("uiFromTable")}</div>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-stone-200 bg-stone-50 p-1">
              {options.length > 0 ? (
                options.map((reagent) => (
                  <button
                    key={reagent.id}
                    className="w-full rounded bg-stone-50 px-2 py-1.5 text-left text-sm transition-colors hover:bg-stone-100"
                    onClick={() => addCompound(stageIndex, side, reagent)}
                    data-testid={`button-${side}-option-${stageIndex}-${reagent.id}`}
                  >
                    {reagent.nameOrFormula}
                  </button>
                ))
              ) : (
                <div className="px-2 py-2 text-xs italic text-slate-400">{t("uiInventoryEmpty")}</div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t("uiCustomReagent")}</div>
            <div className="flex gap-2">
              <Input
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && addCompound(stageIndex, side, customValue)}
                data-testid={`input-${side}-custom-${stageIndex}`}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 hidden md:flex"
                onClick={() => {
                  const event = new CustomEvent("openStructureEditor", {
                    detail: {
                      mode: "custom",
                      stageIndex,
                      side
                    }
                  });
                  window.dispatchEvent(event);
                }}
                title={t("drawStructure")}
                data-testid={`button-${side}-draw-${stageIndex}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21"/><path d="m14 19.5 3-3 3 3"/><path d="m17 22.5-3-3"/></svg>
              </Button>
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => addCompound(stageIndex, side, customValue)}
                data-testid={`button-${side}-custom-add-${stageIndex}`}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full"
            onClick={() => {
              setActivePicker(null);
              setCustomValue("");
            }}
            data-testid={`button-${side}-picker-close-${stageIndex}`}
          >
            {t("uiClose")}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`relative bg-stone-50 ${printMode ? "rounded-[22px] border border-stone-300 p-5 shadow-none" : isCompleted ? "rounded-lg border border-stone-200 p-3 shadow-none" : "rounded-xl border border-stone-200 p-4 shadow-sm"}`}
      data-testid="card-reaction-scheme"
    >
      {!readOnly && (
        <div className="absolute left-3 top-3 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${isCompleted ? "text-slate-300 hover:bg-stone-100 hover:text-slate-700" : "text-slate-400 hover:bg-stone-100 hover:text-destructive"}`}
            onClick={clearScheme}
            title={t("headerClear")}
            data-testid="button-scheme-clear"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!readOnly && (
        <div className="absolute right-3 top-3 flex gap-2">
          <Button
            variant={isCompleted ? "default" : "outline"}
            size="sm"
            className={`h-8 text-xs ${isCompleted ? "bg-slate-900 text-white hover:bg-slate-800" : "border-stone-300 bg-stone-50 hover:bg-stone-100"}`}
            onClick={toggleCompleted}
            data-testid="button-scheme-complete"
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            {t("schemeComplete")}
          </Button>
        </div>
      )}

      <div className={`space-y-4 ${printMode ? "pt-2" : "pt-8"}`}>
        {stages.map((stage, stageIndex) => {
          const isLastStage = stageIndex === stages.length - 1;

          return (
            <div
              key={stageIndex}
              className={printMode ? "rounded-[20px] border border-stone-200 bg-white p-5" : isCompleted ? "rounded-lg border border-stone-200 bg-stone-50 p-3" : "rounded-lg border border-stone-200 bg-stone-50 p-4"}
              data-testid={`card-stage-${stageIndex}`}
            >
              {!isCompleted && (
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-slate-500">
                    <GitCommitHorizontal className="h-4 w-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                      {t("schemeStage")} {stageIndex + 1}
                    </span>
                  </div>
                  {stages.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-slate-400 hover:bg-stone-100 hover:text-destructive"
                      onClick={() => removeStage(stageIndex)}
                      data-testid={`button-remove-stage-${stageIndex}`}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      {t("uiDelete")}
                    </Button>
                  )}
                </div>
              )}

              <div className={`overflow-x-auto print:overflow-visible ${printMode ? "pb-0 w-full" : isCompleted ? "pb-0" : "pb-2"}`}>
                <div className={`flex items-start ${printMode ? "w-full justify-center gap-4" : `min-w-max ${isCompleted ? "gap-8" : "gap-6"}`}`}>
                  <div className="flex items-center gap-3">
                    {stage.reactants.length > 0 ? (
                      stage.reactants.map((reactant, reactantIndex) => {
                        const compound = normalizeCompound(reactant);
                        const entry = resolveReagent(compound);
                        return (
                          <div key={`${compound.entryId || compound.label}-${reactantIndex}`} className="flex items-center gap-3">
                            {reactantIndex > 0 && <span className="text-xl text-slate-400">+</span>}
                            <div className="relative">
                              {renderStructure(compound, entry)}
                              {!isCompleted && (
                                <button
                                  onClick={() => removeCompound(stageIndex, "reactant", reactantIndex)}
                                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white"
                                  data-testid={`button-remove-reactant-${stageIndex}-${reactantIndex}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex h-[108px] min-w-[160px] items-center justify-center rounded-md border border-dashed border-stone-300 bg-transparent px-4 text-sm italic text-slate-400">
                        {t("schemeReactants")}
                      </div>
                    )}

                    {!isCompleted && stage.reactants.length < 5 && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-full border-stone-300 bg-stone-50 hover:bg-stone-100"
                        onClick={() => {
                          setCustomValue("");
                          setActivePicker(
                            activePicker?.stageIndex === stageIndex && activePicker?.side === "reactant"
                              ? null
                              : { stageIndex, side: "reactant" },
                          );
                        }}
                        data-testid={`button-add-reactant-${stageIndex}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div 
                    className={`flex flex-col items-center justify-center shrink-0 ${printMode ? "w-[200px] px-2 pt-2" : `min-w-[180px] w-[220px] px-2 ${isCompleted ? "pt-1" : "pt-4"}`}`}
                  >
                    {printMode ? (
                      <div className="w-full text-center text-[11px] font-medium leading-snug text-slate-900 whitespace-pre-wrap px-1 pb-1 flex items-end justify-center min-h-[32px]">
                        {stage.conditions}
                      </div>
                    ) : (
                      <div className="w-full relative group">
                        <Textarea
                          id={`textarea-stage-conditions-${stageIndex}`}
                          value={stage.conditions}
                          onChange={(e) => updateStage(stageIndex, { ...stage, conditions: e.target.value })}
                          placeholder={t("schemeConditions")}
                          className={`w-full resize-none border-0 px-2 text-center text-xs leading-relaxed shadow-none focus-visible:ring-0 ${
                            isCompleted ? "min-h-[52px] bg-stone-50 py-1 text-slate-600" : "min-h-[64px] bg-stone-50 py-2 text-slate-700"
                          }`}
                          readOnly={isCompleted}
                          data-testid={`textarea-stage-conditions-${stageIndex}`}
                        />
                        {!isCompleted && (
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-focus-within:opacity-100 transition-opacity z-10 pointer-events-none group-focus-within:pointer-events-auto">
                            <FormatToolbar 
                              elementId={`textarea-stage-conditions-${stageIndex}`}
                              value={stage.conditions} 
                              onChange={(val) => updateStage(stageIndex, { ...stage, conditions: val })} 
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`flex w-full items-center justify-center text-slate-900 ${printMode ? "mt-1" : "mt-2"}`}>
                      <div className="flex-grow border-b border-slate-900" style={{ borderBottomWidth: printMode ? '2px' : '1.5px', borderColor: printMode ? '#0f172a' : '' }} />
                      <svg 
                        width="14" 
                        height="14" 
                        viewBox="0 0 14 14" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth={printMode ? 2 : 1.5} 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        className="ml-[-1px] shrink-0 text-slate-900"
                        style={printMode ? { stroke: '#0f172a' } : {}}
                      >
                        <path d="M0 7h12 M7 2l5 5-5 5" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {(isLastStage && hasTargetProduct) || stage.products.length > 0 ? (
                      <>
                        {isLastStage && hasTargetProduct && (
                          <div className="relative">
                            {renderStructure(
                              targetProductLabel,
                              targetProductEntry,
                              productSmiles || targetProductEntry?.properties?.smiles,
                              productMolfile || targetProductEntry?.molfile || targetProductEntry?.properties?.molfile,
                              true,
                              t("uiTargetProduct"),
                            )}
                          </div>
                        )}

                        {stage.products.map((product, productIndex) => {
                          const compound = normalizeCompound(product);
                          const entry = resolveReagent(compound);
                          const needsPlus = (isLastStage && hasTargetProduct) || productIndex > 0;
                          return (
                            <div key={`${compound.entryId || compound.label}-${productIndex}`} className="flex items-center gap-3">
                              {needsPlus && <span className="text-xl text-slate-400">+</span>}
                              <div className="relative">
                                {renderStructure(compound, entry)}
                                {!isCompleted && (
                                  <button
                                    onClick={() => removeCompound(stageIndex, "product", productIndex)}
                                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white"
                                    data-testid={`button-remove-product-${stageIndex}-${productIndex}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <div className="flex h-[108px] min-w-[160px] items-center justify-center rounded-md border border-dashed border-stone-300 bg-transparent px-4 text-sm italic text-slate-400">
                        {t("uiTargetProduct")}
                      </div>
                    )}

                    {!isCompleted && stage.products.length < 5 && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-full border-stone-300 bg-stone-50 hover:bg-stone-100"
                        onClick={() => {
                          setCustomValue("");
                          setActivePicker(
                            activePicker?.stageIndex === stageIndex && activePicker?.side === "product"
                              ? null
                              : { stageIndex, side: "product" },
                          );
                        }}
                        data-testid={`button-add-product-${stageIndex}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {!isCompleted && renderPicker(stageIndex, "reactant")}
              {!isCompleted && renderPicker(stageIndex, "product")}
            </div>
          );
        })}

        {!isCompleted && (
          <Button
            variant="outline"
            className="w-full border-dashed border-stone-300 bg-stone-50 text-sm hover:bg-stone-100"
            onClick={addStage}
            data-testid="button-add-stage"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("schemeAddStage")}
          </Button>
        )}
      </div>
    </div>
  );
}
