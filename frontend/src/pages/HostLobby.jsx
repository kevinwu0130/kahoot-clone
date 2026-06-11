import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { BACKEND_URL } from '../lib/api';
import { gameAPI } from '../lib/api';

function HostLobby() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [showQR, setShowQR] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    loadGame();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [gameId]);

  const loadGame = async () => {
    try {
      const res = await gameAPI.get(gameId);
      setGame(res.data.game);
      setPlayers(res.data.game.players);
      setupSocket();
    } catch (err) {
      setError('載入遊戲失敗');
    } finally {
      setLoading(false);
    }
  };

  const setupSocket = () => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('host:join', parseInt(gameId));
    });

    socket.on('game:joined', ({ game }) => {
      setGame(game);
    });

    socket.on('game:player_joined', ({ players }) => {
      setPlayers(players);
    });

    socket.on('game:started', ({ question, questionIndex, totalQuestions }) => {
      navigate(`/host/${gameId}/game`, {
        state: { question, questionIndex, totalQuestions, gameId: parseInt(gameId) }
      });
    });

    socket.on('game:error', (msg) => {
      setError(msg);
    });
  };

  const handleStart = () => {
    if (players.length === 0) {
      setError('至少需要 1 位玩家才能開始');
      return;
    }
    setStarting(true);
    socketRef.current?.emit('host:start', parseInt(gameId));
  };

  const gameUrl = `${window.location.origin}/join?code=${game?.code}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">載入遊戲中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-main flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-black text-white">{game?.quiz?.title}</h1>
          <p className="text-purple-200 text-sm">等待玩家加入...</p>
        </div>
        <div className="text-right">
          <p className="text-purple-200 text-sm">遊戲代碼</p>
          <p className="text-4xl font-black text-yellow-400 tracking-widest">{game?.code}</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-6 max-w-6xl mx-auto w-full">
        {/* QR Code / Join Info */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="card text-center">
            <h2 className="text-lg font-bold text-white mb-4">如何加入？</h2>

            {/* QR code — scan to jump straight to the join page with the code filled in */}
            <div className="bg-white rounded-2xl p-4 mx-auto w-48 h-48 flex items-center justify-center mb-4">
              {game?.code ? (
                <QRCodeSVG value={gameUrl} size={160} level="M" includeMargin={false} />
              ) : (
                <div className="text-6xl">📱</div>
              )}
            </div>

            <p className="text-purple-200 text-sm mb-3">
              手機掃描 QR code，或前往<br />
              <span className="text-yellow-400 font-bold break-all">{window.location.host}</span> 輸入代碼
            </p>

            <div className="bg-white/10 rounded-xl p-3 text-xs text-purple-200 break-all">
              {gameUrl}
            </div>

            <div className="mt-4 p-3 bg-yellow-400/20 border border-yellow-400/50 rounded-xl">
              <p className="text-yellow-300 font-bold text-2xl">{game?.code}</p>
              <p className="text-yellow-200 text-xs">遊戲代碼</p>
            </div>

            <button
              type="button"
              onClick={() => setShowQR(true)}
              disabled={!game?.code}
              className="mt-4 w-full bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
            >
              🔍 全螢幕顯示 QR
            </button>
          </div>

          <div className="card mt-4">
            <p className="text-white/70 text-sm text-center mb-1">測驗資訊</p>
            <p className="text-white font-bold text-center">{game?.quiz?.questions?.length} 題</p>
          </div>
        </div>

        {/* Players */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-black text-white">
              玩家
              <span className="ml-3 bg-purple-600 text-white text-lg px-3 py-1 rounded-full">
                {players.length}
              </span>
            </h2>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-red-200 mb-4 text-center">
              {error}
            </div>
          )}

          {players.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-5xl mb-3 animate-pulse">⏳</div>
              <p className="text-white text-xl font-bold">等待玩家加入...</p>
              <p className="text-purple-200 mt-2">請玩家使用上方代碼加入遊戲</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {players.map((player, idx) => (
                <div
                  key={player.id}
                  className="card text-center py-4 animate-bounce-in hover:bg-white/20 transition-all"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="text-3xl mb-1">
                    {['🦊', '🐺', '🦁', '🐯', '🐸', '🐙', '🦋', '🦄'][idx % 8]}
                  </div>
                  <p className="text-white font-bold text-sm truncate px-1">{player.nickname}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Start Button */}
      <div className="p-6 border-t border-white/10 flex justify-center">
        <button
          onClick={handleStart}
          disabled={starting || players.length === 0}
          className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-2xl py-5 px-16 rounded-2xl transition-all active:scale-95 shadow-2xl hover:shadow-green-500/50"
        >
          {starting ? '開始遊戲中...' : `開始遊戲 (${players.length} 位玩家) 🚀`}
        </button>
      </div>

      {/* Fullscreen QR overlay — for projecting so a whole room can scan */}
      {showQR && game?.code && (
        <div
          className="fixed inset-0 z-50 bg-purple-950/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-fade-in cursor-pointer"
          onClick={() => setShowQR(false)}
        >
          <h2 className="text-white text-3xl md:text-5xl font-black mb-2 text-center">
            掃描 QR 加入遊戲
          </h2>
          <p className="text-purple-200 text-lg mb-8">{window.location.host}</p>

          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <QRCodeSVG value={gameUrl} size={380} level="M" includeMargin={false} className="w-[60vw] h-[60vw] max-w-[380px] max-h-[380px]" />
          </div>

          <div className="mt-8 text-center">
            <p className="text-purple-200 text-xl mb-1">遊戲代碼</p>
            <p className="text-yellow-400 font-black text-6xl md:text-8xl tracking-widest">{game.code}</p>
          </div>

          <button
            type="button"
            onClick={() => setShowQR(false)}
            className="mt-10 bg-white/15 hover:bg-white/25 text-white font-bold text-lg py-3 px-8 rounded-xl transition-all active:scale-95"
          >
            ✕ 關閉
          </button>
        </div>
      )}
    </div>
  );
}

export default HostLobby;
