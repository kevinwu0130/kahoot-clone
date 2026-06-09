import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Login() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'register' ? 'register' : 'login');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (tab === 'login') {
        await login(formData.email, formData.password);
      } else {
        if (!formData.name) {
          setError('請輸入姓名');
          setLoading(false);
          return;
        }
        await register(formData.name, formData.email, formData.password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || '操作失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-4">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-3xl">🎮</span>
          <h1 className="text-2xl font-black text-white">Kahoot!</h1>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Tab Switcher */}
          <div className="flex bg-white/10 rounded-2xl p-1 mb-8">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                tab === 'login' ? 'bg-white text-purple-900' : 'text-white hover:bg-white/10'
              }`}
            >
              登入
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                tab === 'register' ? 'bg-white text-purple-900' : 'text-white hover:bg-white/10'
              }`}
            >
              註冊
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div>
                <label className="block text-white/70 text-sm mb-1 ml-1">姓名</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="你的姓名"
                  className="input-field"
                  required={tab === 'register'}
                />
              </div>
            )}

            <div>
              <label className="block text-white/70 text-sm mb-1 ml-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-1 ml-1">密碼</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={tab === 'register' ? '至少 6 個字元' : '你的密碼'}
                className="input-field"
                required
                minLength={tab === 'register' ? 6 : 1}
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-red-200 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-400 text-gray-900 font-black text-xl py-4 rounded-2xl hover:bg-yellow-300 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? '處理中...' : (tab === 'login' ? '登入' : '建立帳號')}
            </button>
          </form>

          {tab === 'login' && (
            <div className="text-center mt-6">
              <p className="text-purple-200 text-sm">
                預設管理員：admin@kahoot.com / Admin@1234
              </p>
            </div>
          )}

          <div className="text-center mt-6">
            <Link to="/" className="text-purple-300 hover:text-white transition-colors">
              ← 返回首頁
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
