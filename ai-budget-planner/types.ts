
export interface Expense {
  id: string;
  category: string;
  amount: string;
}

export interface SavedPlan {
  id: string;
  name: string;
  income: string;
  expenses: Expense[];
  planText: string;
  userNotes: string;
  createdAt: string;
}

export type ActiveInput = 
  | { type: 'income' }
  | { type: 'expense'; id: string; field: 'category' | 'amount' }
  | { type: 'notes' }
  | null;