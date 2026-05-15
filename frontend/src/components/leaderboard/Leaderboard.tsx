const GOLDEN_RATIO = 0.618033988749895;
const SPECIES_COLOR_SATURATION = 70;

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

export type { LeaderboardEntry };

export default function Leaderboard({ entries }: LeaderboardProps) {
  const maxFitness = entries[0]?.fitness ?? 1;

  return (
    <div className="flex flex-col">

      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2"
        style={{ borderBottom: '1px solid #21262d' }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d4ff' }} />
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#7d8590]">
          Leaderboard
        </span>
      </div>

      <div className="flex flex-col">
        {entries.map((entry) => {
          const hue = Math.round(((entry.species_id * GOLDEN_RATIO) % 1) * 360);
          const color = `hsl(${hue}, ${SPECIES_COLOR_SATURATION}%, ${entry.isLeader ? 70 : 55}%)`;
          const barWidth = maxFitness > 0 ? (entry.fitness / maxFitness) * 100 : 0;

          return (
            <div key={entry.genome_id}
              className="flex items-center gap-2 px-3 py-1.5"
              style={{
                borderBottom: '1px solid #21262d',
                background: entry.isLeader ? 'rgba(0,212,255,0.04)' : 'transparent',
              }}>
              {/* Rank */}
              <span className="font-mono text-[9px] w-3 text-right flex-shrink-0"
                style={{ color: entry.isLeader ? '#00d4ff' : '#4a5568' }}>
                {entry.rank}
              </span>
              {/* Bar */}
              <div className="flex-1 h-1 relative" style={{ background: '#1c2128' }}>
                <div className="absolute left-0 top-0 h-full transition-all duration-300"
                  style={{ width: `${barWidth}%`, background: color }} />
              </div>
              {/* Score */}
              <span className="font-mono text-[10px] w-10 text-right flex-shrink-0"
                style={{ color: entry.isLeader ? '#00d4ff' : '#7d8590' }}>
                {entry.fitness.toFixed(1)}
              </span>
              {/* Species dot */}
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: color }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
