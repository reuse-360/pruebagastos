export interface HouseholdMember {
  id: number;
  name: string;
  monthly_income: number;
  active: boolean;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  is_shared: boolean;
  active: boolean;
}

export interface Transaction {
  id: number;
  amount: number;
  transaction_date: string;
  description: string | null;
  category_id: number | null;
  paid_by_member_id: number | null;
  created_at: string;
}

export interface TransactionWithRelations extends Transaction {
  category: ExpenseCategory | null;
  paid_by_member: HouseholdMember | null;
}

export interface Database {
  public: {
    Tables: {
      household_members: {
        Row: HouseholdMember;
        Insert: Omit<HouseholdMember, "id">;
        Update: Partial<Omit<HouseholdMember, "id">>;
      };
      expense_categories: {
        Row: ExpenseCategory;
        Insert: Omit<ExpenseCategory, "id">;
        Update: Partial<Omit<ExpenseCategory, "id">>;
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, "id" | "created_at">;
        Update: Partial<Omit<Transaction, "id" | "created_at">>;
      };
    };
  };
}
