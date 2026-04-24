import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ReactionScheme } from "@/components/ReactionScheme";
import { PDF_EXPORT_STORAGE_KEY, PublicationPdfPayload, ReagentEntry, CustomSectionData } from "@/lib/export";

type PrintLabels = {
  title: string;
  subtitle: string;
  noData: string;
  noDataHint: string;
  back: string;
  print: string;
  close: string;
  generated: string;
  product: string;
  formula: string;
  mass: string;
  yield: string;
  reagents: string;
  procedure: string;
  scheme: string;
  location: string;
  compound: string;
  role: string;
  mw: string;
  eq: string;
  moles: string;
  volume: string;
  density: string;
};

const labels: Record<"ru" | "en", PrintLabels> = {
  ru: {
    title: "Phlogiston",
    subtitle: "Publication Style PDF export",
    noData: "Нет данных для PDF",
    noDataHint: "Вернитесь в основное окно, откройте синтез и снова нажмите PDF.",
    back: "Вернуться",
    print: "Сохранить как PDF",
    close: "Закрыть",
    generated: "Сформировано",
    product: "Продукт",
    formula: "Формула",
    mass: "Масса",
    yield: "Выход",
    reagents: "Таблица реагентов",
    procedure: "Процедура",
    scheme: "Схема реакции",
    location: "Локация",
    compound: "Соединение",
    role: "Роль",
    mw: "М.М., г/моль",
    eq: "Экв.",
    moles: "Количество",
    volume: "Объем",
    density: "Плотность, г/мл",
    uiGram: "г",
    uiMg: "мг",
    uiMl: "мл",
    uiLiter: "л",
    uiMkl: "мкл",
    uiMmol: "ммоль",
    uiMol: "моль",
  },
  en: {
    title: "Phlogiston",
    subtitle: "Publication Style PDF export",
    noData: "No PDF data found",
    noDataHint: "Go back to the main window, open a synthesis, and click PDF again.",
    back: "Back",
    print: "Save as PDF",
    close: "Close",
    generated: "Generated",
    product: "Product",
    formula: "Formula",
    mass: "Mass",
    yield: "Yield",
    reagents: "Reagent table",
    procedure: "Procedure",
    scheme: "Reaction scheme",
    location: "Location",
    compound: "Compound",
    role: "Role",
    mw: "MW, g/mol",
    eq: "Eq.",
    moles: "Amount",
    volume: "Volume",
    density: "Density, g/mL",
    uiGram: "g",
    uiMg: "mg",
    uiMl: "mL",
    uiLiter: "L",
    uiMkl: "uL",
    uiMmol: "mmol",
    uiMol: "mol",
  },
};

