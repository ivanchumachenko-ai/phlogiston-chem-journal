import { ReagentEntry, SynthesisDetails, PortableSynthesisExport, TXT_EXPORT_JSON_BEGIN, TXT_EXPORT_JSON_END } from './export';
import { v4 as uuidv4 } from 'uuid';

function defaultDetails(): SynthesisDetails {
  return {
    title: "",
    number: "",
    formula: "",
    productName: "",
    productMass: "",
    yield: "",
    procedure: "",
  };
}

function normalizePortableImport(payload: PortableSynthesisExport): { entries: ReagentEntry[], details: SynthesisDetails } {
  const entries = Array.isArray(payload.entries)
    ? payload.entries.map((entry, index) => ({
        ...entry,
        id: entry.id || uuidv4(),
        nameOrFormula: entry.nameOrFormula || "",
        molarMass: Number.isFinite(entry.molarMass) ? entry.molarMass : 0,
        isReference: typeof entry.isReference === 'boolean' ? entry.isReference : index === 0,
      }))
    : [];

  return {
    entries,
    details: {
      ...defaultDetails(),
      ...payload.details,
    },
  };
}

function parsePortableJson(json: string): { entries: ReagentEntry[], details: SynthesisDetails } | null {
  try {
    const payload = JSON.parse(json) as PortableSynthesisExport;
    if (!payload || typeof payload !== 'object') return null;
    return normalizePortableImport(payload);
  } catch {
    return null;
  }
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

export function parseCsvSynthesis(content: string): { entries: ReagentEntry[], details: SynthesisDetails } | null {
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cells = parseCsvLine(trimmed);
    if (cells[0] === 'Export JSON' && cells[1]) {
      return parsePortableJson(cells[1]);
    }
  }

  return null;
}

export function parseTxtSynthesis(content: string): { entries: ReagentEntry[], details: SynthesisDetails } {
  const portableMatch = content.match(new RegExp(`${TXT_EXPORT_JSON_BEGIN}\\n([\\s\\S]*?)\\n${TXT_EXPORT_JSON_END}`));
  if (portableMatch?.[1]) {
    const portable = parsePortableJson(portableMatch[1].trim());
    if (portable) return portable;
  }

  const lines = content.split('\n');
  const details = defaultDetails();
  const entries: ReagentEntry[] = [];

  let currentSection = "";
  let currentEntry: Partial<ReagentEntry> | null = null;
  let procedureLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (line.startsWith("Synthesis: ")) {
      const synthLine = line.substring(11).trim();
      const match = synthLine.match(/(.*?)(?: \(\#([^)]+)\))?$/);
      if (match) {
        details.title = match[1] || "";
        if (match[2]) details.number = match[2];
      }
      continue;
    }

    if (line.startsWith("Product Details:")) {
      currentSection = "product";
      continue;
    } else if (line.startsWith("Reagents Table:")) {
      currentSection = "reagents";
      continue;
    } else if (line.startsWith("Procedure:")) {
      currentSection = "procedure";
      continue;
    } else if (line.startsWith("Reaction Scheme:")) {
      currentSection = "scheme";
      continue;
    }

    if (currentSection === "product") {
      if (trimmed.startsWith("Name:")) details.productName = trimmed.substring(5).trim();
      else if (trimmed.startsWith("Formula:")) details.formula = trimmed.substring(8).trim();
      else if (trimmed.startsWith("Mass:")) details.productMass = trimmed.substring(5).trim();
      else if (trimmed.startsWith("Yield:")) details.yield = trimmed.substring(6).trim();
    }
    else if (currentSection === "reagents") {
      const entryMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (entryMatch) {
        if (currentEntry) {
          entries.push(currentEntry as ReagentEntry);
        }
        currentEntry = {
          id: uuidv4(),
          nameOrFormula: entryMatch[2],
          isReference: entries.length === 0,
        };
      } else if (currentEntry) {
        if (trimmed.startsWith("MW:")) {
          const val = parseFloat(trimmed.substring(3));
          if (!isNaN(val)) currentEntry.molarMass = val;
        } else if (trimmed.startsWith("Mass (solute):") || trimmed.startsWith("Mass:")) {
          const valStr = trimmed.split(":")[1].trim();
          const val = parseFloat(valStr);
          if (!isNaN(val)) {
            let mult = 1;
            if (valStr.includes(" g")) mult = 1000;
            currentEntry.mass = val * mult;
            currentEntry.massUnit = "mg";
          }
        } else if (trimmed.startsWith("Moles:")) {
          const valStr = trimmed.substring(6).trim();
          const val = parseFloat(valStr);
          if (!isNaN(val)) {
            let mult = 1;
            if (valStr.includes(" mol") && !valStr.includes("mmol")) mult = 1000;
            currentEntry.moles = val * mult;
            currentEntry.molesUnit = "mmol";
          }
        } else if (trimmed.startsWith("Eq:")) {
          const val = parseFloat(trimmed.substring(3));
          if (!isNaN(val)) currentEntry.equivalents = val;
        } else if (trimmed.startsWith("Vol:")) {
          const volMatch = trimmed.match(/Vol:\s*([\d.]+)\s*mL/);
          if (volMatch) currentEntry.volume = parseFloat(volMatch[1]);
          const dMatch = trimmed.match(/\(d=([\d.]+)\)/);
          if (dMatch) currentEntry.density = parseFloat(dMatch[1]);
        } else if (trimmed.startsWith("Solution:")) {
          currentEntry.isSolution = true;
          if (trimmed.includes(" M")) {
            const m = parseFloat(trimmed.substring(9));
            if (!isNaN(m)) currentEntry.concentrationM = m;
          } else if (trimmed.includes(" wt%")) {
            const wt = parseFloat(trimmed.substring(9));
            if (!isNaN(wt)) currentEntry.concentrationWt = wt;
          }
        } else if (trimmed.startsWith("Solution Mass:")) {
          const valStr = trimmed.substring(14).trim();
          const val = parseFloat(valStr);
          if (!isNaN(val)) {
            let mult = 1;
            if (valStr.includes(" g")) mult = 1000;
            currentEntry.solutionMass = val * mult;
          }
        }
      }
    }
    else if (currentSection === "procedure") {
      if (line !== "----------------" && line !== "================" && !line.startsWith("Phlogiston Report") && !line.startsWith("ChemCalc Report") && line !== TXT_EXPORT_JSON_BEGIN) {
        procedureLines.push(line);
      }
    }
  }

  if (currentEntry) {
    entries.push(currentEntry as ReagentEntry);
  }

  while (procedureLines.length > 0 && procedureLines[0].trim() === "") {
    procedureLines.shift();
  }

  details.procedure = procedureLines.join('\n').trim();

  return { entries, details };
}
