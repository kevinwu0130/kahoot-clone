import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';

function PlayerLobby() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { playerId, nickname, code } = location.state || {};

  const [players, setPlayers] = useState([]);
  const [error, setError] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    if (!playerId || !nickname) {
      navigate('/', { replace: true });
      return;
    }

    const socket = io('/', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Join socket room for this game to receive events
      // We use a special "player:rejoin" concept by emitting host:join with game ID
      // Actually, players need to be in the game room. We join as a listener.
      socket.emit('player:rejoin', { gameId: parseInt(gameId), playerId: parseInt(playerId) });
    });

    socket.on('game:player_joined', ({ players }) => {
      setPlayers(players);
    });

    socket.on('game:question', ({ question, questionIndex, totalQuestions }) => {
      socket.disconnect();
      navigate(`/game/${gameId}/play`, {
        state: { playerId, nickname, gameId: parseInt(gameId), question, questionIndex, totalQuestions }
      });
    });

    socket.on('game:error', (msg) => {
      setError(msg);
    });

    return () => socket.disconnect();
  }, [gameId, playerId, nickname]);

  const EMOJIS = ['🦊', '🐺', '🦁', '🐯', '🐸', '🐙', '🦋', '🦄', '🦓', '🦒', '🐬', '🦈'];

  return (
    <div className="min-h-screen bg-gradient-main flex flex-col items-center justify-center p-6">
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg z-50">
          {error}
        </div>
      )}

      <div className="text-center animate-bounce-in mb-8">
        <div className="text-8xl mb-4">
          {EMOJIS[parseInt(playerId) % EMOJIS.length]}
        </div>
        <h1 className="text-4xl font-black text-white mb-2">{nickname}</h1>
        <p className="text-purple-200 text-lg">你已成功加入！</p>
      </div>

      <div className="card text-center max-w-sm w-full mb-6">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
          <span className="text-white font-bold">等待主持人開始</span>
        </div>
        <div className="text-purple-200 text-sm">主持人準備好後遊戲將自動開始</div>
      </div>

      {/* Online players */}
      {players.length > 0 && (
        <div className="w-full max-w-md">
          <p className="text-center text-purple-200 text-sm mb-3">
            目前 {players.length} 位玩家在線
          </p>
          <div className="grid grid-cols-3 gap-2">
            {players.slice(0, 12).map((p, idx) => (
              <div
                key={p.id}
                className={`card text-center py-2 px-1 ${p.nickname === nickname ? 'border-yellow-400 bg-yellow-400/20' : ''}`}
              >
                <div className="text-xl">{EMOJIS[idx % EMOJIS.length]}</div>
                <p className="text-white text-xs font-bold truncate">{p.nickname}</p>
              </div>
            ))}
          </div>
          {players.length > 12 && (
            <p className="text-center text-purple-300 text-xs mt-2">
              以及 {players.length - 12} 位其他玩家...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default PlayerLobby;
