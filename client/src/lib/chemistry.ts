export const ATOMIC_WEIGHTS: Record<string, number> = {
  H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Ne: 20.180,
  Na: 22.990, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.948,
  K: 39.098, Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996, Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Ga: 69.723, Ge: 72.630, As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798,
  Rb: 85.468, Sr: 87.62, Y: 88.906, Zr: 91.224, Nb: 92.906, Mo: 95.95, Tc: 98, Ru: 101.07, Rh: 102.91, Pd: 106.42, Ag: 107.87, Cd: 112.41, In: 114.82, Sn: 118.71, Sb: 121.76, Te: 127.60, I: 126.90, Xe: 131.29,
  Cs: 132.91, Ba: 137.33, La: 138.91, Ce: 140.12, Pr: 140.91, Nd: 144.24, Pm: 145, Sm: 150.36, Eu: 151.96, Gd: 157.25, Tb: 158.93, Dy: 162.50, Ho: 164.93, Er: 167.26, Tm: 168.93, Yb: 173.05, Lu: 174.97, Hf: 178.49, Ta: 180.95, W: 183.84, Re: 186.21, Os: 190.23, Ir: 192.22, Pt: 195.08, Au: 196.97, Hg: 200.59, Tl: 204.38, Pb: 207.2, Bi: 208.98
};

export function calculate_molar_mass(formula: string): number {
  if (!formula) return 0;
  
  let currentPos = 0;

  function parseGroup(): number {
    let mass = 0;
    while (currentPos < formula.length) {
      let char = formula[currentPos];
      if (char === '(' || char === '[' || char === '{') {
        currentPos++;
        let groupMass = parseGroup();
        let count = 1;
        
        if (currentPos < formula.length) {
            const countMatch = formula.slice(currentPos).match(/^[0-9]+(?:\.[0-9]+)?/);
            if (countMatch) {
                count = parseFloat(countMatch[0]);
                currentPos += countMatch[0].length;
            }
        }
        mass += groupMass * count;
      } else if (char === ')' || char === ']' || char === '}') {
        currentPos++;
        return mass;
      } else {
            const elemMatch = formula.slice(currentPos).match(/^[A-Z][a-z]?/);
            if (elemMatch) {
                const element = elemMatch[0];
                currentPos += element.length;
                let count = 1;
                const countMatch = formula.slice(currentPos).match(/^[0-9]+(?:\.[0-9]+)?/);
                if (countMatch) {
                    count = parseFloat(countMatch[0]);
                    currentPos += countMatch[0].length;
                }
                if (ATOMIC_WEIGHTS[element]) {
                    mass += ATOMIC_WEIGHTS[element] * count;
                } else {
                    // Ignore unknown elements for now, or just add 0
                }
            } else {
                currentPos++; // Skip invalid characters like spaces, double bonds, or symbols
            }
      }
    }
    return mass;
  }

  try {
      const mass = parseGroup();
      return Math.round(mass * 1000) / 1000;
  } catch (e) {
      return 0; 
  }
}

import { EXTENDED_DB } from "./database";

export interface ChemicalProperties {
    name: string;
    formula: string;
    density?: number; // g/mL
    mp?: number; // °C
    bp?: number; // °C
    cid?: string; // PubChem Compound ID for images/links
    mw?: number; // Pre-calculated molecular weight
    smiles?: string; // SMILES for structure rendering
    molfile?: string;
}

const PUBCHEM_CACHE_KEY = "chemcalc_pubchem_cache_v2";
const PUBCHEM_INFLIGHT = new Map<string, Promise<ChemicalProperties | null>>();

function normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, " ");
}

