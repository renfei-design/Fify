"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="shadcn-theme gxroute-state" role="alert">
      <div className="gxroute-state-card">
        <strong>Fify needs a quick retry</strong>
        <span>
          The app shell stayed available, but this view could not finish
          rendering.
        </span>
        <button type="button" onClick={reset}>
          Retry
        </button>
      </div>
    </main>
  );
}
