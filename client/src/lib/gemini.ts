export async function parseExperimentalTextWithGemini(apiKey: string, text: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const prompt = `
Extract all chemical substances (reagents, solvents, products) from the following experimental procedure text.
Return ONLY a valid JSON array of objects. Do not use markdown blocks like \`\`\`json.
Each object must have the following structure:
{
  "name": "chemical name exactly as in text, cleaned up",
  "mass": number (amount in mg or g, or null if none),
  "massUnit": "mg" or "g" (or null if none),
  "volume": number (amount in uL or mL, or null if none),
  "volumeUnit": "uL" or "mL" (or null if none),
  "moles": number (amount in mmol or mol, or null if none),
  "molesUnit": "mmol" or "mol" (or null if none)
}

If a substance only has volume (like a solvent), mass and moles should be null.
If a substance only has mass/moles, volume should be null.

Text:
"${text}"
`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Failed to fetch from Gemini API");
  }

  const data = await response.json();
  let jsonString = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  
  // Clean up markdown formatting if the model still returns it
  jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
  
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    throw new Error("Failed to parse Gemini response as JSON");
  }
}
