import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { quizAPI } from '../lib/api';

const OPTION_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
const OPTION_ICONS = ['▲', '◆', '●', '■'];

const emptyOption = () => ({ text: '', isCorrect: false });
const emptyQuestion = () => ({
  text: '',
  timeLimit: 20,
  points: 1000,
  options: [emptyOption(), emptyOption(), emptyOption(), emptyOption()],
});

function QuestionForm({ question, onSave, onCancel }) {
  const [form, setForm] = useState({
    text: question?.text || '',
    timeLimit: question?.timeLimit || 20,
    points: question?.points || 1000,
    options: question?.options?.length >= 2
      ? [...question.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })),
         ...Array(Math.max(0, 4 - (question.options?.length || 0))).fill(null).map(emptyOption)]
      : [emptyOption(), emptyOption(), emptyOption(), emptyOption()],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const updateOption = (idx, field, value) => {
    const newOptions = [...form.options];
    newOptions[idx] = { ...newOptions[idx], [field]: value };
    if (field === 'isCorrect' && value) {
      // Allow multiple correct answers, but for simplicity, single correct
      newOptions.forEach((o, i) => { if (i !== idx) newOptions[i] = { ...o, isCorrect: false }; });
    }
    setForm({ ...form, options: newOptions });
  };

  const handleSave = async () => {
    if (!form.text.trim()) { setError('請輸入題目'); return; }
    const validOptions = form.options.filter(o => o.text.trim());
    if (validOptions.length < 2) { setError('至少需要 2 個選項'); return; }
    if (!validOptions.some(o => o.isCorrect)) { setError('請選擇正確答案'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({ ...form, options: form.options.filter(o => o.text.trim()) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card animate-slide-up">
      <div className="mb-4">
        <label className="block text-white/70 text-sm mb-1">題目</label>
        <textarea
          value={form.text}
          onChange={e => setForm({ ...form, text: e.target.value })}
          placeholder="輸入你的問題..."
          className="input-field resize-none h-20"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-white/70 text-sm mb-1">時間限制（秒）</label>
          <select
            value={form.timeLimit}
            onChange={e => setForm({ ...form, timeLimit: parseInt(e.target.value) })}
            className="input-field"
          >
            {[5, 10, 15, 20, 30, 45, 60].map(t => (
              <option key={t} value={t} className="bg-purple-900">{t} 秒</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-white/70 text-sm mb-1">分數</label>
          <select
            value={form.points}
            onChange={e => setForm({ ...form, points: parseInt(e.target.value) })}
            className="input-field"
          >
            {[500, 1000, 2000].map(p => (
              <option key={p} value={p} className="bg-purple-900">{p} 分</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {form.options.map((opt, idx) => (
          <div
            key={idx}
            className={`${OPTION_COLORS[idx]} rounded-xl p-3 transition-all ${opt.isCorrect ? 'ring-4 ring-white' : ''}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white font-bold text-lg">{OPTION_ICONS[idx]}</span>
              <input
                type="checkbox"
                checked={opt.isCorrect}
                onChange={e => updateOption(idx, 'isCorrect', e.target.checked)}
                className="w-4 h-4 cursor-pointer"
                title="標記為正確答案"
              />
              <span className="text-white text-xs">{opt.isCorrect ? '✓ 正確' : '點擊設為正確'}</span>
            </div>
            <input
              type="text"
              value={opt.text}
              onChange={e => updateOption(idx, 'text', e.target.value)}
              placeholder={`選項 ${idx + 1}`}
              className="w-full bg-black/20 rounded-lg px-3 py-2 text-white placeholder-white/50 focus:outline-none focus:bg-black/30"
            />
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-red-200 text-sm mb-4 text-center">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
        >
          {saving ? '儲存中...' : '✓ 儲存題目'}
        </button>
        <button
          onClick={onCancel}
          className="px-6 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all"
        >
          取消
        </button>
      </div>
    </div>
  );
}

function QuizEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [quiz, setQuiz] = useState(null);
  const [quizForm, setQuizForm] = useState({ title: '', description: '', isPublic: false });
  const [questions, setQuestions] = useState([]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importMsg, setImportMsg] = useState('');

  useEffect(() => {
    if (isEdit) loadQuiz();
  }, [id]);

  const loadQuiz = async () => {
    try {
      const res = await quizAPI.get(id);
      const q = res.data.quiz;
      setQuiz(q);
      setQuizForm({ title: q.title, description: q.description || '', isPublic: q.isPublic });
      setQuestions(q.questions);
    } catch (err) {
      setError('載入測驗失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuiz = async () => {
    if (!quizForm.title.trim()) { setError('請輸入測驗標題'); return; }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await quizAPI.update(id, quizForm);
        alert('測驗資訊已更新');
      } else {
        const res = await quizAPI.create(quizForm);
        navigate(`/quiz/${res.data.quiz.id}/edit`, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuestion = async (data) => {
    const res = await quizAPI.addQuestion(id || quiz?.id, data);
    setQuestions([...questions, res.data.question]);
    setAddingQuestion(false);
  };

  const handleUpdateQuestion = async (qid, data) => {
    const res = await quizAPI.updateQuestion(qid, data);
    setQuestions(questions.map(q => q.id === qid ? res.data.question : q));
    setEditingQuestion(null);
  };

  const handleDeleteQuestion = async (qid) => {
    if (!confirm('確定要刪除此題目？')) return;
    await quizAPI.deleteQuestion(qid);
    setQuestions(questions.filter(q => q.id !== qid));
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImportMsg('匯入中...');
    try {
      const res = await quizAPI.importCSV(id, file);
      const { imported, errors, total } = res.data;
      setImportMsg(`成功匯入 ${imported} / ${total} 題${errors.length > 0 ? `，${errors.length} 筆錯誤` : ''}`);
      await loadQuiz();
    } catch (err) {
      setImportMsg(err.response?.data?.error || '匯入失敗');
    }
    setTimeout(() => setImportMsg(''), 5000);
  };

  const downloadTemplate = () => {
    const content = '題目,選項A,選項B,選項C,選項D,正確答案,時間限制,分數\n台灣首都是哪裡?,台北,台中,高雄,台南,A,20,1000\n下列哪個是程式語言?,Python,HTML,CSS,Word,A,30,1000\n';
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '題庫範本.csv';
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">載入中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-main">
      <header className="flex justify-between items-center px-6 py-4 border-b border-white/10">
        <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80">
          <span>←</span>
          <span className="text-white font-bold">返回測驗列表</span>
        </Link>
        <h1 className="text-xl font-black text-white">
          {isEdit ? '編輯測驗' : '新增測驗'}
        </h1>
        <div className="w-24" />
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-200">
            {error}
          </div>
        )}

        {/* Quiz Info */}
        <div className="card">
          <h2 className="text-xl font-bold text-white mb-4">測驗資訊</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-1">測驗標題 *</label>
              <input
                type="text"
                value={quizForm.title}
                onChange={e => setQuizForm({ ...quizForm, title: e.target.value })}
                placeholder="輸入測驗標題..."
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">描述（選填）</label>
              <textarea
                value={quizForm.description}
                onChange={e => setQuizForm({ ...quizForm, description: e.target.value })}
                placeholder="測驗描述..."
                className="input-field resize-none h-20"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={quizForm.isPublic}
                onChange={e => setQuizForm({ ...quizForm, isPublic: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-white">公開測驗</span>
            </label>
          </div>
          <button
            onClick={handleSaveQuiz}
            disabled={saving}
            className="mt-4 w-full bg-yellow-400 text-gray-900 font-bold py-3 rounded-xl hover:bg-yellow-300 transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? '儲存中...' : (isEdit ? '更新測驗資訊' : '建立測驗 →')}
          </button>
        </div>

        {/* Questions (only shown when editing existing quiz) */}
        {isEdit && (
          <div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <h2 className="text-xl font-bold text-white">
                題目列表
                <span className="ml-2 text-sm text-purple-300">({questions.length} 題)</span>
              </h2>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={downloadTemplate}
                  className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-3 rounded-xl transition-all active:scale-95 text-sm"
                >
                  下載範本
                </button>
                <label className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-2 px-3 rounded-xl transition-all active:scale-95 text-sm cursor-pointer">
                  批次匯入 CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                </label>
                <button
                  onClick={() => { setAddingQuestion(true); setEditingQuestion(null); }}
                  className="bg-green-500 hover:bg-green-400 text-white font-bold py-2 px-4 rounded-xl transition-all active:scale-95 text-sm"
                >
                  + 新增題目
                </button>
              </div>
            </div>
            {importMsg && (
              <div className="mb-3 bg-blue-500/20 border border-blue-500/50 rounded-xl p-3 text-blue-200 text-sm text-center">
                {importMsg}
              </div>
            )}

            {/* Add question form */}
            {addingQuestion && (
              <div className="mb-4">
                <QuestionForm
                  onSave={handleAddQuestion}
                  onCancel={() => setAddingQuestion(false)}
                />
              </div>
            )}

            {/* Question list */}
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={q.id}>
                  {editingQuestion === q.id ? (
                    <QuestionForm
                      question={q}
                      onSave={(data) => handleUpdateQuestion(q.id, data)}
                      onCancel={() => setEditingQuestion(null)}
                    />
                  ) : (
                    <div className="card hover:bg-white/15 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <span className="bg-purple-600 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold truncate">{q.text}</p>
                            <div className="flex gap-3 mt-1 text-xs text-purple-300">
                              <span>⏱ {q.timeLimit}秒</span>
                              <span>⭐ {q.points}分</span>
                              <span>
                                ✓ {q.options?.find(o => o.isCorrect)?.text || '?'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => { setEditingQuestion(q.id); setAddingQuestion(false); }}
                            className="bg-blue-500/70 hover:bg-blue-500 text-white text-sm font-bold py-1.5 px-3 rounded-lg transition-all"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="bg-red-500/70 hover:bg-red-500 text-white text-sm font-bold py-1.5 px-3 rounded-lg transition-all"
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {questions.length === 0 && !addingQuestion && (
                <div className="text-center py-8 card">
                  <div className="text-4xl mb-2">📝</div>
                  <p className="text-purple-200">還沒有題目，點擊「新增題目」開始！</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default QuizEditor;
