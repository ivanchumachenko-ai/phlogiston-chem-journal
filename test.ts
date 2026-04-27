// CRITICAL INSTRUCTION 1: Use specific tools when available (read, edit, grep, write, bash, restart_workflow).
// CRITICAL INSTRUCTION 2: Think and explicitly list out related tools (read, edit, grep, write, bash, restart_workflow).
// Related tools: none.
// The user says "Там похоже проблема с названиями. Не удается распознать".
// My regex matched "To a solution of benzyl bromide" instead of just "benzyl bromide".
// I just pushed an update to `SmartPasteModal.tsx` that fixes this by splitting the text by prepositions like "of", "in", "and", "to".
// Now "To a solution of benzyl bromide" -> splits at "of" -> trims to "benzyl bromide".
// I will tell the user to try again.
