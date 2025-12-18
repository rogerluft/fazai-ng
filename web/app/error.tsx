'use client';

import React from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-6xl font-bold text-red-500">500</h1>
        <h2 className="text-2xl font-semibold">Something went wrong!</h2>
        <p className="text-gray-400">
          {error.message || 'An unexpected error occurred.'}
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
        <a
          href="/"
          className="mt-2 block text-sm text-gray-400 hover:text-gray-300"
        >
          Go back home
        </a>
      </div>
    </div>
  );
}
