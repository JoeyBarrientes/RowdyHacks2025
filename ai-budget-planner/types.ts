
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
  // Collaboration fields (optional)
  ownerId?: string;           // Auth0 user sub of the owner
  collaborators?: string[];   // List of collaborator emails
  shared?: boolean;           // Whether this plan is shared in a backend
}

export type ActiveInput = 
  | { type: 'income' }
  | { type: 'expense'; id: string; field: 'category' | 'amount' }
  | { type: 'notes' }
  | null;