function getPubchemCache(): Record<string, ChemicalProperties> {
    try {
        const data = localStorage.getItem(PUBCHEM_CACHE_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
}

function savePubchemCache(cache: Record<string, ChemicalProperties>) {
    try {
        localStorage.setItem(PUBCHEM_CACHE_KEY, JSON.stringify(cache));
    } catch {
        // ignore
    }
}

function cacheChemicalResult(cache: Record<string, ChemicalProperties>, result: ChemicalProperties, aliases: Array<string | undefined>) {
    aliases
        .filter((alias): alias is string => Boolean(alias && alias.trim()))
        .map((alias) => normalizeQuery(alias))
        .forEach((alias) => {
            cache[alias] = result;
        });
    savePubchemCache(cache);
}

function isPubChemCacheComplete(result: ChemicalProperties | undefined) {
    if (!result) return false;
    return Boolean(result.cid || result.smiles || result.molfile);
}

function mergeChemicalProperties(base: ChemicalProperties | null, enriched: ChemicalProperties | null, fallbackQuery: string): ChemicalProperties | null {
    if (!base && !enriched) return null;

    return {
        name: enriched?.name || base?.name || fallbackQuery,
        formula: enriched?.formula || base?.formula || fallbackQuery,
        density: base?.density ?? enriched?.density,
        mp: base?.mp ?? enriched?.mp,
        bp: base?.bp ?? enriched?.bp,
        cid: enriched?.cid || base?.cid,
        mw: enriched?.mw ?? base?.mw,
        smiles: base?.smiles || enriched?.smiles,
        molfile: base?.molfile || enriched?.molfile,
    };
}

export async function get_properties_async(query: string): Promise<ChemicalProperties | null> {
    if (!query) return null;
    const q = normalizeQuery(query);
    let baseResult: ChemicalProperties | null = null;
    
    try {
        const customData = localStorage.getItem("chemcalc_custom_reagents");
        if (customData) {
            const customReagents = JSON.parse(customData);
            const match = customReagents.find((r: any) =>
                normalizeQuery(r.shortcut || "") === q ||
                normalizeQuery(r.name || "") === q ||
                normalizeQuery(r.formula || "") === q
            );
            if (match) {
                baseResult = {
                    name: match.name,
                    formula: match.formula,
                    density: match.density,
                    mp: match.mp,
                    bp: match.bp,
                    smiles: match.smiles,
                    molfile: match.molfile
                };
            }
        }
    } catch (e) {
        console.error("Failed to parse custom reagents", e);
    }
    
    if (!baseResult && EXTENDED_DB[q]) {
        baseResult = EXTENDED_DB[q];
    }
    
    if (!baseResult) {
        for (const key in EXTENDED_DB) {
            if (normalizeQuery(EXTENDED_DB[key].name) === q || normalizeQuery(EXTENDED_DB[key].formula) === q) {
                baseResult = EXTENDED_DB[key];
                break;
            }
        }
    }

    const cache = getPubchemCache();
    const cachedResult = cache[q];
    if (cachedResult && cachedResult.cid && cachedResult.molfile) {
        return mergeChemicalProperties(baseResult, cachedResult, query);
    }
    if (cachedResult && isPubChemCacheComplete(cachedResult)) {
        baseResult = mergeChemicalProperties(baseResult, cachedResult, query);
    }
    if (PUBCHEM_INFLIGHT.has(q)) return PUBCHEM_INFLIGHT.get(q)!;

    const request = (async () => {
        try {
            const hasSpaces = query.includes(' ');
            const hasSmilesChars = query.includes('=') || 
                                query.includes('#') || 
                                query.includes('@') || 
                                query.includes('\\') || 
                                query.includes('/') ||
                                query.includes('(') ||
                                query.includes(')') ||
                                query.includes('[') ||
                                query.includes(']');
                                
            const hasRingClosures = /[a-zA-Z][1-9]/.test(query) && !/H[1-9]/.test(query) && !/^[A-Z][a-z]?\d*$/.test(query);

            const definitelySmiles = !hasSpaces && (hasSmilesChars || hasRingClosures);
            let isLikelySmiles = false;

            const fetchPubChemCid = async (url: string, init?: RequestInit) => {
                const response = await fetch(url, init);
                if (!response.ok) return undefined;
                const data = await response.json();
                const foundCid = data?.IdentifierList?.CID?.[0];
                return foundCid ? String(foundCid) : undefined;
            };

            const fetchPubChemMolfile = async (compoundCid: string) => {
                const response = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${compoundCid}/record/SDF?record_type=2d`);
                if (!response.ok) return undefined;
                const molfile = await response.text();
                return molfile.trim() || undefined;
            };

            let cid: string | undefined;

            if (definitelySmiles) {
                cid = await fetchPubChemCid(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/cids/JSON`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `smiles=${encodeURIComponent(query)}`
                });
                isLikelySmiles = Boolean(cid);
            }

            if (!cid) {
                cid = await fetchPubChemCid(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`);
                if (cid) isLikelySmiles = false;
            }

            if (!cid) {
                cid = await fetchPubChemCid(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastformula/${encodeURIComponent(query)}/cids/JSON`);
                if (cid) isLikelySmiles = false;
            }

            if (!cid && !hasSpaces && !definitelySmiles) {
                cid = await fetchPubChemCid(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/cids/JSON`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `smiles=${encodeURIComponent(query)}`
                });
                isLikelySmiles = Boolean(cid);
            }
            
            if (!cid) {
                try {
                    const cactusUrl = `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(query)}/formula`;
                    const cactusResponse = await fetch(cactusUrl);
                    if (cactusResponse.ok) {
                        const formulaText = await cactusResponse.text();
                        if (formulaText && !formulaText.includes('<html')) {
                            let finalName = query;
                            if (isLikelySmiles) {
                                try {
                                    const nameResponse = await fetch(`https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(query)}/iupac_name`);
                                    if (nameResponse.ok) {
                                        const nameText = await nameResponse.text();
                                        if (nameText && !nameText.includes('<html')) {
                                            finalName = nameText.split('\n')[0].trim();
                                        }
                                    }
                                } catch (e) {
                                    console.error("Failed to get IUPAC name from cactus", e);
                                }
                            }

                            const cactusResult: ChemicalProperties = {
                                name: finalName,
                                formula: formulaText.trim(),
                                mw: calculate_molar_mass(formulaText.trim()),
                                smiles: isLikelySmiles ? query : undefined
                            };
                            const mergedCactus = mergeChemicalProperties(baseResult, cactusResult, query);
                            if (mergedCactus) {
                                cacheChemicalResult(cache, mergedCactus, [query, mergedCactus.name, mergedCactus.formula, mergedCactus.smiles]);
                            }
                            return mergedCactus;
                        }
                    }
                } catch (e) {
                    console.error("Cactus API fallback failed", e);
                }
            }

            if (cid) {
                const response = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,ConnectivitySMILES/JSON`);
                if (response.ok) {
                    const data = await response.json();
                    if (data?.PropertyTable?.Properties?.length > 0) {
                        const props = data.PropertyTable.Properties[0];
                        
                        let density: number | undefined = undefined;
                        
                        try {
                            const densResp = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=Density`);
                            if (densResp.ok) {
                                const densData = await densResp.json();
                                const section1 = densData?.Record?.Section?.find((s: any) => s.TOCHeading === "Chemical and Physical Properties");
                                const section2 = section1?.Section?.find((s: any) => s.TOCHeading === "Experimental Properties");
                                const section3 = section2?.Section?.find((s: any) => s.TOCHeading === "Density");
                                
                                if (section3?.Information) {
                                    for (const info of section3.Information) {
                                        const str = info?.Value?.StringWithMarkup?.[0]?.String;
                                        if (str) {
                                            const match = str.match(/(\d+\.\d{1,4})/);
                                            if (match) {
                                                const val = parseFloat(match[1]);
                                                if (val > 0.5 && val < 5.0) {
                                                    density = val;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            console.error("Failed to fetch density from PubChem:", e);
                        }

                        const remoteMolfile = await fetchPubChemMolfile(cid);

                        const remoteResult: ChemicalProperties = {
                            name: props.IUPACName || query,
                            formula: props.MolecularFormula,
                            cid,
                            density,
                            mw: props.MolecularWeight ? parseFloat(props.MolecularWeight) : undefined,
                            smiles: props.ConnectivitySMILES || (isLikelySmiles ? query : undefined),
                            molfile: remoteMolfile,
                        };

                        const mergedResult = mergeChemicalProperties(baseResult, remoteResult, query);
                        if (mergedResult) {
                            cacheChemicalResult(cache, mergedResult, [query, mergedResult.name, mergedResult.formula, mergedResult.smiles, mergedResult.cid ? `cid:${mergedResult.cid}` : undefined]);
                        }
                        return mergedResult;
                    }
                }
            }
        } catch (e) {
            console.error("Failed to fetch from PubChem:", e);
        }
        
        return baseResult;
    })();

    PUBCHEM_INFLIGHT.set(q, request);

    try {
        return await request;
    } finally {
        PUBCHEM_INFLIGHT.delete(q);
    }
}

export function get_properties(query: string): ChemicalProperties | null {
    if (!query) return null;
    const q = normalizeQuery(query);
    
    // 0. Check custom reagents
    try {
        const customData = localStorage.getItem("chemcalc_custom_reagents");
        if (customData) {
            const customReagents = JSON.parse(customData);
            const match = customReagents.find((r: any) =>
                normalizeQuery(r.shortcut || "") === q ||
                normalizeQuery(r.name || "") === q ||
                normalizeQuery(r.formula || "") === q
            );
            if (match) {
                return {
                    name: match.name,
                    formula: match.formula,
                    density: match.density,
                    mp: match.mp,
                    bp: match.bp,
                    smiles: match.smiles,
                    molfile: match.molfile
                };
            }
        }
    } catch (e) {
        // ignore
    }

    if (EXTENDED_DB[q]) return EXTENDED_DB[q];
    
    for (const key in EXTENDED_DB) {
        if (normalizeQuery(EXTENDED_DB[key].name) === q || normalizeQuery(EXTENDED_DB[key].formula) === q) {
            return EXTENDED_DB[key];
        }
    }
    return null;
}

export function calculateFormulaFromMolfile(molfile: string): string {
    if (!molfile) return "";
    const lines = molfile.split('\n');
    if (lines.length < 4) return "";

    const countsLine = lines[3];
    const numAtoms = parseInt(countsLine.substring(0, 3).trim(), 10);
    const numBonds = parseInt(countsLine.substring(3, 6).trim(), 10);

    if (isNaN(numAtoms) || isNaN(numBonds)) return "";

    const atoms: { symbol: string, charge: number, radical: number, bondOrderSum: number }[] = [];
    
    for (let i = 0; i < numAtoms; i++) {
        const line = lines[4 + i];
        if (!line) continue;
        const symbol = line.substring(31, 34).trim();
        atoms.push({ symbol, charge: 0, radical: 0, bondOrderSum: 0 });
    }

    for (let i = 0; i < numBonds; i++) {
        const line = lines[4 + numAtoms + i];
        if (!line) continue;
        const atom1 = parseInt(line.substring(0, 3).trim(), 10) - 1;
        const atom2 = parseInt(line.substring(3, 6).trim(), 10) - 1;
        const bondType = parseInt(line.substring(6, 9).trim(), 10);
        
        let order = 1;
        if (bondType === 2) order = 2;
        else if (bondType === 3) order = 3;
        else if (bondType === 4) order = 1.5;
        
        if (atoms[atom1]) atoms[atom1].bondOrderSum += order;
        if (atoms[atom2]) atoms[atom2].bondOrderSum += order;
    }

    for (let i = 4 + numAtoms + numBonds; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("M  CHG")) {
            const parts = line.trim().split(/\s+/);
            const numEntries = parseInt(parts[2], 10);
            for (let j = 0; j < numEntries; j++) {
                const atomIdx = parseInt(parts[3 + j*2], 10) - 1;
                const charge = parseInt(parts[4 + j*2], 10);
                if (atoms[atomIdx]) atoms[atomIdx].charge = charge;
            }
        }
    }

    let hydrogenCount = 0;
    const elementCounts: Record<string, number> = {};

    for (const atom of atoms) {
        if (atom.symbol === "H") {
             elementCounts["H"] = (elementCounts["H"] || 0) + 1;
             continue;
        }

        elementCounts[atom.symbol] = (elementCounts[atom.symbol] || 0) + 1;

        let targetValence = 0;
        const currentBonds = Math.ceil(atom.bondOrderSum);

        switch (atom.symbol) {
            case 'C': targetValence = 4; break;
            case 'N': targetValence = 3; break;
            case 'O': targetValence = 2; break;
            case 'S': 
                if (currentBonds <= 2) targetValence = 2;
                else if (currentBonds <= 4) targetValence = 4;
                else targetValence = 6;
                break;
            case 'P':
                if (currentBonds <= 3) targetValence = 3;
                else targetValence = 5;
                break;
            case 'F': case 'Cl': case 'Br': case 'I': 
                targetValence = 1; break;
            case 'B': targetValence = 3; break;
        }

        if (targetValence > 0) {
            let adjustedValence = targetValence;
            if (atom.symbol === 'C') adjustedValence -= Math.abs(atom.charge);
            else if (atom.symbol === 'N') {
                if (atom.charge === 1) adjustedValence = 4;
                else if (atom.charge === -1) adjustedValence = 2;
            } else if (atom.symbol === 'O') {
                if (atom.charge === -1) adjustedValence = 1;
                else if (atom.charge === 1) adjustedValence = 3;
            }

            const implicitH = Math.max(0, adjustedValence - currentBonds);
            hydrogenCount += implicitH;
        }
    }

    if (hydrogenCount > 0) {
        elementCounts["H"] = (elementCounts["H"] || 0) + hydrogenCount;
    }

    let formula = "";
    if (elementCounts["C"]) {
        formula += "C" + (elementCounts["C"] > 1 ? elementCounts["C"] : "");
        delete elementCounts["C"];
        if (elementCounts["H"]) {
            formula += "H" + (elementCounts["H"] > 1 ? elementCounts["H"] : "");
            delete elementCounts["H"];
        }
    }
    
    const sortedElements = Object.keys(elementCounts).sort();
    for (const el of sortedElements) {
        if (elementCounts[el] > 0) {
            formula += el + (elementCounts[el] > 1 ? elementCounts[el] : "");
        }
    }

    return formula;
}
export function parseFormula(formula: string): Record<string, number> {
    const counts: Record<string, number> = {};
    if (!formula) return counts;
    
    // Remove spaces and special characters that might confuse parsing
    const cleanFormula = formula.replace(/[^a-zA-Z0-9]/g, '');
    
    const regex = /([A-Z][a-z]*)(\d*)/g;
    let match;
    while ((match = regex.exec(cleanFormula)) !== null) {
      const element = match[1];
      const count = match[2] === "" ? 1 : parseInt(match[2], 10);
      counts[element] = (counts[element] || 0) + count;
    }
    return counts;
  }
  
export function areFormulasConsistent(f1: string, f2: string): boolean {
    if (!f1 || !f2) return false;
    
    const c1 = parseFormula(f1);
    const c2 = parseFormula(f2);
    
    const elements = new Set([...Object.keys(c1), ...Object.keys(c2)]);
    
    if (Object.keys(c1).length === 0 || Object.keys(c2).length === 0) return false;
    
    for (const el of Array.from(elements)) {
      if ((c1[el] || 0) !== (c2[el] || 0)) return false;
    }
    
    return true;
}
