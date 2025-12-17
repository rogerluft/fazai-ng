'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-white">
        <div className="flex min-h-screen flex-col items-center justify-center">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-6xl font-bold text-red-500">Error</h1>
            <h2 className="text-2xl font-semibold">Application Error</h2>
            <p className="text-gray-400">
              {error.message || 'A critical error occurred.'}
            </p>
            {error.digest && (
              <p className="text-sm text-gray-500">Error ID: {error.digest}</p>
            )}
            <button
              onClick={reset}
              className="mt-4 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
