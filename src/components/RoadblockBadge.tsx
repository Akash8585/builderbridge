export function RoadblockBadge({ status }: { status: "OPEN" | "RESOLVED" }) {
  if (status === "OPEN") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-medium bg-error/15 text-error">
        ⚠ Roadblock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-medium bg-success/15 text-success">
      ✓ Resolved
    </span>
  );
}
