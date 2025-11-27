"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="p-10">
        <h1 className="text-red-600 font-bold">Bir hata oluştu</h1>
        <pre className="mt-4 p-4 bg-red-100 rounded">{String(error)}</pre>
        <button
          className="mt-4 px-4 py-2 bg-black text-white rounded"
          onClick={() => reset()}
        >
          Tekrar Dene
        </button>
      </body>
    </html>
  )
}

