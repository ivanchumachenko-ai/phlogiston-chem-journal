export const isIsolatedJournal = import.meta.env.MODE === "isolated";
export const isolatedJournalUrl = "https://phlogiston-private-journal.politeloom64.chatgpt.site";
export const showJournalTransfer = isIsolatedJournal ||
  new URLSearchParams(location.search).get("personal-journal") === "1";