function formatValue(value?: number, digits = 2) {
  if (value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function formatRole(entry: ReagentEntry, lang: "ru" | "en") {
  if (entry.isReference) {
    return lang === "ru" ? "Референс" : "Reference";
  }
  if (entry.isSolution) {
    return lang === "ru" ? "Раствор" : "Solution";
  }
  return lang === "ru" ? "Реагент" : "Reagent";
}

function normalizeSchemeData(payload: PublicationPdfPayload) {
  const scheme = payload.details.reactionScheme;
  if (!scheme) return undefined;
  const normalizeCompound = (compound: string | { label: string; entryId?: string; smiles?: string; molfile?: string; cid?: string }) => {
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
    isCompleted: true,
  };
}

function buildOrientation(payload: PublicationPdfPayload) {
  const stages = payload.details.reactionScheme?.stages?.length || 0;
  const longestStage = payload.details.reactionScheme?.stages?.reduce((max, stage) => {
    return Math.max(max, stage.reactants.length + stage.products.length);
  }, 0) || 0;
  return stages > 1 || longestStage > 4 || payload.entries.length > 8 ? "landscape" : "portrait";
}

function formatMass(mass: number | undefined, unit: string | undefined, copy: any) {
  if (mass === undefined || Number.isNaN(mass)) return "—";
  if (unit === "g" || mass >= 1000) {
    const val = unit === "g" ? mass : mass / 1000;
    return `${val.toFixed(2)} ${copy.uiGram}`;
  }
  return `${mass.toFixed(2)} ${copy.uiMg}`;
}

function formatMoles(moles: number | undefined, copy: any) {
  if (moles === undefined || Number.isNaN(moles)) return "—";
  if (moles >= 1000) {
    return `${(moles / 1000).toFixed(3)} ${copy.uiMol}`;
  }
  return `${moles.toFixed(3)} ${copy.uiMmol}`;
}

function formatVolume(volume: number | undefined, copy: any) {
  if (volume === undefined || Number.isNaN(volume)) return "—";
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(3)} ${copy.uiLiter}`;
  }
  return `${volume.toFixed(3)} ${copy.uiMl}`;
}

export default function PrintSynthesis({ 
  isHiddenExport = false,
  onReady 
}: { 
  isHiddenExport?: boolean;
  onReady?: (el: HTMLElement) => void;
}) {
  const [payload, setPayload] = useState<PublicationPdfPayload | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(PDF_EXPORT_STORAGE_KEY);
    if (!raw) return;
    try {
      setPayload(JSON.parse(raw));
    } catch {
      setPayload(null);
    }
  }, []);

  const orientation = useMemo(() => (payload ? buildOrientation(payload) : "portrait"), [payload]);
  const lang = payload?.lang || "ru";
  const copy = labels[lang];

  useEffect(() => {
    if (!payload) return;
    document.title = `${payload.details.title || payload.details.productName || copy.title} PDF`;
    
    // Only auto-print if opened directly in a new tab, not inside the hidden iframe
    if (window.self === window.top && !isHiddenExport) {
      const timer = window.setTimeout(() => {
        window.print();
      }, 900);
      return () => window.clearTimeout(timer);
    } else {
      // Notify parent frame that print shell is ready after a small delay for SVGs to render
      const timer = window.setTimeout(() => {
        window.parent.postMessage({ type: 'PRINT_READY' }, '*');
        if (onReady) {
          const el = document.querySelector('.print-shell') as HTMLElement;
          if (el) onReady(el);
        }
      }, 1000);
      return () => window.clearTimeout(timer);
    }
  }, [payload, copy.title, isHiddenExport, onReady]);

  if (!payload) {
    return (
      <div className="min-h-screen bg-stone-100 px-6 py-12 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-stone-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">{copy.noData}</h1>
          <p className="mt-3 text-sm text-slate-600">{copy.noDataHint}</p>
          <div className="mt-6 flex gap-3">
            <Button asChild data-testid="button-print-back">
              <a href="/">{copy.back}</a>
            </Button>
            <Button variant="outline" onClick={() => window.close()} data-testid="button-print-close-empty">
              {copy.close}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const generatedAt = new Date(payload.generatedAt).toLocaleString(lang === "ru" ? "ru-RU" : "en-US");
  const details = payload.details;
  const schemeData = normalizeSchemeData(payload);
  const pageTitle = details.title || details.productName || copy.title;

  return (
    <div className="min-h-screen bg-stone-100 text-slate-900 print:bg-white">
      <style>{`
        @page { size: A4 ${orientation}; margin: 14mm; }
        @media print {
          body { background: white !important; }
          .print-controls { display: none !important; }
          .print-shell { box-shadow: none !important; border: 0 !important; border-radius: 0 !important; margin: 0 !important; max-width: none !important; padding: 0 !important; }
          .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
          .print-table-wrap { overflow: visible !important; }
          .print-page-break { page-break-before: always !important; break-before: page !important; }
          
          /* Force black color and 12pt font size for everything */
          .print-shell * { 
            color: black !important; 
            font-size: 12pt !important; 
          }
          
          /* Except for the synthesis title */
          .print-shell h1, .print-shell h1 * { 
            font-size: 24pt !important; 
            font-weight: 600 !important;
          }
          
          /* Slightly smaller text for structure cards to fit */
          .print-shell .text-\\[9px\\], 
          .print-shell .text-\\[11px\\] {
             font-size: 10pt !important;
          }
        }
      `}</style>

      <div className="print-controls sticky top-0 z-20 border-b border-stone-200 bg-white/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{copy.subtitle}</div>
            <div className="text-xs text-slate-500">{pageTitle}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => window.close()} data-testid="button-print-close">
              {copy.close}
            </Button>
            <Button onClick={() => window.print()} data-testid="button-print-save-pdf">
              {copy.print}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 print:px-0 print:py-0 w-full">
        <article className="print-shell mx-auto rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] print:shadow-none print:border-none print:rounded-none">
          <header className="print-avoid-break border-b border-stone-200 pb-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{copy.title}</div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{pageTitle}</h1>
                {details.number && <p className="mt-2 text-sm text-slate-500">#{details.number}</p>}
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-right">
                <div className="text-[11px] uppercase tracking-widest text-slate-400">{copy.generated}</div>
                <div className="mt-1 text-sm font-medium text-slate-700">{generatedAt}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-widest text-slate-400">{copy.product}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{details.productName || "—"}</div>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-widest text-slate-400">{copy.formula}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{details.formula || "—"}</div>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-widest text-slate-400">{copy.mass}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{details.productMass || "—"}</div>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-widest text-slate-400">{copy.yield}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{details.yield ? `${details.yield}%` : "—"}</div>
              </div>
            </div>
          </header>

          {schemeData && (
            <section className="print-avoid-break mt-8">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">{copy.scheme}</div>
              <ReactionScheme
                data={schemeData}
                onChange={() => undefined}
                availableReagents={payload.entries}
                productName={details.productName}
                productFormula={details.formula}
                productSmiles={details.productSmiles}
                productMolfile={details.productMolfile}
                readOnly
                printMode
              />
            </section>
          )}

          <section className="mt-8">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">{copy.reagents}</div>
            <div className="print-table-wrap overflow-x-auto rounded-[24px] border-2 border-slate-300">
              <table className="w-full table-fixed border-collapse text-left text-[14px]" style={{ wordBreak: "break-word" }}>
                <thead className="bg-stone-50 text-slate-600">
                  <tr>
                    <th className="border border-slate-300 px-2 py-2 font-semibold w-[22%]">{copy.compound}</th>
                    <th className="border border-slate-300 px-2 py-2 font-semibold w-[10%]">{copy.role}</th>
                    <th className="border border-slate-300 px-2 py-2 font-semibold w-[9%]">{copy.mw}</th>
                    <th className="border border-slate-300 px-2 py-2 font-semibold w-[8%]">{copy.eq}</th>
                    <th className="border border-slate-300 px-2 py-2 font-semibold w-[10%]">{copy.moles}</th>
                    <th className="border border-slate-300 px-2 py-2 font-semibold w-[11%]">{copy.mass}</th>
                    <th className="border border-slate-300 px-2 py-2 font-semibold w-[11%]">{copy.volume}</th>
                    <th className="border border-slate-300 px-2 py-2 font-semibold w-[9%]">{copy.density}</th>
                    <th className="border border-slate-300 px-2 py-2 font-semibold w-[10%]">{copy.location}</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.entries.map((entry) => (
                    <tr key={entry.id} className="align-top border-b border-slate-300 last:border-b-0">
                      <td className="border border-slate-300 px-2 py-2 font-medium text-slate-900">{entry.nameOrFormula}</td>
                      <td className="border border-slate-300 px-2 py-2 text-slate-700">{formatRole(entry, lang)}</td>
                      <td className="border border-slate-300 px-2 py-2 text-slate-700">{formatValue(entry.molarMass, 2)}</td>
                      <td className="border border-slate-300 px-2 py-2 text-slate-700">{formatValue(entry.equivalents, 2)}</td>
                      <td className="border border-slate-300 px-2 py-2 text-slate-700">{formatMoles(entry.moles, copy)}</td>
                      <td className="border border-slate-300 px-2 py-2 text-slate-700">{formatMass(entry.mass, entry.massUnit, copy)}</td>
                      <td className="border border-slate-300 px-2 py-2 text-slate-700">{formatVolume(entry.volume, copy)}</td>
                      <td className="border border-slate-300 px-2 py-2 text-slate-700">{formatValue(entry.density, 3)}</td>
                      <td className="border border-slate-300 px-2 py-2 text-slate-700">{payload.inventoryLocations[entry.id || entry.nameOrFormula] || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>


          {details.customSections && details.customSections.length > 0 && (
            <>
              <div className="print-page-break" style={{ pageBreakBefore: 'always', breakBefore: 'page' }}></div>
              <div className="mt-8 pt-8 border-t border-stone-200 print:border-none print:mt-0 print:pt-8">
                <section>
                  <div className="space-y-6">
                {details.customSections.map((section: CustomSectionData) => (
                  <div key={section.id} className="break-inside-avoid">
                    {section.title && (
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                        {section.title}
                      </div>
                    )}
                    
                    {section.type === "text" && (
                      <div className="whitespace-pre-wrap font-mono text-[14px] leading-relaxed text-slate-700 bg-stone-50 p-4 rounded-[24px] border border-stone-200">
                        {section.content}
                      </div>
                    )}
                    
                    {section.type === "image" && section.content && (
                      <div className="mt-2 text-center">
                        <img src={section.content} alt={section.title} className="max-h-[400px] max-w-full object-contain mx-auto rounded-xl border border-stone-200 shadow-sm" />
                      </div>
                    )}
                    
                    {section.type === "table" && (
                      <div className="mt-2 overflow-x-auto border border-stone-200 rounded-xl bg-white">
                        <table className="w-full text-[13px] text-left border-collapse">
                          <thead>
                            <tr className="bg-stone-50 border-b border-stone-200">
                              {(() => {
                                try {
                                  const data = JSON.parse(section.content);
                                  return data.headers?.map((h: string, i: number) => (
                                    <th key={i} className="p-3 font-semibold text-slate-600 border-r border-stone-200 last:border-0">{h}</th>
                                  ));
                                } catch(e) { return null; }
                              })()}
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              try {
                                const data = JSON.parse(section.content);
                                return data.rows?.map((row: string[], ri: number) => (
                                  <tr key={ri} className="border-b border-stone-100 last:border-0">
                                    {row.map((cell: string, ci: number) => (
                                      <td key={ci} className="p-3 border-r border-stone-100 last:border-0 font-mono text-slate-700">{cell}</td>
                                    ))}
                                  </tr>
                                ));
                              } catch(e) { return null; }
                            })()}
                          </tbody>
                        </table>
                      </div>
                    )}
                    
                    {section.type === "checklist" && (
                      <div className="mt-2 space-y-2 bg-stone-50 p-4 rounded-[24px] border border-stone-200">
                        {(() => {
                          try {
                            const items = JSON.parse(section.content);
                            return items.map((item: any, i: number) => (
                              <div key={i} className="flex items-start gap-3">
                                <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${item.checked ? 'bg-slate-700 border-slate-700' : 'border-slate-300 bg-white'}`}>
                                  {item.checked && (
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  )}
                                </div>
                                <span className={`text-[14px] ${item.checked ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                                  {item.text}
                                </span>
                              </div>
                            ));
                          } catch(e) { return null; }
                        })()}
                      </div>
                    )}
                    
                    {section.type === "empty" && (
                      <div className="mt-2 h-32 border-2 border-dashed border-stone-300 rounded-[24px] bg-white"></div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
            </>
          )}

          {details.procedure && (
            <section className="print-avoid-break mt-8">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">{copy.procedure}</div>
              <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4 text-[14px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                {details.procedure}
              </div>
            </section>
          )}
        </article>
      </div>
    </div>
  );
}
