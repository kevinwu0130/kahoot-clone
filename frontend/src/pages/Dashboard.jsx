import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { quizAPI, gameAPI } from '../lib/api';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      const res = await quizAPI.list();
      setQuizzes(res.data.quizzes);
    } catch (err) {
      setError('載入測驗失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (quizId) => {
    if (!confirm('確定要刪除此測驗？此動作無法復原。')) return;
    try {
      await quizAPI.delete(quizId);
      setQuizzes(quizzes.filter(q => q.id !== quizId));
    } catch (err) {
      alert('刪除失敗：' + (err.response?.data?.error || '未知錯誤'));
    }
  };

  const handleLaunch = async (quizId) => {
    setLaunching(quizId);
    try {
      const res = await gameAPI.create(quizId);
      navigate(`/host/${res.data.game.id}/lobby`);
    } catch (err) {
      alert('建立遊戲失敗：' + (err.response?.data?.error || '未知錯誤'));
    } finally {
      setLaunching(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-4 border-b border-white/10">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80">
          <img src="/logo.svg" alt="wu5-Live" className="w-10 h-10" />
          <h1 className="text-2xl font-black text-white">wu5-Live</h1>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-purple-200">歡迎，{user?.name}</span>
          <button
            onClick={logout}
            className="text-white/70 hover:text-white transition-colors text-sm border border-white/30 rounded-full px-4 py-1.5"
          >
            登出
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-black text-white">我的測驗</h2>
            <p className="text-purple-200 mt-1">{quizzes.length} 個測驗</p>
          </div>
          <Link
            to="/quiz/new"
            className="bg-yellow-400 text-gray-900 font-bold py-3 px-6 rounded-xl hover:bg-yellow-300 transition-all active:scale-95 flex items-center gap-2 text-lg"
          >
            <span>+</span> 新增測驗
          </Link>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-200 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-white/50 text-xl animate-pulse">載入中...</div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-2xl font-bold text-white mb-2">還沒有測驗</h3>
            <p className="text-purple-200 mb-6">建立你的第一個互動測驗吧！</p>
            <Link
              to="/quiz/new"
              className="bg-yellow-400 text-gray-900 font-bold py-3 px-8 rounded-xl hover:bg-yellow-300 transition-all"
            >
              建立測驗
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="card hover:bg-white/15 transition-all duration-200 group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-lg truncate">{quiz.title}</h3>
                    {quiz.description && (
                      <p className="text-purple-200 text-sm mt-1 line-clamp-2">{quiz.description}</p>
                    )}
                  </div>
                  {quiz.isPublic && (
                    <span className="ml-2 bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded-full border border-green-500/30 flex-shrink-0">
                      公開
                    </span>
                  )}
                </div>

                <div className="flex gap-4 text-sm text-purple-300 mb-4">
                  <span>📝 {quiz._count.questions} 題</span>
                  <span>🎮 {quiz._count.games} 次遊戲</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleLaunch(quiz.id)}
                    disabled={launching === quiz.id || quiz._count.questions === 0}
                    className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-all active:scale-95 text-sm"
                  >
                    {launching === quiz.id ? '建立中...' : '▶ 開始'}
                  </button>
                  <Link
                    to={`/quiz/${quiz.id}/edit`}
                    className="bg-blue-500 hover:bg-blue-400 text-white font-bold py-2.5 rounded-xl transition-all active:scale-95 text-sm text-center"
                  >
                    ✏️ 編輯
                  </Link>
                  <button
                    onClick={() => handleDelete(quiz.id)}
                    className="bg-red-500/70 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl transition-all active:scale-95 text-sm"
                  >
                    🗑️ 刪除
                  </button>
                </div>

                {quiz._count.questions === 0 && (
                  <p className="text-yellow-400/70 text-xs mt-2 text-center">
                    ⚠️ 需要至少 1 題才能開始遊戲
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
