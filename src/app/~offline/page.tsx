export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">Sin conexión</h1>
        <p className="text-muted-foreground">
          Revisa tu conexión a internet e intenta de nuevo.
        </p>
      </div>
    </div>
  );
}
