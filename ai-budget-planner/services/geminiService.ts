import { GoogleGenAI } from "@google/genai";

// Read Gemini API key from environment injected by Vite (.env.local) or other env var
const API_KEY = (process.env as any).GEMINI_API_KEY || '';

if (!API_KEY) {
  throw new Error("Gemini API key not set. Add GEMINI_API_KEY to .env.local or set the environment variable before running the app.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

interface NumericExpense {
    id: string;
    category: string;
    amount: number;
}

export const generateBudget = async (income: number, expenses: NumericExpense[]): Promise<string> => {
  const expenseList = expenses.map(e => `- ${e.category}: $${e.amount.toFixed(2)}`).join('\n');

  const prompt = `
    You are a friendly financial advisor. Create a CONCISE and BRIEF personalized budget plan based on the following financial information.
    The entire plan should be no more than 150 words.
    Format the response as clear, easy-to-read text. Do not use markdown like # or **.

    Monthly Income: $${income.toFixed(2)}

    Monthly Expenses:
    ${expenseList}

    Please generate a brief budget plan that includes:
    1. A quick summary of their financial situation (income vs. expenses).
    2. One or two key recommendations for budgeting.
    3. One actionable saving tip.
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