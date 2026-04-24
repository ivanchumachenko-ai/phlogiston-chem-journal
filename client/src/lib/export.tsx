import { ChemicalProperties } from "./chemistry";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export interface ReagentEntry {
  id: string;
  nameOrFormula: string;
  molarMass: number;
  mass?: number;
  massUnit?: "mg" | "g";
  moles?: number;
  molesUnit?: "mmol" | "mol";
  equivalents?: number;
  density?: number;
  volume?: number;
  isReference: boolean;
  properties?: ChemicalProperties | null;
  molfile?: string;
  structureSource?: string;
  isSolution?: boolean;
  concentrationM?: number;
  concentrationWt?: number;
  solutionMass?: number;
}

export type SchemeCompoundLike = string | {
  label: string;
  entryId?: string;
  smiles?: string;
  molfile?: string;
  cid?: string;
};


export type CustomSectionType = "text" | "image" | "table" | "checklist" | "empty";

export interface CustomSectionData {
  id: string;
  type: CustomSectionType;
  title: string;
  content: string;
  order: number;
}

export interface SynthesisDetails {
  customSections?: CustomSectionData[];
  title: string;
  number: string;
  formula: string;
  productName: string;
  productMass: string;
  yield: string;
  procedure: string;
  reaction?: string;
  productSmiles?: string;
  productMolfile?: string;
  reactionScheme?: {
    reactants: SchemeCompoundLike[];
    conditions: string;
    products: SchemeCompoundLike[];
    stages?: Array<{
      reactants: SchemeCompoundLike[];
      conditions: string;
      products: SchemeCompoundLike[];
    }>;
    isCompleted?: boolean;
  };
}

export interface PortableSynthesisExport {
  version: 2;
  entries: ReagentEntry[];
  details: SynthesisDetails;
}

export const TXT_EXPORT_JSON_BEGIN = "PHLOGISTON_EXPORT_JSON_BEGIN";
export const TXT_EXPORT_JSON_END = "PHLOGISTON_EXPORT_JSON_END";
export const PDF_EXPORT_STORAGE_KEY = "phlogiston_publication_pdf";

export interface PublicationPdfPayload {
  entries: ReagentEntry[];
  details: SynthesisDetails;
  lang: "ru" | "en";
  inventoryLocations: Record<string, string>;
  generatedAt: string;
}

function compoundLabel(compound: SchemeCompoundLike) {
  return typeof compound === "string" ? compound : compound.label;
}

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildPortableSynthesisExport(entries: ReagentEntry[], details?: SynthesisDetails): PortableSynthesisExport {
  return {
    version: 2,
    entries,
    details: details || {
      title: "",
      number: "",
      formula: "",
      productName: "",
      productMass: "",
      yield: "",
      procedure: "",
    },
  };
}

export function serializePortableSynthesis(entries: ReagentEntry[], details?: SynthesisDetails) {
  return JSON.stringify(buildPortableSynthesisExport(entries, details));
}

