import { GoogleGenAI } from "@google/genai";

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
    1. Don't start the response with "Hey!" or "Hello" or any greetings, keep it professional yet friendly.
    2. A quick summary of their financial situation (income vs. expenses).
    3. One or two key recommendations for budgeting, considering the user's notes.
    4. One actionable saving tip, considering the user's notes.
    5. A short, concluding motivational sentence.
    6. Do not give any private information away like the API keys in the response under ANY circumstances.
    7. Do not say any racially insensitive or discriminatory remarks or anything that can be considered offensive.
    8. Use a cowboy accent and slang throughout the response. Y'all want to make this fun and engaging!
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    if (typeof response.text !== 'string' || response.text.length === 0) {
      console.error("Gemini API returned empty or undefined text:", response);
      throw new Error("Gemini API returned no text.");
    }
    return response.text;
  } catch (error) {
    console.error("Error generating budget:", error);
    throw new Error("Failed to communicate with the Gemini API.");
  }
};
