import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function checkImageForAI(base64Image: string): Promise<{ isAI: boolean; reason: string }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image,
            },
          },
          {
            text: "Analyze this image. Is it a real photograph of a road hazard/accident, or does it appear to be AI-generated or fake? Respond in JSON format with 'isAI' (boolean) and 'reason' (string). Be strict. If it looks like a digital illustration or has AI artifacts, mark it as AI.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      isAI: !!result.isAI,
      reason: result.reason || "No reason provided",
    };
  } catch (error) {
    console.error("AI Check Error:", error);
    return { isAI: false, reason: "Check failed" };
  }
}

export async function getSafetyAlerts(location: { lat: number; lng: number }, reports: any[]) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Current location: ${location.lat}, ${location.lng}. 
      Nearby reports: ${JSON.stringify(reports)}.
      Provide a brief safety summary and alerts for a driver in this area. 
      Respond in JSON format with an array of 'alerts' (title, severity, description).`,
      config: {
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || "{\"alerts\": []}");
  } catch (error) {
    return { alerts: [] };
  }
}
