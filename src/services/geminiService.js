// src/services/geminiService.js
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

export async function getEyeHealthAdvice(metrics, history) {
  if (!API_KEY) {
    return "Gemini API key not configured.";
  }

  const prompt = `
You are an eye health AI assistant named Ocularis.

User data:
Blink Rate: ${metrics.blinkRate} bpm
Screen Distance: ${metrics.screenDistance} cm
Pupil Dilation: ${metrics.pupilDilation.toFixed(3)}
Fatigue Score: ${metrics.fatigueScore}%

Session History: ${history.length} entries

Provide short, motivating, personalized eye health advice in a friendly, casual tone. Include tips like 20-20-20 rule if relevant.
`;

  try {
    const res = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    const data = await res.json();
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Stay hydrated and blink more."
    );
  } catch (err) {
    console.error("Gemini Error:", err);
    return "AI temporarily unavailable.";
  }
}
