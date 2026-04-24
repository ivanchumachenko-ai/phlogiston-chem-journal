import { useEffect, useRef, useState } from "react";
import { StandaloneStructServiceProvider } from "ketcher-standalone";
import { Editor } from "ketcher-react";
import "ketcher-react/dist/index.css";
import { toast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";
import { calculateFormulaFromMolfile, areFormulasConsistent } from "@/lib/chemistry";

const structServiceProvider = new StandaloneStructServiceProvider();

interface StructureEditorProps {
  onFormulaCalculated: (formula: string, smiles: string, molfile: string, name?: string, rxnCode?: string) => void;
  onClose: () => void;
  mode?: "molecule" | "reaction";
  initialStructure?: string;
}

async function fetchTextWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchJsonWithTimeout(url: string, init: RequestInit | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function lookupStructureName(smiles: string) {
  const cidData = await fetchJsonWithTimeout(
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/cids/JSON",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `smiles=${encodeURIComponent(smiles)}`,
    },
    1200,
  );

  const cid = cidData?.IdentifierList?.CID?.[0];
  if (cid) {
    const propsData = await fetchJsonWithTimeout(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/IUPACName,MolecularFormula/JSON`,
      undefined,
      1200,
    );

    const props = propsData?.PropertyTable?.Properties?.[0];
    if (props?.IUPACName || props?.MolecularFormula) {
      return {
        name: props?.IUPACName as string | undefined,
        formula: props?.MolecularFormula as string | undefined,
      };
    }
  }

  const cactusName = await fetchTextWithTimeout(
    `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smiles)}/iupac_name`,
    900,
  );

  if (cactusName && !cactusName.includes("<html")) {
    return {
      name: cactusName.split("\n")[0].trim(),
      formula: undefined,
    };
  }

  return null;
}

export function StructureEditor({ onFormulaCalculated, onClose, mode = "molecule", initialStructure }: StructureEditorProps) {
  const ketcherRef = useRef<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!ketcherRef.current || mode !== "molecule") return;

    const applyInitialStructure = async () => {
      try {
        await ketcherRef.current.setMolecule(initialStructure || "");
      } catch (e) {
        console.error("Failed to preload structure into ketcher", e);
      }
    };

    applyInitialStructure();
  }, [initialStructure, mode]);

  const handleGetFormula = async () => {
    if (!ketcherRef.current) return;

    try {
      setIsProcessing(true);

      if (mode === "reaction") {
        const rxnCode = await ketcherRef.current.getRxn();
        onFormulaCalculated("", "", "", "", rxnCode);
        return;
      }

      const [smiles, molfile] = await Promise.all([
        ketcherRef.current.getSmiles(),
        ketcherRef.current.getMolfile(),
      ]);

      let formula = "";

      try {
        const calcResult = await ketcherRef.current.calculate({
          properties: ["gross"],
        });
        if (calcResult?.gross) {
          formula = String(calcResult.gross).replace(/\s+/g, "");
        }
        
        // Overwrite with our robust molfile calculator if ketcher misses implicit hydrogens
        const molfileFormula = calculateFormulaFromMolfile(molfile);
        if (molfileFormula && molfileFormula !== formula) {
           formula = molfileFormula;
        }
      } catch (e) {
        console.error("Failed to calculate formula locally", e);
        const molfileFormula = calculateFormulaFromMolfile(molfile);
        if (molfileFormula) {
            formula = molfileFormula;
        }
      }

      let name: string | undefined;

      if (smiles) {
        const lookupResult = await lookupStructureName(smiles);
        if (lookupResult?.name) {
          name = lookupResult.name;
        }
        if (lookupResult?.formula) {
          // Only overwrite our locally calculated formula if they are consistent (e.g. PubChem returned the same composition)
          // or if our local calculation failed completely.
          // This prevents "cyclohexahexaene" (C6) from overriding "cyclohexane" (C6H12)
          if (!formula || areFormulasConsistent(formula, lookupResult.formula)) {
            formula = lookupResult.formula;
          } else {
             // If formulas are inconsistent, it means the SMILES lookup gave us a different molecule than drawn.
             // We shouldn't use its name either.
             name = undefined;
             console.warn(`Mismatch in formula from API: expected ${formula}, got ${lookupResult.formula}. Ignoring API result.`);
          }
        }
      }

      onFormulaCalculated(formula, smiles, molfile, name);
    } catch (e) {
      console.error(e);
      toast({
        title: t("error"),
        description: t("errorKetcher"),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-[600px] w-full flex-col overflow-hidden rounded-lg border border-border bg-white dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b bg-muted/30 p-3">
        <h3 className="text-sm font-medium">
          {mode === "reaction" ? t("reactionEditorTitle") : t("structureEditorTitle")}
        </h3>
      </div>
      <div className="relative flex-1 w-full">
        
        <Editor
          staticResourcesUrl={""}
          structServiceProvider={structServiceProvider}
          errorHandler={(msg: string) => console.error(msg)}
          onInit={(ketcher) => {

            ketcherRef.current = ketcher;
            if (mode === "molecule") {
              ketcher.setMolecule(initialStructure || "").catch((e: unknown) => {
                console.error("Failed to preload structure into ketcher", e);
              });
            }
          }}
        />
      </div>
      <div className="flex justify-end gap-2 border-t bg-muted/50 p-4">
        <button
          onClick={onClose}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          data-testid="button-structure-cancel"
        >
          {t("cancel")}
        </button>
        <button
          onClick={handleGetFormula}
          disabled={isProcessing}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          data-testid="button-structure-use"
        >
          {isProcessing ? t("processing") : t("useStructure")}
        </button>
      </div>
    </div>
  );
}
