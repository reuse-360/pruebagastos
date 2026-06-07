import { TransactionForm } from "@/components/TransactionForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="container mx-auto max-w-lg px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Gastos App</h1>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Gastos del mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">—</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Transacciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">—</p>
          </CardContent>
        </Card>
      </div>

      <TransactionForm />
    </main>
  );
}
