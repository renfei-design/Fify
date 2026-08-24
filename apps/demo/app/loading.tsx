export default function Loading() {
  return (
    <main
      className="shadcn-theme gxroute-state"
      role="status"
      aria-live="polite"
    >
      <div className="gxroute-state-card">
        <strong>Preparing Fify</strong>
        <span>
          Your interface is loading. The conversation shell will remain visible.
        </span>
      </div>
    </main>
  );
}
