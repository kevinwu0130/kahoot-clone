import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';

function PlayerJoin() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [nickname, setNickname] = useState('');
  const [step, setStep] = useState(searchParams.get('code') ? 'nickname' : 'code');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || !/^\d{6}$/.test(trimmed)) {
      setError('請輸入正確的 6 位數遊戲代碼');
      return;
    }
    setError('');
    setStep('nickname');
  };

  const handleJoin = (e) => {
    e.preventDefault();
    const trimmedNick = nickname.trim();
    if (!trimmedNick) { setError('請輸入暱稱'); return; }
    if (trimmedNick.length > 20) { setError('暱稱最多 20 個字元'); return; }

    setJoining(true);
    setError('');

    const socket = io('/', { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      socket.emit('player:join', { code: code.trim(), nickname: trimmedNick });
    });

    socket.on('player:joined', ({ playerId, gameId }) => {
      socket.disconnect();
      navigate(`/play/${gameId}`, {
        state: { playerId, nickname: trimmedNick, gameId, code: code.trim() }
      });
    });

    socket.on('game:error', (msg) => {
      setError(msg);
      setJoining(false);
      socket.disconnect();
    });

    socket.on('connect_error', () => {
      setError('連接失敗，請稍後再試');
      setJoining(false);
      socket.disconnect();
    });

    // Timeout
    setTimeout(() => {
      if (joining) {
        setError('連接超時，請稍後再試');
        setJoining(false);
        socket.disconnect();
      }
    }, 10000);
  };

  return (
    <div className="min-h-screen bg-gradient-main flex flex-col">
      <header className="flex justify-between items-center px-6 py-4">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80">
          <span className="text-3xl">🎮</span>
          <h1 className="text-2xl font-black text-white">Kahoot!</h1>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {step === 'code' ? (
            <form onSubmit={handleCodeSubmit} className="space-y-6 animate-fade-in">
              <div className="text-center">
                <div className="text-6xl mb-3">🎯</div>
                <h2 className="text-3xl font-black text-white">加入遊戲</h2>
                <p className="text-purple-200 mt-1">輸入主持人提供的遊戲代碼</p>
              </div>

              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                placeholder="遊戲代碼"
                className="w-full bg-white text-gray-900 font-black text-4xl text-center rounded-2xl px-6 py-5 focus:outline-none focus:ring-4 focus:ring-yellow-400 placeholder-gray-300 tracking-widest shadow-2xl"
                maxLength={6}
                autoFocus
              />

              {error && (
                <p className="text-red-300 text-center font-semibold">{error}</p>
              )}

              <button
                type="submit"
                className="w-full bg-yellow-400 text-gray-900 font-black text-2xl py-5 rounded-2xl hover:bg-yellow-300 transition-all active:scale-95 shadow-2xl"
              >
                繼續 →
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-6 animate-fade-in">
              <div className="text-center">
                <div className="text-6xl mb-3">👤</div>
                <h2 className="text-3xl font-black text-white">你的暱稱</h2>
                <p className="text-purple-200 mt-1">其他玩家會看到這個名稱</p>
              </div>

              <div className="bg-white/10 rounded-2xl p-3 text-center">
                <p className="text-purple-200 text-sm">遊戲代碼</p>
                <p className="text-yellow-400 font-black text-2xl tracking-widest">{code}</p>
              </div>

              <input
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value.slice(0, 20));
                  setError('');
                }}
                placeholder="輸入你的暱稱"
                className="w-full bg-white text-gray-900 font-bold text-2xl text-center rounded-2xl px-6 py-5 focus:outline-none focus:ring-4 focus:ring-yellow-400 placeholder-gray-300 shadow-2xl"
                autoFocus
                maxLength={20}
              />

              {error && (
                <p className="text-red-300 text-center font-semibold">{error}</p>
              )}

              <button
                type="submit"
                disabled={joining}
                className="w-full bg-green-500 text-white font-black text-2xl py-5 rounded-2xl hover:bg-green-400 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl"
              >
                {joining ? '加入中...' : '加入遊戲 🚀'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('code'); setError(''); }}
                className="w-full text-purple-300 hover:text-white transition-colors text-center"
              >
                ← 更改代碼
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlayerJoin;
