export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Stock Screener
        </h1>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Real-time US equities, powered by Finnhub.
        </p>
      </div>
    </main>
  );
}
