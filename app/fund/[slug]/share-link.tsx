"use client";

import { useState } from "react";

export function ShareLink({ shareUrl }: { shareUrl: string }) {
  const [feedback, setFeedback] = useState<string>("");

  async function handleCopy() {
    setFeedback("");
    try {
      await navigator.clipboard.writeText(shareUrl);
      setFeedback("Link copied");
    } catch {
      setFeedback("Couldn't copy; select the link and copy it");
    }
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor="share-url-input"
        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        Share fund link
      </label>
      <div className="flex gap-2">
        <input
          id="share-url-input"
          type="text"
          readOnly
          value={shareUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-900 select-all dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="cursor-pointer rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Copy link
        </button>
      </div>
      <div
        aria-live="polite"
        className="min-h-5 text-sm text-zinc-600 dark:text-zinc-400"
      >
        {feedback}
      </div>
    </div>
  );
}