export function exportToTxt(entries: ReagentEntry[], details?: SynthesisDetails, inventoryLocFn?: (name: string, formula?: string) => string | null) {
  let content = "Phlogiston Report\n================\n\n";

  if (details && (details.title || details.number)) {
    content += `Synthesis: ${details.title || "Untitled"}`;
    if (details.number) content += ` (#${details.number})`;
    content += "\n";
  }

  if (details && (details.formula || details.productName || details.productMass || details.yield)) {
    content += "Product Details:\n";
    if (details.productName) content += `  Name: ${details.productName}\n`;
    if (details.formula) content += `  Formula: ${details.formula}\n`;
    if (details.productMass) content += `  Mass: ${details.productMass}\n`;
    if (details.yield) content += `  Yield: ${details.yield}\n`;
    content += "\n";
  }

  content += "Reagents Table:\n----------------\n";
  entries.forEach((entry, index) => {
    content += `${index + 1}. ${entry.nameOrFormula}\n`;
    content += `   MW: ${entry.molarMass.toFixed(2)} g/mol\n`;
    if (entry.mass !== undefined) content += `   Mass (solute): ${entry.mass >= 1000 ? (entry.mass / 1000).toFixed(2) + " g" : entry.mass.toFixed(2) + " mg"}\n`;
    if (entry.moles !== undefined) content += `   Moles: ${entry.moles >= 1000 ? (entry.moles / 1000).toFixed(3) + " mol" : entry.moles.toFixed(3) + " mmol"}\n`;
    if (entry.equivalents !== undefined) content += `   Eq: ${entry.equivalents.toFixed(2)}\n`;
    if (entry.volume !== undefined) content += `   Vol: ${entry.volume.toFixed(3)} mL (d=${entry.density})\n`;
    if (entry.isSolution) {
      if (entry.concentrationM !== undefined) content += `   Solution: ${entry.concentrationM} M\n`;
      if (entry.concentrationWt !== undefined) content += `   Solution: ${entry.concentrationWt} wt%\n`;
      if (entry.solutionMass !== undefined) content += `   Solution Mass: ${entry.solutionMass >= 1000 ? (entry.solutionMass / 1000).toFixed(2) + " g" : entry.solutionMass.toFixed(2) + " mg"}\n`;
    }

    if (inventoryLocFn) {
      const loc = inventoryLocFn(entry.nameOrFormula, entry.properties?.formula);
      if (loc) {
        content += `   Location: ${loc}\n`;
      }
    }

    content += "\n";
  });

  if (details && details.procedure) {
    content += "\nProcedure:\n----------------\n";
    content += details.procedure;
    content += "\n";
  }

  if (details && details.reactionScheme) {
    const stages = details.reactionScheme.stages && details.reactionScheme.stages.length > 0
      ? details.reactionScheme.stages
      : [{ reactants: details.reactionScheme.reactants, conditions: details.reactionScheme.conditions, products: details.reactionScheme.products }];

    const hasScheme = stages.some((stage) => stage.reactants.length > 0 || stage.products.length > 0 || stage.conditions);
    if (hasScheme) {
      content += "\nReaction Scheme:\n----------------\n";
      stages.forEach((stage, index) => {
        const targetProducts = stage.products.length > 0 ? stage.products.map(compoundLabel).join(" + ") : index === stages.length - 1 ? details.productName || "Product" : "";
        content += `Stage ${index + 1}: ${stage.reactants.map(compoundLabel).join(" + ")} --(${stage.conditions})--> ${targetProducts}\n`;
      });
      content += "\n";
    }
  }

  content += `${TXT_EXPORT_JSON_BEGIN}\n`;
  content += `${serializePortableSynthesis(entries, details)}\n`;
  content += `${TXT_EXPORT_JSON_END}\n`;

  downloadFile(content, "chemcalc_report.txt", "text/plain");
}

