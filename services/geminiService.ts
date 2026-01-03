
import { GoogleGenAI } from "@google/genai";

// Initialize AI lazily or with a safety check
const getAI = () => {
  const apiKey = (typeof process !== 'undefined' && process.env.API_KEY) || '';
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export async function getGameSummary(score: number, accuracy: number, streak: number) {
  const ai = getAI();
  if (!ai) return "Excellent focus today! Your brain agility is showing great potential.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The player just finished a cognitive game. 
      Stats: Score ${score}, Accuracy ${Math.round(accuracy * 100)}%, Longest Streak ${streak}.
      Give a short, punchy, witty 1-sentence assessment of their focus and brain agility.`,
      config: {
        temperature: 0.8,
      }
    });
    return response.text || "Great performance! Keep pushing your mental limits.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Great performance! Keep pushing your mental limits.";
  }
}
