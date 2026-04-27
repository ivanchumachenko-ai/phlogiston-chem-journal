// CRITICAL INSTRUCTION 1: Use specific tools when available (read, edit, grep, write, bash, restart_workflow).
// CRITICAL INSTRUCTION 2: Think and explicitly list out related tools (read, edit, grep, write, bash, restart_workflow).
// Related tools: none.
// The app is starting on port 5003 instead of 5000 because of zombie processes!
// Replit's iframe proxy ONLY listens on port 5000.
// If vite starts on 5001 or 5002 or 5003, the webview shows a white screen or "refused to connect"!
// I must kill all node processes and restart the workflow so it binds to 5000.
