export async function parseWithFreeAI(text: string): Promise<any[]> {
  const prompt = `
You are a chemistry assistant. Extract ONLY REAL chemical substances (reagents, solvents, products) from the following experimental procedure text.
DO NOT extract glassware (flask, beaker), equipment, conditions, prepositions ("To a solution of", "was added"), or actions.
Return ONLY a JSON object with a "chemicals" array. Do not use markdown blocks.
Each object in the array must have the following exact structure:
{
  "name": "ONLY the clean chemical name (e.g. 'benzyl bromide', 'DMF', 'K2CO3')",
  "mass": number (amount in mg, g, or kg. or null if none),
  "massUnit": "mg" or "g" (or null if none),
  "volume": number (amount in uL, mL, or L. or null if none),
  "volumeUnit": "uL" or "mL" (or null if none),
  "moles": number (amount in mmol or mol. or null if none),
  "molesUnit": "mmol" or "mol" (or null if none)
}

Important Rules:
- If a substance only has volume (like a solvent), mass and moles must be null.
- If a substance only has mass/moles, volume must be null.
- Never invent amounts. If an amount is missing, use null.
- Convert kg to g (multiply by 1000). Convert L to mL (multiply by 1000).
- Expand common chemical abbreviations into their full names (e.g., "EtOAc" -> "Ethyl acetate", "DCM" -> "Dichloromethane", "MeOH" -> "Methanol", "EtOH" -> "Ethanol", "DMF" -> "Dimethylformamide", "THF" -> "Tetrahydrofuran"). This helps match them against databases.

Text:
"${text}"
`;

  const response = await fetch("https://text.pollinations.ai/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      jsonMode: true
    })
  });

  if (!response.ok) {
    throw new Error("Failed to fetch from AI service");
  }

  const rawText = await response.text();
  let jsonString = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
  
  const parsed = JSON.parse(jsonString);
  return parsed.chemicals || [];
}