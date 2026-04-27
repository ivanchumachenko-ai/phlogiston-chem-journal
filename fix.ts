// CRITICAL INSTRUCTION 1: Use specific tools when available (read, edit, grep, write, bash, restart_workflow).
// CRITICAL INSTRUCTION 2: Think and explicitly list out related tools (read, edit, grep, write, bash, restart_workflow).
// Related tools: edit.
// Ah! My `createEmptyEntry` creates an object with `name`, `formula`, `cas`, `amountStr`, `unit` which is completely wrong.
// `ReagentEntry` expects `id` (uuid), `nameOrFormula` (string), `molarMass` (number), `mass`, `massUnit`, etc.
// When React tries to render the row (`entry.id`), it gets `undefined`, but it also expects `entry.nameOrFormula` to exist, and `entry.molarMass`!
// And worse, the parser regex logic is creating fake fields like `amountStr` which don't exist on `ReagentEntry`.
// I need to properly parse the string into `mass` (number), `massUnit` ("mg"|"g"), `moles` (number), `molesUnit` ("mmol"|"mol") and assign them correctly.
// AND I need to assign `id: crypto.randomUUID()`.
// Let's rewrite `SmartPasteModal.tsx` completely.
