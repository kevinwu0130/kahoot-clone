import { useEffect, useState } from 'react';

const MEDALS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = [
  'from-yellow-500 to-yellow-600',
  'from-gray-400 to-gray-500',
  'from-orange-600 to-orange-700',
];

function LeaderboardRow({ player, index, animated }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setVisible(true), index * 100);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [index, animated]);

  const isTop3 = index < 3;

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-500 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
      } ${isTop3 ? `bg-gradient-to-r ${RANK_COLORS[index]} shadow-lg` : 'bg-white/10'}`}
    >
      <div className="text-2xl font-black w-10 text-center">
        {index < 3 ? MEDALS[index] : `#${index + 1}`}
      </div>
      <div className="flex-1">
        <div className="font-bold text-lg">{player.nickname}</div>
      </div>
      <div className="text-right">
        <div className="font-black text-2xl">{player.score.toLocaleString()}</div>
        <div className="text-xs opacity-75">分</div>
      </div>
    </div>
  );
}

function Leaderboard({ players, animated = true, maxShow = 10 }) {
  const displayPlayers = players.slice(0, maxShow);

  return (
    <div className="space-y-3">
      {displayPlayers.length === 0 ? (
        <div className="text-center text-white/50 py-8 text-lg">暫無排名</div>
      ) : (
        displayPlayers.map((player, index) => (
          <LeaderboardRow
            key={player.id || index}
            player={player}
            index={index}
            animated={animated}
          />
        ))
      )}
    </div>
  );
}

export default Leaderboard;
