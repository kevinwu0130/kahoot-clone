import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Home() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleJoin = (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError('請輸入遊戲代碼');
      return;
    }
    if (!/^\d{6}$/.test(trimmed)) {
      setError('遊戲代碼必須是 6 位數字');
      return;
    }
    navigate(`/join?code=${trimmed}`);
  };

  return (
    <div className="min-h-screen bg-gradient-main flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🎮</span>
          <h1 className="text-2xl font-black text-white">Kahoot!</h1>
        </div>
        <div className="flex gap-3">
          {user ? (
            <Link
              to="/dashboard"
              className="bg-white text-purple-900 font-bold py-2 px-6 rounded-full hover:bg-gray-100 transition-all"
            >
              我的測驗
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-white font-bold py-2 px-6 rounded-full border-2 border-white hover:bg-white hover:text-purple-900 transition-all"
              >
                登入
              </Link>
              <Link
                to="/login?tab=register"
                className="bg-white text-purple-900 font-bold py-2 px-6 rounded-full hover:bg-gray-100 transition-all"
              >
                註冊
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
        {/* Logo/Title */}
        <div className="text-center mb-12 animate-bounce-in">
          <div className="text-8xl mb-4">🎯</div>
          <h2 className="text-5xl font-black text-white mb-3">
            互動知識大挑戰
          </h2>
          <p className="text-xl text-purple-200">
            輸入遊戲代碼，加入精彩問答！
          </p>
        </div>

        {/* Join Game Card */}
        <div className="w-full max-w-md">
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                placeholder="輸入遊戲代碼"
                className="w-full bg-white text-gray-900 font-bold text-3xl text-center rounded-2xl px-6 py-5 focus:outline-none focus:ring-4 focus:ring-yellow-400 placeholder-gray-400 tracking-widest shadow-2xl"
                maxLength={6}
                autoFocus
              />
              {error && (
                <p className="text-red-300 text-center mt-2 font-semibold">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-yellow-400 text-gray-900 font-black text-2xl py-5 rounded-2xl hover:bg-yellow-300 transition-all duration-200 active:scale-95 shadow-2xl hover:shadow-yellow-400/50"
            >
              加入遊戲 🚀
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-white/20"></div>
            <span className="text-white/50 text-sm">或者</span>
            <div className="flex-1 h-px bg-white/20"></div>
          </div>

          {/* Host link */}
          <div className="text-center">
            <p className="text-purple-200 mb-3">你是主持人嗎？</p>
            <Link
              to={user ? "/dashboard" : "/login"}
              className="inline-block bg-purple-600 text-white font-bold py-3 px-8 rounded-full hover:bg-purple-500 transition-all duration-200 active:scale-95 border-2 border-purple-400"
            >
              {user ? '進入我的測驗' : '主持人登入'} →
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-6 mt-16 max-w-2xl w-full">
          {[
            { icon: '⚡', title: '即時互動', desc: '毫秒級即時回應' },
            { icon: '🏆', title: '競爭排行榜', desc: '速度越快分越高' },
            { icon: '🎨', title: '精美介面', desc: '生動有趣的設計' },
          ].map((feature) => (
            <div key={feature.title} className="text-center card">
              <div className="text-4xl mb-2">{feature.icon}</div>
              <div className="font-bold text-white mb-1">{feature.title}</div>
              <div className="text-purple-200 text-sm">{feature.desc}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default Home;
