// Shared font settings for the procedure text (editor + PDF/print view).
// System font stacks are used so everything keeps working offline.

export interface ProcedureStyle {
  fontSize: number; // px
  fontFamily: ProcedureFontId;
}

export type ProcedureFontId = "inter" | "arial" | "times" | "georgia" | "courier" | "mono";

export const PROCEDURE_FONTS: Array<{ id: ProcedureFontId; label: string; css: string }> = [
  { id: "inter", label: "Inter", css: "'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { id: "arial", label: "Arial", css: "Arial, 'Helvetica Neue', Helvetica, sans-serif" },
  { id: "times", label: "Times New Roman", css: "'Times New Roman', Times, 'Liberation Serif', serif" },
  { id: "georgia", label: "Georgia", css: "Georgia, 'Palatino Linotype', Palatino, serif" },
  { id: "courier", label: "Courier New", css: "'Courier New', Courier, 'Liberation Mono', monospace" },
  { id: "mono", label: "JetBrains Mono", css: "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace" },
];

export const PROCEDURE_FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28];
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 36;

export const DEFAULT_PROCEDURE_STYLE: ProcedureStyle = { fontSize: 14, fontFamily: "inter" };

export function normalizeProcedureStyle(style?: Partial<ProcedureStyle> | null): ProcedureStyle {
  const size = Number(style?.fontSize);
  const family = PROCEDURE_FONTS.some((f) => f.id === style?.fontFamily)
    ? (style!.fontFamily as ProcedureFontId)
    : DEFAULT_PROCEDURE_STYLE.fontFamily;
  return {
    fontSize: Number.isFinite(size) ? Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size))) : DEFAULT_PROCEDURE_STYLE.fontSize,
    fontFamily: family,
  };
}

export function fontCss(id: ProcedureFontId): string {
  return (PROCEDURE_FONTS.find((f) => f.id === id) || PROCEDURE_FONTS[0]).css;
}

// ---------- Plain-text list helpers ----------

export const BULLET = "•";
const LIST_RE = /^(\s*)(?:(•|-|\*)|(\d+)[.)])\s+/;

type ListKind = "bullet" | "number";

function stripListPrefix(line: string): string {
  return line.replace(LIST_RE, "$1");
}

function lineKind(line: string): ListKind | null {
  const m = line.match(LIST_RE);
  if (!m) return null;
  return m[3] !== undefined ? "number" : "bullet";
}

/**
 * Toggle a bullet / numbered list on every line touched by the selection.
 * Returns the new text and the new selection range.
 */
export function toggleList(text: string, selStart: number, selEnd: number, kind: ListKind) {
  const blockStart = text.lastIndexOf("\n", selStart - 1) + 1;
  let blockEnd = text.indexOf("\n", selEnd > selStart && text[selEnd - 1] === "\n" ? selEnd - 1 : selEnd);
  if (blockEnd === -1) blockEnd = text.length;

  const lines = text.slice(blockStart, blockEnd).split("\n");
  const nonEmpty = lines.filter((l) => l.trim() !== "");
  const allAlready = nonEmpty.length > 0 && nonEmpty.every((l) => lineKind(l) === kind);

  let n = 0;
  const newLines = lines.map((line) => {
    const base = stripListPrefix(line);
    if (allAlready) return base;
    if (base.trim() === "" && lines.length > 1) return base;
    const indent = base.match(/^\s*/)![0];
    const body = base.slice(indent.length);
    n += 1;
    return kind === "bullet" ? `${indent}${BULLET} ${body}` : `${indent}${n}. ${body}`;
  });

  const block = newLines.join("\n");
  const newText = text.slice(0, blockStart) + block + text.slice(blockEnd);
  return { text: newText, selStart: blockStart, selEnd: blockStart + block.length };
}

/**
 * Handle Enter inside a list item: continue the list, or end it when the item is empty.
 * Returns null when the cursor is not on a list line.
 */
export function continueList(text: string, cursor: number) {
  const lineStart = text.lastIndexOf("\n", cursor - 1) + 1;
  let lineEnd = text.indexOf("\n", cursor);
  if (lineEnd === -1) lineEnd = text.length;
  const line = text.slice(lineStart, lineEnd);
  const m = line.match(LIST_RE);
  if (!m) return null;

  const prefixLen = m[0].length;
  if (cursor < lineStart + prefixLen) return null;

  // Empty item -> remove the marker and leave the list
  if (line.slice(prefixLen).trim() === "") {
    const newText = text.slice(0, lineStart) + m[1] + text.slice(lineEnd);
    const pos = lineStart + m[1].length;
    return { text: newText, cursor: pos };
  }

  const indent = m[1];
  const marker = m[3] !== undefined ? `${parseInt(m[3], 10) + 1}. ` : `${m[2]} `;
  const insert = `\n${indent}${marker}`;
  let newText = text.slice(0, cursor) + insert + text.slice(cursor);

  // Renumber the following items of the same numbered list
  if (m[3] !== undefined) {
    let next = parseInt(m[3], 10) + 2;
    let pos = cursor + insert.length;
    let nl = newText.indexOf("\n", pos);
    while (nl !== -1) {
      const ls = nl + 1;
      let le = newText.indexOf("\n", ls);
      if (le === -1) le = newText.length;
      const l = newText.slice(ls, le);
      const mm = l.match(/^(\s*)(\d+)([.)])\s+/);
      if (!mm || mm[1] !== indent) break;
      const replaced = `${mm[1]}${next}${mm[3]} ` + l.slice(mm[0].length);
      newText = newText.slice(0, ls) + replaced + newText.slice(le);
      next += 1;
      nl = newText.indexOf("\n", ls);
    }
  }

  return { text: newText, cursor: cursor + insert.length };
}

/** Indent / outdent list lines touched by the selection (Tab / Shift+Tab). */
export function shiftIndent(text: string, selStart: number, selEnd: number, outdent: boolean) {
  const blockStart = text.lastIndexOf("\n", selStart - 1) + 1;
  let blockEnd = text.indexOf("\n", selEnd);
  if (blockEnd === -1) blockEnd = text.length;
  const lines = text.slice(blockStart, blockEnd).split("\n");
  let firstDelta = 0;
  let total = 0;
  const newLines = lines.map((line, i) => {
    let res = line;
    if (outdent) {
      const remove = line.startsWith("    ") ? 4 : line.startsWith("\t") ? 1 : (line.match(/^ {1,3}/)?.[0].length || 0);
      res = line.slice(remove);
    } else {
      res = "    " + line;
    }
    const delta = res.length - line.length;
    if (i === 0) firstDelta = delta;
    total += delta;
    return res;
  });
  const block = newLines.join("\n");
  return {
    text: text.slice(0, blockStart) + block + text.slice(blockEnd),
    selStart: Math.max(blockStart, selStart + firstDelta),
    selEnd: Math.max(blockStart, selEnd + total),
  };
}