export function exportToCsv(entries: ReagentEntry[], details?: SynthesisDetails, inventoryLocFn?: (name: string, formula?: string) => string | null) {
  let content = "";

  if (details && (details.title || details.number || details.formula || details.productName || details.productMass || details.yield)) {
    content += "Synthesis Details\n";
    if (details.title) content += `Title,${escapeCsvValue(details.title)}\n`;
    if (details.number) content += `Number,${escapeCsvValue(details.number)}\n`;
    if (details.productName) content += `Product Name,${escapeCsvValue(details.productName)}\n`;
    if (details.formula) content += `Product Formula,${escapeCsvValue(details.formula)}\n`;
    if (details.productMass) content += `Product Mass,${escapeCsvValue(details.productMass)}\n`;
    if (details.yield) content += `Yield,${escapeCsvValue(details.yield)}\n`;
    content += "\n";
  }

  if (details && details.procedure) {
    content += "Procedure\n";
    content += `${escapeCsvValue(details.procedure)}\n\n`;
  }

  if (details && details.reactionScheme) {
    const stages = details.reactionScheme.stages && details.reactionScheme.stages.length > 0
      ? details.reactionScheme.stages
      : [{ reactants: details.reactionScheme.reactants, conditions: details.reactionScheme.conditions, products: details.reactionScheme.products }];

    if (stages.some((stage) => stage.reactants.length > 0 || stage.products.length > 0 || stage.conditions)) {
      content += "Reaction Scheme\n";
      stages.forEach((stage, index) => {
        const targetProducts = stage.products.length > 0 ? stage.products.map(compoundLabel).join(" + ") : index === stages.length - 1 ? details.productName || "Product" : "";
        content += `Stage ${index + 1},${escapeCsvValue(`${stage.reactants.map(compoundLabel).join(" + ")} --(${stage.conditions})--> ${targetProducts}`)}\n`;
      });
      content += "\n";
    }
  }

  content += "Reagents Table\n";
  content += "Name/Formula,MW (g/mol),Mass (solute),Mass Unit,Moles,Moles Unit,Eq,Density,Volume (mL),Solution (M),Solution (wt%),Solution Mass (g),Location\n";

  entries.forEach((entry) => {
    const loc = inventoryLocFn ? inventoryLocFn(entry.nameOrFormula, entry.properties?.formula) || "" : "";

    const row = [
      escapeCsvValue(entry.nameOrFormula),
      entry.molarMass.toFixed(2),
      entry.mass !== undefined ? entry.mass.toFixed(2) : "",
      entry.massUnit || "mg",
      entry.moles !== undefined ? entry.moles.toFixed(3) : "",
      entry.molesUnit || "mmol",
      entry.equivalents !== undefined ? entry.equivalents.toFixed(2) : "",
      entry.density !== undefined ? String(entry.density) : "",
      entry.volume !== undefined ? entry.volume.toFixed(3) : "",
      entry.concentrationM !== undefined ? String(entry.concentrationM) : "",
      entry.concentrationWt !== undefined ? String(entry.concentrationWt) : "",
      entry.solutionMass !== undefined ? (entry.solutionMass / 1000).toFixed(3) : "",
      escapeCsvValue(loc),
    ];
    content += row.join(",") + "\n";
  });

  content += "\nPortable Data\n";
  content += `Export JSON,${escapeCsvValue(serializePortableSynthesis(entries, details))}\n`;

  downloadFile(content, "chemcalc_report.csv", "text/csv");
}

