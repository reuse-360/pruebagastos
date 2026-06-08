export interface HouseholdMember {
  id: string;
  name: string;
  monthly_income: number;
  active: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  is_shared: boolean;
  active: boolean;
}

export interface Transaction {
  id: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  category_id: string | null;
  paid_by_member_id: string | null;
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
        Relationships: [];
      };
      expense_categories: {
        Row: ExpenseCategory;
        Insert: Omit<ExpenseCategory, "id">;
        Update: Partial<Omit<ExpenseCategory, "id">>;
        Relationships: [];
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, "id" | "created_at">;
        Update: Partial<Omit<Transaction, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_paid_by_member_id_fkey";
            columns: ["paid_by_member_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
