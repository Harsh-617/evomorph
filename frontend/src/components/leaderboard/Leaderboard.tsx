interface LeaderboardEntry {
  genome_id: string;
  rank: number;
  fitness: number;
  species_id: number;
  isLeader: boolean;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

function LeaderboardEntry({ entry, maxFitness }: { entry: LeaderboardEntry; maxFitness: number }) {
  // Use golden ratio to spread colors evenly regardless of species ID value
  const GOLDEN_RATIO = 0.618033988749895;
  const hue = Math.round(((entry.species_id * GOLDEN_RATIO) % 1) * 360);
  const saturation = 70;
  const lightness = entry.isLeader ? 70 : 55; // leader slightly brighter
  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  const barWidth = maxFitness > 0 ? (entry.fitness / maxFitness) * 100 : 0;

  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs
      ${entry.isLeader ? 'bg-slate-700 ring-1 ring-cyan-500' : 'hover:bg-slate-700'}`}>
      <span className="text-slate-400 w-5 text-right text-xs">{entry.rank}</span>
      <div className="flex-1 h-1.5 bg-slate-600 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${barWidth}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-slate-300 w-12 text-right font-mono">
        {entry.fitness.toFixed(1)}
      </span>
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

export type { LeaderboardEntry };

export default function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <div className="flex flex-col gap-2 p-4 bg-slate-800 rounded-xl border border-slate-700">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Leaderboard
      </h3>
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {entries.map((entry) => (
          <LeaderboardEntry key={entry.genome_id} entry={entry} maxFitness={entries[0]?.fitness ?? 1} />
        ))}
      </div>
    </div>
  );
}
