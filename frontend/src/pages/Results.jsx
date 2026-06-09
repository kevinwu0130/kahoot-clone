import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { gameAPI } from '../lib/api';
import Leaderboard from '../components/Leaderboard';
import { useAuth } from '../hooks/useAuth';

function Results({ isHost }) {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [leaderboard, setLeaderboard] = useState([]);
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const playerId = location.state?.playerId;
  const nickname = location.state?.nickname;

  useEffect(() => {
    loadResults();
  }, [gameId]);

  const loadResults = async () => {
    try {
      const res = await gameAPI.getResults(gameId);
      setLeaderboard(res.data.leaderboard);
      setGame(res.data.game);
    } catch (err) {
      setError('載入結果失敗');
    } finally {
      setLoading(false);
    }
  };

  const myEntry = leaderboard.find(p => p.id === parseInt(playerId));
  const MEDALS = ['🥇', '🥈', '🥉'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">載入結果中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-main flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🏆</span>
          <div>
            <h1 className="text-xl font-black text-white">最終結果</h1>
            {game && (
              <p className="text-purple-200 text-sm">{game.quiz?.title}</p>
            )}
          </div>
        </div>
        {isHost ? (
          <Link
            to="/dashboard"
            className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-5 rounded-full transition-all"
          >
            回到首頁
          </Link>
        ) : (
          <Link
            to="/"
            className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-5 rounded-full transition-all"
          >
            回到首頁
          </Link>
        )}
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {error ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">😕</div>
            <p className="text-red-300 text-xl">{error}</p>
          </div>
        ) : (
          <>
            {/* Podium for top 3 */}
            {leaderboard.length >= 3 && (
              <div className="flex items-end justify-center gap-4 mb-8 h-48">
                {/* 2nd place */}
                <div className="flex flex-col items-center">
                  <div className="text-4xl mb-1">🥈</div>
                  <div className="bg-gray-400/80 rounded-t-2xl w-24 h-28 flex flex-col items-center justify-end pb-3">
                    <p className="text-white font-bold text-sm text-center px-1 truncate w-full text-center">
                      {leaderboard[1]?.nickname}
                    </p>
                    <p className="text-white font-black">{leaderboard[1]?.score?.toLocaleString()}</p>
                  </div>
                </div>

                {/* 1st place */}
                <div className="flex flex-col items-center">
                  <div className="text-5xl mb-1 animate-pulse-scale">🥇</div>
                  <div className="bg-yellow-500/80 rounded-t-2xl w-28 h-40 flex flex-col items-center justify-end pb-3 shadow-lg shadow-yellow-500/30">
                    <p className="text-white font-bold text-sm text-center px-1 truncate w-full text-center">
                      {leaderboard[0]?.nickname}
                    </p>
                    <p className="text-white font-black text-xl">{leaderboard[0]?.score?.toLocaleString()}</p>
                  </div>
                </div>

                {/* 3rd place */}
                <div className="flex flex-col items-center">
                  <div className="text-4xl mb-1">🥉</div>
                  <div className="bg-orange-600/80 rounded-t-2xl w-24 h-20 flex flex-col items-center justify-end pb-3">
                    <p className="text-white font-bold text-sm text-center px-1 truncate w-full text-center">
                      {leaderboard[2]?.nickname}
                    </p>
                    <p className="text-white font-black">{leaderboard[2]?.score?.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* My result highlight (player view) */}
            {!isHost && myEntry && (
              <div className="bg-yellow-400/20 border-2 border-yellow-400 rounded-2xl p-4 mb-6 text-center animate-bounce-in">
                <p className="text-yellow-300 text-sm mb-1">你的成績</p>
                <p className="text-white font-black text-2xl">{nickname}</p>
                <div className="flex justify-center gap-6 mt-2">
                  <div>
                    <p className="text-yellow-400 font-black text-3xl">{myEntry.score?.toLocaleString()}</p>
                    <p className="text-purple-200 text-xs">分數</p>
                  </div>
                  <div>
                    <p className="text-white font-black text-3xl">#{myEntry.rank}</p>
                    <p className="text-purple-200 text-xs">排名</p>
                  </div>
                </div>
              </div>
            )}

            {/* Full Leaderboard */}
            <div>
              <h2 className="text-2xl font-black text-white mb-4 text-center">完整排行榜</h2>
              <Leaderboard players={leaderboard} animated={true} maxShow={20} />
            </div>

            {/* Stats */}
            {game && (
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="card text-center">
                  <p className="text-purple-200 text-sm">參與玩家</p>
                  <p className="text-white font-black text-3xl">{leaderboard.length}</p>
                </div>
                <div className="card text-center">
                  <p className="text-purple-200 text-sm">最高分</p>
                  <p className="text-yellow-400 font-black text-3xl">
                    {leaderboard[0]?.score?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Results;
