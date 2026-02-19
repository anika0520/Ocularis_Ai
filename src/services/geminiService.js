// src/services/geminiService.js
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

export async function getEyeHealthAdvice(metrics, history) {
  if (!API_KEY) {
    return getFallbackAdvice(metrics);
  }

  const prompt = `
You are Ocularis, an advanced AI eye health assistant integrated into a real-time biometric monitoring system.

Current biometric data:
- Blink Rate: ${metrics.blinkRate} bpm (healthy: 15-20 bpm)
- Screen Distance: ${metrics.screenDistance.toFixed(0)} cm (optimal: 50-80 cm)
- Pupil Dilation Index: ${(metrics.pupilDilation * 10).toFixed(1)}/10
- Fatigue Score: ${metrics.fatigueScore}% (critical above 70%)

Provide ONE concise, actionable eye health tip in 1-2 sentences. Be direct, personalized to the data, and use a calm, professional tone. Focus on the most critical issue visible in the data.
`;

  try {
    const res = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 100, temperature: 0.7 },
      }),
    });

    const data = await res.json();
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      getFallbackAdvice(metrics)
    );
  } catch (err) {
    console.error("Gemini Error:", err);
    return getFallbackAdvice(metrics);
  }
}

function getFallbackAdvice(metrics) {
  const tips = [
    "Follow the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds to reduce digital eye strain.",
    "Blink consciously! Staring at screens reduces blink rate, causing dry eyes. Try to blink fully every 4-5 seconds.",
    "Adjust your screen brightness to match your environment — too bright or too dark causes unnecessary strain.",
    "Position your screen at arm's length (50-70cm) and slightly below eye level for optimal ergonomics.",
    "Take a 5-minute break every hour. Close your eyes and gently massage your temples to relieve tension.",
    "Ensure adequate lighting in your workspace — avoid glare and reflections on your screen.",
    "Use artificial tears if your eyes feel dry or irritated. Digital strain reduces natural blinking by up to 50%.",
    "Consider enabling blue light filter after sunset to help your circadian rhythm and reduce melatonin suppression.",
  ];

  // Context-aware fallback
  if (metrics.blinkRate < 10 && metrics.blinkRate > 0)
    return "Your blink rate is critically low. Take a moment to blink slowly 10 times to re-moisturize your cornea.";
  if (metrics.screenDistance < 40)
    return "You're too close to the screen! Move back to at least 50cm to prevent focusing strain and neck tension.";
  if (metrics.fatigueScore > 70)
    return "High fatigue detected. Close your eyes for 20 seconds and breathe deeply — your visual cortex needs rest.";
  if (metrics.screenDistance > 90)
    return "You're sitting quite far from the screen. Move closer to avoid squinting, which strains the ciliary muscles.";

  return tips[Math.floor(Date.now() / 15000) % tips.length];
}
