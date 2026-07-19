interface MinHashPreviewProps {
  minHash: readonly string[];
}

// One bar per band, colored directly from that band's own hash bytes - a
// deterministic, at-a-glance "fingerprint" rather than a literal data chart.
export function MinHashPreview({ minHash }: MinHashPreviewProps) {
  return (
    <div className="flex gap-px">
      {minHash.map((band, i) => (
        <div key={`${i}-${band}`} className="h-3 flex-1 rounded-sm" style={{ backgroundColor: `#${band.slice(2, 8)}` }} title={band} />
      ))}
    </div>
  );
}
