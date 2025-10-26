import { GoogleGenAI, Modality } from "@google/genai";

// The API key is injected by the environment, so we can use process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface NumericExpense {
    id: string;
    category: string;
    amount: number;
}

export const generateBudget = async (income: number, expenses: NumericExpense[], userNotes: string): Promise<string> => {
  const expenseList = expenses.map(e => `- ${e.category}: $${e.amount.toFixed(2)}`).join('\n');

  const notesSection = userNotes 
    ? `
    User's Notes (take these into account for your recommendations):
    ${userNotes}
    `
    : '';

  const prompt = `
    You are a friendly financial advisor. Create a CONCISE and BRIEF personalized budget plan based on the following financial information.
    The entire plan should be no more than 150 words.
    Format the response as clear, easy-to-read text. Do not use markdown like # or **.

    Monthly Income: $${income.toFixed(2)}

    Monthly Expenses:
    ${expenseList}
    ${notesSection}
    Please generate a brief budget plan that includes:
    1. A quick summary of their financial situation (income vs. expenses).
    2. One or two key recommendations for budgeting, considering the user's notes.
    3. One actionable saving tip, considering the user's notes.
    4. A short, concluding motivational sentence.
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating budget:", error);
    throw new Error("Failed to communicate with the Gemini API.");
  }
};

export const geminiTextToSpeech = async (text: string, voiceName: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from Gemini API.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error with Gemini Text-to-Speech:", error);
        throw new Error("Failed to generate audio from text using Gemini.");
    }
};