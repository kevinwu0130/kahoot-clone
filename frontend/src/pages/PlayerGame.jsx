import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { BACKEND_URL } from '../lib/api';
import Timer from '../components/Timer';

const ANSWER_CONFIGS = [
  { color: 'answer-btn-red', bg: 'bg-red-500', icon: '▲', label: 'A' },
  { color: 'answer-btn-blue', bg: 'bg-blue-500', icon: '◆', label: 'B' },
  { color: 'answer-btn-yellow', bg: 'bg-yellow-500', icon: '●', label: 'C' },
  { color: 'answer-btn-green', bg: 'bg-green-500', icon: '■', label: 'D' },
];

const PHASE = {
  WAITING: 'WAITING',
  QUESTION: 'QUESTION',
  ANSWERED: 'ANSWERED',
  RESULTS: 'RESULTS',
  FINISHED: 'FINISHED',
};

function PlayerGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { playerId, nickname, question: initQuestion, questionIndex: initIndex, totalQuestions: initTotal } = location.state || {};

  const [phase, setPhase] = useState(PHASE.QUESTION);
  const [question, setQuestion] = useState(initQuestion || null);
  const [questionIndex, setQuestionIndex] = useState(initIndex || 0);
  const [totalQuestions, setTotalQuestions] = useState(initTotal || 0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answerResult, setAnswerResult] = useState(null); // { isCorrect, points }
  const [correctOptionId, setCorrectOptionId] = useState(null);
  const [timerRunning, setTimerRunning] = useState(true);
  const [totalScore, setTotalScore] = useState(0);
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const questionStartTime = useRef(Date.now());
  const socketRef = useRef(null);

  useEffect(() => {
    if (!playerId) {
      navigate('/', { replace: true });
      return;
    }

    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Player socket connected');
    });

    socket.on('game:question', ({ question, questionIndex, totalQuestions }) => {
      setQuestion(question);
      setQuestionIndex(questionIndex);
      setTotalQuestions(totalQuestions);
      setSelectedOption(null);
      setAnswerResult(null);
      setCorrectOptionId(null);
      setTimerRunning(true);
      setPhase(PHASE.QUESTION);
      questionStartTime.current = Date.now();
    });

    socket.on('game:question_ended', ({ correctOptionId }) => {
      setCorrectOptionId(correctOptionId);
      setTimerRunning(false);
      setPhase(PHASE.RESULTS);
    });

    socket.on('game:finished', ({ leaderboard }) => {
      setFinalLeaderboard(leaderboard);
      const myEntry = leaderboard.find(p => p.id === parseInt(playerId));
      if (myEntry) {
        setMyRank(myEntry.rank);
        setTotalScore(myEntry.score);
      }
      setPhase(PHASE.FINISHED);
    });

    socket.on('player:answer_received', ({ isCorrect, points }) => {
      setAnswerResult({ isCorrect, points });
      if (isCorrect) {
        setTotalScore(prev => prev + points);
      }
      setPhase(PHASE.ANSWERED);
    });

    socket.on('game:error', (msg) => {
      console.error('Game error:', msg);
    });

    // Re-join the game room to receive events
    socket.emit('player:rejoin', { gameId: parseInt(gameId), playerId: parseInt(playerId) });

    return () => socket.disconnect();
  }, [gameId, playerId]);

  const handleAnswer = useCallback((optionId) => {
    if (phase !== PHASE.QUESTION || selectedOption !== null) return;

    setSelectedOption(optionId);
    const responseTime = Date.now() - questionStartTime.current;

    socketRef.current?.emit('player:answer', {
      playerId: parseInt(playerId),
      gameId: parseInt(gameId),
      questionId: question.id,
      optionId,
      responseTime,
    });
  }, [phase, selectedOption, playerId, gameId, question]);

  const handleTimerExpire = useCallback(() => {
    setTimerRunning(false);
    if (!selectedOption) {
      setPhase(PHASE.ANSWERED);
      setAnswerResult({ isCorrect: false, points: 0 });
    }
  }, [selectedOption]);

  if (!question && phase !== PHASE.FINISHED) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">載入遊戲中...</div>
      </div>
    );
  }

  // Final results screen
  if (phase === PHASE.FINISHED) {
    const MEDALS = ['🥇', '🥈', '🥉'];
    return (
      <div className="min-h-screen bg-gradient-main flex flex-col items-center justify-center p-6">
        <div className="text-center animate-bounce-in">
          <div className="text-8xl mb-4">
            {myRank && myRank <= 3 ? MEDALS[myRank - 1] : '🎉'}
          </div>
          <h1 className="text-4xl font-black text-white mb-2">
            {myRank === 1 ? '你是冠軍！' : myRank && myRank <= 3 ? `第 ${myRank} 名！` : '遊戲結束！'}
          </h1>
          <p className="text-purple-200 text-lg mb-2">{nickname}</p>
          {myRank && (
            <div className="bg-white/10 rounded-2xl p-4 mb-6 inline-block">
              <div className="text-5xl font-black text-yellow-400">{totalScore.toLocaleString()}</div>
              <div className="text-purple-200">總分</div>
              <div className="text-white mt-1">排名：第 {myRank} 名</div>
            </div>
          )}

          {/* Mini final leaderboard */}
          <div className="w-full max-w-sm space-y-2 mb-6">
            {finalLeaderboard.slice(0, 5).map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-xl ${p.id === parseInt(playerId) ? 'bg-yellow-400/20 border border-yellow-400' : 'bg-white/10'}`}
              >
                <span className="w-8 text-center font-bold">
                  {idx < 3 ? MEDALS[idx] : `#${idx + 1}`}
                </span>
                <span className="flex-1 text-white font-bold truncate">{p.nickname}</span>
                <span className="text-white font-black">{p.score.toLocaleString()}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/')}
            className="bg-yellow-400 text-gray-900 font-black text-xl py-4 px-10 rounded-2xl hover:bg-yellow-300 transition-all active:scale-95"
          >
            回到首頁
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-game flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 bg-black/20">
        <div className="text-white text-sm font-bold">{nickname}</div>
        <div className="text-white text-sm">
          第 {questionIndex + 1} / {totalQuestions} 題
        </div>
        <div className="text-yellow-400 font-black">{totalScore.toLocaleString()} 分</div>
      </div>

      {/* Question */}
      <div className="bg-white/10 mx-4 my-3 rounded-2xl p-4 text-center">
        {phase === PHASE.QUESTION && (
          <div className="flex justify-center mb-2">
            <Timer
              duration={question.timeLimit}
              onExpire={handleTimerExpire}
              isRunning={timerRunning}
            />
          </div>
        )}
        <h2 className="text-xl font-black text-white leading-tight">{question.text}</h2>
      </div>

      {/* Answer Phase */}
      {(phase === PHASE.QUESTION) && (
        <div className="flex-1 grid grid-cols-2 gap-3 p-4">
          {question.options.map((opt, idx) => {
            const cfg = ANSWER_CONFIGS[idx % 4];
            return (
              <button
                key={opt.id}
                onClick={() => handleAnswer(opt.id)}
                disabled={selectedOption !== null}
                className={`${cfg.color} flex-col justify-center items-center text-center disabled:cursor-not-allowed`}
                style={{ minHeight: '100px' }}
              >
                <span className="text-4xl block mb-2">{cfg.icon}</span>
                <span className="text-base">{opt.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Answered / Waiting */}
      {phase === PHASE.ANSWERED && answerResult && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
          {answerResult.isCorrect ? (
            <div className="text-center">
              <div className="text-8xl mb-4 animate-bounce-in">✅</div>
              <h2 className="text-4xl font-black text-green-400 mb-2">答對了！</h2>
              <div className="text-6xl font-black text-yellow-400 mb-2">+{answerResult.points}</div>
              <p className="text-purple-200 text-lg">分</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-8xl mb-4 animate-bounce-in">❌</div>
              <h2 className="text-4xl font-black text-red-400 mb-2">
                {selectedOption ? '答錯了' : '時間到！'}
              </h2>
              <p className="text-purple-200 text-lg">等待下一題...</p>
            </div>
          )}
        </div>
      )}

      {/* Results phase - show correct answer */}
      {phase === PHASE.RESULTS && (
        <div className="flex-1 flex flex-col p-4 animate-fade-in">
          {/* Highlight correct answer */}
          <div className="grid grid-cols-2 gap-3 flex-1">
            {question.options.map((opt, idx) => {
              const cfg = ANSWER_CONFIGS[idx % 4];
              const isCorrect = opt.id === correctOptionId;
              const wasSelected = opt.id === selectedOption;

              return (
                <div
                  key={opt.id}
                  className={`${cfg.bg} rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all relative ${
                    isCorrect ? 'ring-4 ring-white scale-105' : 'opacity-50'
                  }`}
                  style={{ minHeight: '80px' }}
                >
                  {isCorrect && (
                    <span className="absolute -top-2 -right-2 bg-green-400 text-white text-xs font-bold px-2 py-1 rounded-full">✓ 正確</span>
                  )}
                  {wasSelected && !isCorrect && (
                    <span className="absolute -top-2 -right-2 bg-red-400 text-white text-xs font-bold px-2 py-1 rounded-full">✗</span>
                  )}
                  <span className="text-2xl mb-1">{cfg.icon}</span>
                  <span className="text-white text-sm font-bold">{opt.text}</span>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-4 text-purple-200 animate-pulse">
            等待主持人繼續...
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayerGame;