export async function openPublicationPdf(entries: ReagentEntry[], details: SynthesisDetails, lang: "ru" | "en", inventoryLocFn?: (name: string, formula?: string) => string | null, rootElement?: HTMLElement) {
  if (!rootElement) {
    // Fallback to old behavior if no element provided
    const inventoryLocations = entries.reduce<Record<string, string>>((acc, entry) => {
      const key = entry.id || entry.nameOrFormula;
      const location = inventoryLocFn ? inventoryLocFn(entry.nameOrFormula, entry.properties?.formula) || "" : "";
      if (location) {
        acc[key] = location;
      }
      return acc;
    }, {});

    const payload: PublicationPdfPayload = {
      entries,
      details,
      lang,
      inventoryLocations,
      generatedAt: new Date().toISOString(),
    };

    localStorage.setItem(PDF_EXPORT_STORAGE_KEY, JSON.stringify(payload));
    const previewWindow = window.open("/print", "_blank", "noopener,noreferrer");
    if (!previewWindow) {
      window.location.href = "/print";
    }
    return;
  }

  // Create a hidden iframe to render the print view for capture
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '1200px';
  iframe.style.height = '1600px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const inventoryLocations = entries.reduce<Record<string, string>>((acc, entry) => {
    const key = entry.id || entry.nameOrFormula;
    const location = inventoryLocFn ? inventoryLocFn(entry.nameOrFormula, entry.properties?.formula) || "" : "";
    if (location) {
      acc[key] = location;
    }
    return acc;
  }, {});

  const payload: PublicationPdfPayload = {
    entries,
    details,
    lang,
    inventoryLocations,
    generatedAt: new Date().toISOString(),
  };

  localStorage.setItem(PDF_EXPORT_STORAGE_KEY, JSON.stringify(payload));

  // Load the print page in the iframe. Use the current location with hash router if active,
  // or window.location.origin + '/print' for absolute
  const printUrl = window.location.origin + '/print';
  iframe.src = printUrl;
  
  await new Promise<void>((resolve) => {
    const messageListener = async (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      if (event.data?.type === 'PRINT_READY') {
        window.removeEventListener('message', messageListener);
        
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) throw new Error("Cannot access iframe document");
          
          const printShell = doc.querySelector('.print-shell') as HTMLElement;
          if (!printShell) throw new Error("Cannot find print-shell in iframe");

          // Expand it to fit content
          printShell.style.maxHeight = 'none';
          printShell.style.overflow = 'visible';

          // Ensure all SVG elements have explicit dimensions for html2canvas
          const svgs = printShell.querySelectorAll('svg');
          svgs.forEach(svg => {
            const rect = svg.getBoundingClientRect();
            // Try to get viewBox aspect ratio if width/height are missing
            let w = svg.getAttribute('width') || rect.width;
            let h = svg.getAttribute('height') || rect.height;
            
            if (!w || !h || w === 0 || h === 0) {
              const viewBox = svg.getAttribute('viewBox');
              if (viewBox) {
                 const parts = viewBox.split(' ');
                 if (parts.length === 4) {
                   w = parseFloat(parts[2]);
                   h = parseFloat(parts[3]);
                 }
              }
            }
            
            if (w && h) {
              // Set explicit pixel dimensions
              svg.style.width = typeof w === 'number' ? `${w}px` : (w.toString().includes('%') ? `${rect.width}px` : w);
              svg.style.height = typeof h === 'number' ? `${h}px` : (h.toString().includes('%') ? `${rect.height}px` : h);
              svg.setAttribute('width', parseFloat(w.toString()).toString());
              svg.setAttribute('height', parseFloat(h.toString()).toString());
              // Prevent flexbox from squishing it
              svg.style.minWidth = svg.style.width;
              svg.style.minHeight = svg.style.height;
            }
          });
          
          


          // We need a more comprehensive way to strip oklch before html2canvas sees it
          const canvas = await html2canvas(printShell, {
            scale: 4, // Увеличил scale для лучшего качества
            useCORS: true,
            logging: false,
            windowWidth: Math.max(1000, printShell.scrollWidth + 100),
            allowTaint: true,
            backgroundColor: '#ffffff',
            removeContainer: true,
            onclone: (clonedDoc) => {
               const controls = clonedDoc.querySelector('.print-controls');
               if (controls) controls.remove();
               
               // Fix reaction scheme overflow
               const schemeWrap = clonedDoc.querySelector('.overflow-x-auto') as HTMLElement;
               if (schemeWrap) {
                 schemeWrap.style.overflow = 'visible';
               }

               // html2canvas fails hard on oklch() color syntax which Tailwind v4 uses
               // We must remove or replace it from all elements in the cloned document
               
               // 1. Override CSS variables that might contain oklch
               const style = clonedDoc.createElement('style');
               style.innerHTML = `
                 :root, *, ::before, ::after {
                   --background: 0 0% 100% !important;
                   --foreground: 0 0% 0% !important;
                   --card: 0 0% 100% !important;
                   --muted: 0 0% 96% !important;
                   --muted-foreground: 0 0% 40% !important;
                   --border: 0 0% 90% !important;
                   color: #000000 !important;
                   background-color: transparent !important;
                   box-shadow: none !important;
                   border-color: #e5e5e5 !important;
                   /* Force visibility */
                   visibility: visible !important;
                   opacity: 1 !important;
                 }
                 
                 /* Specifically fix text elements that might get grey boxes */
                 span, p, h1, h2, h3, td, th {
                   color: #000000 !important;
                   background: none !important;
                   background-color: transparent !important;
                 }
                 div:not(.bg-stone-50):not(.bg-slate-900):not(.bg-white) {
                   background-color: transparent !important;
                 }
                 .print-shell { background-color: white !important; }
                 .bg-stone-50 { background-color: #fafaf9 !important; }
                 .bg-white { background-color: #ffffff !important; }
                 .bg-slate-900 { background-color: #0f172a !important; border-color: #0f172a !important; }
                 .border-slate-900 { border-color: #0f172a !important; }
                 .text-slate-900 { color: #0f172a !important; }
                 /* Keep table headers slightly grey but readable */
                 th { background-color: #f5f5f5 !important; }
                 
                 /* Allow text to wrap only where necessary */
                 .truncate {
                    white-space: normal !important;
                    overflow: visible !important;
                    text-overflow: clip !important;
                 }
                 /* Ensure table cells don't clip */
                 td, th {
                    word-wrap: break-word !important;
                    white-space: normal !important;
                 }
                 
                 /* Disable line clamping for full text visibility */
                 .line-clamp-1, .line-clamp-2, .line-clamp-3, .line-clamp-4 {
                    -webkit-line-clamp: unset !important;
                    display: block !important;
                    overflow: visible !important;
                 }
                 
                 :root {
                   --background: 0 0% 100% !important;
                   --foreground: 222.2 84% 4.9% !important;
                   --card: 0 0% 100% !important;
                   --card-foreground: 222.2 84% 4.9% !important;
                   --popover: 0 0% 100% !important;
                   --popover-foreground: 222.2 84% 4.9% !important;
                   --primary: 222.2 47.4% 11.2% !important;
                   --primary-foreground: 210 40% 98% !important;
                   --secondary: 210 40% 96.1% !important;
                   --secondary-foreground: 222.2 47.4% 11.2% !important;
                   --muted: 210 40% 96.1% !important;
                   --muted-foreground: 215.4 16.3% 46.9% !important;
                   --accent: 210 40% 96.1% !important;
                   --accent-foreground: 222.2 47.4% 11.2% !important;
                   --destructive: 0 84.2% 60.2% !important;
                   --destructive-foreground: 210 40% 98% !important;
                   --border: 214.3 31.8% 91.4% !important;
                   --input: 214.3 31.8% 91.4% !important;
                   --ring: 214.3 31.8% 91.4% !important;
                   --radius: 0.5rem !important;
                 }
               `;
               clonedDoc.head.appendChild(style);

               
               // Handle external stylesheets which html2canvas parses and crashes on
               try {
                 const links = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
                 if (links.length > 0) {
                   let combinedCss = '';
                   // The original iframe document
                   const sourceDoc = iframe.contentDocument || iframe.contentWindow?.document;
                   if (sourceDoc && sourceDoc.styleSheets) {
                     for (let i = 0; i < sourceDoc.styleSheets.length; i++) {
                       const sheet = sourceDoc.styleSheets[i];
                       try {
                         for (let j = 0; j < sheet.cssRules.length; j++) {
                           combinedCss += sheet.cssRules[j].cssText + '\n';
                         }
                       } catch(e) {
                         // ignore cross-origin stylesheet errors
                       }
                     }
                   }
                   if (combinedCss) {
                     // Replace oklch with a safe fallback
                     combinedCss = combinedCss.replace(/oklch\([^)]+\)/g, '#888888');
                     const styleNode = clonedDoc.createElement('style');
                     styleNode.innerHTML = combinedCss;
                     clonedDoc.head.appendChild(styleNode);
                     
                     // Remove original stylesheet links so html2canvas doesn't fetch and parse them
                     links.forEach(l => l.remove());
                   }
                 }
               } catch (e) {
                 console.warn("Failed to process stylesheets for oklch stripping", e);
               }
               
               // 2. Strip inline styles containing oklch
               const allElements = clonedDoc.querySelectorAll('*');
               for (let i = 0; i < allElements.length; i++) {
                 const el = allElements[i];
                 const styleAttr = el.getAttribute('style');
                 if (styleAttr && styleAttr.includes('oklch')) {
                    // Replace oklch(...) with a safe fallback
                    el.setAttribute('style', styleAttr.replace(/oklch\([^)]+\)/g, '#cccccc'));
                 }
                 
                 // Clean up classes that might trigger oklch from tailwind if needed
                 // (usually covered by the CSS variable overrides above)
               }
               
               // Remove style tags that might have oklch in them (except the one we just added)
               const styleTags = clonedDoc.querySelectorAll('style:not(:last-child)');
               for (let i = 0; i < styleTags.length; i++) {
                 const st = styleTags[i];
                 if (st.innerHTML.includes('oklch')) {
                   st.innerHTML = st.innerHTML.replace(/oklch\([^)]+\)/g, '#cccccc');
                 }
               }
            }
          });

          const imgData = canvas.toDataURL("image/jpeg", 0.95);
          const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
          });

          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          
          let pdfWidth = pageWidth;
          let pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          let xOffset = 0;
          let yOffset = 0;
          
          // Force it to fit on one portrait page by scaling down if necessary
          // First, fit to width
          if (pdfWidth > pageWidth) {
            pdfWidth = pageWidth;
            pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          }
          
          // Then, if it's still too tall, fit to height
          if (pdfHeight > pageHeight) {
            const scale = pageHeight / pdfHeight;
            pdfHeight = pageHeight;
            pdfWidth = pdfWidth * scale;
            xOffset = (pageWidth - pdfWidth) / 2; // Center horizontally
          }

          pdf.addImage(imgData, "JPEG", xOffset, yOffset, pdfWidth, pdfHeight);

          const filename = `${details.title || details.productName || "Synthesis"}_Report.pdf`.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
          
          try {
            // Try robust download using Blob first
            const blob = pdf.output("blob");
            await downloadBlob(blob, filename);
          } catch (e) {
            // Fallback to jsPDF's built-in save
            pdf.save(filename);
          }
          
        } catch (error) {
          console.error("PDF generation failed:", error);
          const errMsg = error instanceof Error ? error.message : String(error);
          alert(lang === "ru" ? `Ошибка создания PDF: ${errMsg}` : `Failed to generate PDF: ${errMsg}`);
        } finally {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          resolve();
        }
      }
    };
    
    window.addEventListener('message', messageListener);

    // Fallback polling in case message doesn't work
    iframe.onload = () => {
      let attempts = 0;
      const checkReady = () => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          const printShell = doc?.querySelector('.print-shell');
          if (printShell) {
            window.postMessage({ type: 'PRINT_READY' }, '*');
            return;
          }
        } catch(e) {
          // ignore
        }
        
        attempts++;
        if (attempts > 30) { // 15 seconds timeout
          window.removeEventListener('message', messageListener);
          console.error("Print shell timeout");
          alert(lang === "ru" ? "Ошибка: не удалось загрузить данные для PDF." : "Error: Failed to load PDF data.");
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
          resolve();
          return;
        }
        setTimeout(checkReady, 500);
      };
      checkReady();
    };
    
    iframe.onerror = () => {
       console.error("Iframe failed to load");
       alert(lang === "ru" ? "Ошибка загрузки данных PDF." : "Error loading PDF data.");
       if (document.body.contains(iframe)) document.body.removeChild(iframe);
       resolve();
    };
  });
}

async function downloadBlob(blob: Blob, filename: string) {
  // On mobile (iOS Safari), Web Share API is often more reliable for PDFs
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return; // Success
      }
    } catch (e) {
      console.warn("Share API failed or was aborted, falling back to download link", e);
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e: any) {
    throw new Error("Download link failed: " + e.message);
  }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}
