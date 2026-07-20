interface BandMatcherProps {
  bands: { index: number; matches: boolean }[];
}

export function BandMatcher({ bands }: BandMatcherProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {bands.map((b) => (
        <div
          key={b.index}
          className={`h-2 w-4 rounded-sm transition-colors ${b.matches ? "bg-gradient-to-r from-emerald-500 to-cyan-500" : "bg-stone-700"}`}
          title={`Band ${b.index + 1}: ${b.matches ? "Match" : "No match"}`}
        />
      ))}
    </div>
  );
}
