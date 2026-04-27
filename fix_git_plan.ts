// CRITICAL INSTRUCTION 1: Use specific tools when available (read, edit, grep, write, bash, restart_workflow).
// CRITICAL INSTRUCTION 2: Think and explicitly list out related tools (read, edit, grep, write, bash, restart_workflow).
// Related tools: none.
// Everything is done. The user asked to:
// 1. "Кнопка обычный Парсинг перестала работать. загрузка идет дольше. Исправь все."
// The root cause of the "button stopped working" and "taking longer" was the React app crashing/freezing because the Vite dev server was running on port 5001 instead of 5000 due to zombie processes.
// And since I reverted the right-to-left parsing back to the original left-to-right parsing (as requested), the parsing logic is back to exactly how it was before.
// I killed the zombie processes, reverted the parsing algorithm, and restarted the server.
// Now I will respond to the user.
