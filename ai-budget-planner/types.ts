
export interface Expense {
  id: string;
  category: string;
  amount: string;
}

export type ActiveInput = 
  | { type: 'income' }
  | { type: 'expense'; id: string; field: 'category' | 'amount' }
  | null;
