import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { BACKEND_URL } from '../lib/api';
import Timer from '../components/Timer';
import Leaderboard from '../components/Leaderboard';

const ANSWER_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
const ANSWER_ICONS = ['▲', '◆', '●', '■'];

const PHASE = {
  QUESTION: 'QUESTION',
  RESULTS: 'RESULTS',
  FINISHED: 'FINISHED',
};

function HostGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [phase, setPhase] = useState(PHASE.QUESTION);
  const [question, setQuestion] = useState(location.state?.question || null);
  const [questionIndex, setQuestionIndex] = useState(location.state?.questionIndex || 0);
  const [totalQuestions, setTotalQuestions] = useState(location.state?.totalQuestions || 0);
  const [correctOptionId, setCorrectOptionId] = useState(null);
  const [stats, setStats] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [answerCount, setAnswerCount] = useState({ answered: 0, total: 0 });
  const [timerRunning, setTimerRunning] = useState(true);
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('host:join', parseInt(gameId));
    });

    socket.on('game:question', ({ question, questionIndex, totalQuestions }) => {
      setQuestion(question);
      setQuestionIndex(questionIndex);
      setTotalQuestions(totalQuestions);
      setPhase(PHASE.QUESTION);
      setTimerRunning(true);
      setCorrectOptionId(null);
      setStats([]);
      setAnswerCount({ answered: 0, total: 0 });
    });

    socket.on('game:answer_count', ({ answered, total }) => {
      setAnswerCount({ answered, total });
    });

    socket.on('game:question_ended', ({ correctOptionId, stats, leaderboard }) => {
      setCorrectOptionId(correctOptionId);
      setStats(stats);
      setLeaderboard(leaderboard);
      setTimerRunning(false);
      setPhase(PHASE.RESULTS);
    });

    socket.on('game:finished', ({ leaderboard }) => {
      setFinalLeaderboard(leaderboard);
      setPhase(PHASE.FINISHED);
    });

    socket.on('game:error', (msg) => {
      console.error('Socket error:', msg);
    });

    return () => socket.disconnect();
  }, [gameId]);

  const handleTimerExpire = useCallback(() => {
    setTimerRunning(false);
    socketRef.current?.emit('host:show_results', parseInt(gameId));
  }, [gameId]);

  const handleNext = () => {
    socketRef.current?.emit('host:next', parseInt(gameId));
  };

  const handleEnd = () => {
    if (confirm('確定要提前結束遊戲？')) {
      socketRef.current?.emit('host:end', parseInt(gameId));
    }
  };

  const handleViewResults = () => {
    navigate(`/host/${gameId}/results`);
  };

  if (!question && phase !== PHASE.FINISHED) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">載入題目中...</div>
      </div>
    );
  }

  if (phase === PHASE.FINISHED) {
    return (
      <div className="min-h-screen bg-gradient-main flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8 animate-bounce-in">
          <div className="text-7xl mb-4">🏆</div>
          <h1 className="text-4xl font-black text-white mb-2">遊戲結束！</h1>
          <p className="text-purple-200">最終排行榜</p>
        </div>
        <div className="w-full max-w-lg mb-8">
          <Leaderboard players={finalLeaderboard} animated={true} />
        </div>
        <button
          onClick={handleViewResults}
          className="bg-yellow-400 text-gray-900 font-black text-xl py-4 px-12 rounded-2xl hover:bg-yellow-300 transition-all active:scale-95"
        >
          查看完整結果 →
        </button>
      </div>
    );
  }

  const isLastQuestion = questionIndex >= totalQuestions - 1;

  return (
    <div className="min-h-screen bg-gradient-game flex flex-col">
      {/* Header bar */}
      <div className="flex justify-between items-center px-6 py-3 bg-black/30">
        <div className="text-white">
          <span className="font-bold text-lg">第 {questionIndex + 1} / {totalQuestions} 題</span>
        </div>
        <div className="text-center">
          {phase === PHASE.QUESTION && (
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <span>已回答：</span>
              <span className="font-bold text-white">{answerCount.answered} / {answerCount.total}</span>
            </div>
          )}
        </div>
        <button
          onClick={handleEnd}
          className="text-red-400 hover:text-red-300 text-sm border border-red-400/50 rounded-full px-3 py-1 transition-colors"
        >
          結束遊戲
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col p-6">
        {phase === PHASE.QUESTION && (
          <>
            {/* Question */}
            <div className="bg-white/10 rounded-2xl p-6 mb-6 text-center">
              <h2 className="text-3xl font-black text-white leading-tight">{question.text}</h2>
              <div className="flex items-center justify-center gap-2 mt-3 text-purple-200 text-sm">
                <span>⭐ {question.points} 分</span>
                <span>•</span>
                <span>⏱ {question.timeLimit} 秒</span>
              </div>
            </div>

            {/* Timer */}
            <div className="flex justify-center mb-6">
              <Timer
                duration={question.timeLimit}
                onExpire={handleTimerExpire}
                isRunning={timerRunning}
              />
            </div>

            {/* Answer options (host sees all options) */}
            <div className="grid grid-cols-2 gap-4 flex-1">
              {question.options.map((opt, idx) => (
                <div
                  key={opt.id}
                  className={`${ANSWER_COLORS[idx]} rounded-2xl p-6 flex items-center gap-4`}
                >
                  <span className="text-white text-3xl font-black">{ANSWER_ICONS[idx]}</span>
                  <span className="text-white text-xl font-bold flex-1">{opt.text}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {phase === PHASE.RESULTS && (
          <div className="animate-fade-in flex-1 flex flex-col lg:flex-row gap-6">
            {/* Answer Stats */}
            <div className="flex-1">
              <h2 className="text-2xl font-black text-white mb-4 text-center">答題統計</h2>

              {/* Correct answer highlight */}
              {correctOptionId && (
                <div className="bg-green-500/30 border-2 border-green-400 rounded-2xl p-4 mb-4 text-center">
                  <p className="text-green-300 text-sm mb-1">✓ 正確答案</p>
                  <p className="text-white text-xl font-bold">
                    {question.options.find(o => o.id === correctOptionId)?.text}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {stats.map((stat, idx) => {
                  const maxCount = Math.max(...stats.map(s => s.count), 1);
                  const percentage = (stat.count / maxCount) * 100;
                  return (
                    <div key={stat.optionId} className="flex items-center gap-3">
                      <div className={`${ANSWER_COLORS[idx % 4]} w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0`}>
                        {ANSWER_ICONS[idx % 4]}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-white text-sm mb-1">
                          <span className={stat.isCorrect ? 'font-bold text-green-300' : ''}>{stat.text}</span>
                          <span>{stat.count}</span>
                        </div>
                        <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${stat.isCorrect ? 'bg-green-400' : ANSWER_COLORS[idx % 4]}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mini Leaderboard */}
            <div className="lg:w-72">
              <h2 className="text-2xl font-black text-white mb-4 text-center">目前排名</h2>
              <Leaderboard players={leaderboard} animated={true} maxShow={5} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {phase === PHASE.RESULTS && (
        <div className="p-6 border-t border-white/10 flex justify-center">
          <button
            onClick={handleNext}
            className="bg-green-500 hover:bg-green-400 text-white font-black text-2xl py-5 px-16 rounded-2xl transition-all active:scale-95 shadow-2xl"
          >
            {isLastQuestion ? '結束遊戲 🏁' : '下一題 →'}
          </button>
        </div>
      )}
    </div>
  );
}

export default HostGame;
