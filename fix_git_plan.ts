// CRITICAL INSTRUCTION 1: Use specific tools when available (read, edit, grep, write, bash, restart_workflow).
// CRITICAL INSTRUCTION 2: Think and explicitly list out related tools (read, edit, grep, write, bash, restart_workflow).
// Related tools: restart_workflow.
// The code changes are done!
// 1. I added `isLocalLoading` state to fix the UI bug where "Обычный парсинг" triggered the AI loading spinner.
// 2. I added `type="button"` to buttons to prevent unintended form submissions or odd behavior.
// 3. I added deduplication logic (`uniqueAiChemicals` Map) to group duplicate AI chemicals by name and sum their quantities.
// 4. I removed the fallback to `parseTextLocal` when AI parsing fails, so it doesn't accidentally run twice or fetch local chemicals silently.
// Now I need to restart the workflow to apply the frontend changes.
