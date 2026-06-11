const { Server } = require('socket.io');
const prisma = require('./lib/prisma');
const gameConfig = require('./lib/gameConfig');

// How long the answer-stats screen stays up before auto-advancing (auto mode).
const AUTO_ADVANCE_DELAY_MS = 5000;

// In-memory state for active game timers
const gameTimers = {};
const questionStartTimes = {};

// Resolve the ordered list of questions this game should run. Falls back to all
// of the quiz's questions (in order) if no per-game config exists (e.g. after a
// server restart). `game` must include quiz.questions ordered by `order` asc.
function gameQuestions(gameId, game) {
  const all = game.quiz.questions;
  const cfg = gameConfig.get(gameId);
  if (!cfg || !Array.isArray(cfg.questionIds) || cfg.questionIds.length === 0) {
    return all;
  }
  const byId = new Map(all.map((q) => [q.id, q]));
  const picked = cfg.questionIds.map((id) => byId.get(id)).filter(Boolean);
  return picked.length ? picked : all;
}
// Tracks the current live socket id for each player, so a stale socket's
// disconnect (e.g. the join page navigating away) doesn't kick a player who
// has already reconnected on a new page.
const playerSockets = {};

function setupSocket(server) {
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:5174']

  const io = new Server(server, {
    cors: {
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          cb(null, true)
        } else {
          cb(new Error('Not allowed by CORS'))
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Player rejoins socket room after page navigation
    socket.on('player:rejoin', async ({ gameId, playerId }) => {
      try {
        const player = await prisma.player.findUnique({
          where: { id: parseInt(playerId) },
        });

        if (!player || player.gameId !== parseInt(gameId)) {
          socket.emit('game:error', '重新加入失敗');
          return;
        }

        socket.join(`game:${gameId}`);
        socket.data.role = 'player';
        socket.data.gameId = gameId;
        socket.data.playerId = playerId;
        playerSockets[playerId] = socket.id;

        // The join page disconnects its socket right before navigating here, which
        // marks the player inactive. Reactivate so the host's lobby count is correct.
        if (!player.isActive) {
          await prisma.player.update({
            where: { id: parseInt(playerId) },
            data: { isActive: true },
          });
        }

        // Broadcast updated player list to the whole room (host + players)
        const players = await prisma.player.findMany({
          where: { gameId: parseInt(gameId), isActive: true },
          select: { id: true, nickname: true, score: true },
        });

        io.to(`game:${gameId}`).emit('game:player_joined', { players });
        console.log(`Player ${playerId} rejoined game ${gameId}`);
      } catch (error) {
        console.error('player:rejoin error:', error);
        socket.emit('game:error', '重新加入失敗');
      }
    });

    // Host joins game room
    socket.on('host:join', async (gameId) => {
      try {
        const game = await prisma.game.findUnique({
          where: { id: parseInt(gameId) },
          include: {
            players: { where: { isActive: true } },
          },
        });

        if (!game) {
          socket.emit('game:error', '遊戲不存在');
          return;
        }

        socket.join(`game:${gameId}`);
        socket.join(`host:${gameId}`);
        socket.data.role = 'host';
        socket.data.gameId = gameId;

        console.log(`Host joined game ${gameId}`);
        socket.emit('game:joined', { game });
      } catch (error) {
        console.error('host:join error:', error);
        socket.emit('game:error', '加入遊戲失敗');
      }
    });

    // Host starts game
    socket.on('host:start', async (gameId) => {
      try {
        const game = await prisma.game.findUnique({
          where: { id: parseInt(gameId) },
          include: {
            quiz: {
              include: {
                questions: {
                  include: { options: { orderBy: { order: 'asc' } } },
                  orderBy: { order: 'asc' },
                },
              },
            },
            players: { where: { isActive: true } },
          },
        });

        if (!game) {
          socket.emit('game:error', '遊戲不存在');
          return;
        }

        if (game.status !== 'WAITING') {
          socket.emit('game:error', '遊戲已開始');
          return;
        }

        const questions = gameQuestions(gameId, game);

        if (questions.length === 0) {
          socket.emit('game:error', '沒有題目');
          return;
        }

        // Update game status
        await prisma.game.update({
          where: { id: parseInt(gameId) },
          data: { status: 'PLAYING', startedAt: new Date(), currentQuestion: 0 },
        });

        const firstQuestion = questions[0];
        const questionForClient = {
          id: firstQuestion.id,
          text: firstQuestion.text,
          timeLimit: firstQuestion.timeLimit,
          points: firstQuestion.points,
          options: firstQuestion.options.map(o => ({ id: o.id, text: o.text, order: o.order })),
        };

        questionStartTimes[gameId] = Date.now();

        io.to(`game:${gameId}`).emit('game:started', {
          question: questionForClient,
          questionIndex: 0,
          totalQuestions: questions.length,
        });

        io.to(`game:${gameId}`).emit('game:question', {
          question: questionForClient,
          questionIndex: 0,
          totalQuestions: questions.length,
        });

        console.log(`Game ${gameId} started`);

        // Auto-end this question after its time limit
        scheduleQuestionEnd(io, gameId, questions, 0);
      } catch (error) {
        console.error('host:start error:', error);
        socket.emit('game:error', '開始遊戲失敗');
      }
    });

    // Host moves to next question
    socket.on('host:next', async (gameId) => {
      try {
        await advanceToNext(io, gameId);
      } catch (error) {
        console.error('host:next error:', error);
        socket.emit('game:error', '下一題失敗');
      }
    });

    // Host ends game early
    socket.on('host:end', async (gameId) => {
      try {
        clearGameTimer(gameId);

        const game = await prisma.game.findUnique({
          where: { id: parseInt(gameId) },
          include: { players: { where: { isActive: true } } },
        });

        if (!game) return;

        await endGame(io, gameId, game);
      } catch (error) {
        console.error('host:end error:', error);
      }
    });

    // Host shows question results (after timer)
    socket.on('host:show_results', async (gameId) => {
      try {
        clearGameTimer(gameId);
        await showQuestionResults(io, gameId);
      } catch (error) {
        console.error('host:show_results error:', error);
      }
    });

    // Player joins game
    socket.on('player:join', async ({ code, nickname }) => {
      try {
        if (!code || !nickname) {
          socket.emit('game:error', '請輸入遊戲代碼和暱稱');
          return;
        }

        const game = await prisma.game.findUnique({
          where: { code: code.toString() },
          include: { players: { where: { isActive: true } } },
        });

        if (!game) {
          socket.emit('game:error', '遊戲代碼不正確');
          return;
        }

        if (game.status !== 'WAITING') {
          socket.emit('game:error', '遊戲已開始，無法加入');
          return;
        }

        // Check nickname uniqueness
        const nicknameExists = game.players.some(
          p => p.nickname.toLowerCase() === nickname.toLowerCase()
        );
        if (nicknameExists) {
          socket.emit('game:error', '此暱稱已被使用');
          return;
        }

        const player = await prisma.player.create({
          data: {
            gameId: game.id,
            nickname,
            score: 0,
          },
        });

        socket.join(`game:${game.id}`);
        socket.data.role = 'player';
        socket.data.gameId = game.id;
        socket.data.playerId = player.id;
        playerSockets[player.id] = socket.id;

        // Get updated player list
        const updatedPlayers = await prisma.player.findMany({
          where: { gameId: game.id, isActive: true },
          select: { id: true, nickname: true, score: true },
        });

        socket.emit('player:joined', { playerId: player.id, gameId: game.id, game });
        io.to(`game:${game.id}`).emit('game:player_joined', { players: updatedPlayers });

        console.log(`Player ${nickname} joined game ${game.id}`);
      } catch (error) {
        console.error('player:join error:', error);
        socket.emit('game:error', '加入遊戲失敗');
      }
    });

    // Player submits answer
    socket.on('player:answer', async ({ playerId, gameId, questionId, optionId, responseTime }) => {
      try {
        const existingAnswer = await prisma.gameAnswer.findFirst({
          where: { gameId: parseInt(gameId), playerId: parseInt(playerId), questionId: parseInt(questionId) },
        });

        if (existingAnswer) {
          socket.emit('game:error', '已經回答過了');
          return;
        }

        const option = await prisma.option.findUnique({
          where: { id: parseInt(optionId) },
          include: { question: true },
        });

        if (!option || option.questionId !== parseInt(questionId)) {
          socket.emit('game:error', '選項無效');
          return;
        }

        const isCorrect = option.isCorrect;
        let points = 0;

        if (isCorrect) {
          const question = option.question;
          const startTime = questionStartTimes[gameId] || Date.now();
          const elapsed = (Date.now() - startTime) / 1000;
          const timeRemaining = Math.max(0, question.timeLimit - elapsed);
          const speedBonus = timeRemaining / question.timeLimit;
          points = Math.round(question.points * (0.5 + 0.5 * speedBonus));
        }

        await prisma.gameAnswer.create({
          data: {
            gameId: parseInt(gameId),
            playerId: parseInt(playerId),
            questionId: parseInt(questionId),
            optionId: parseInt(optionId),
            isCorrect,
            points,
            responseTime: responseTime || 0,
          },
        });

        if (isCorrect) {
          await prisma.player.update({
            where: { id: parseInt(playerId) },
            data: { score: { increment: points } },
          });
        }

        socket.emit('player:answer_received', { isCorrect, points });

        // Check if all active players answered
        const game = await prisma.game.findUnique({
          where: { id: parseInt(gameId) },
          include: { players: { where: { isActive: true } } },
        });

        const answeredCount = await prisma.gameAnswer.count({
          where: { gameId: parseInt(gameId), questionId: parseInt(questionId) },
        });

        const totalPlayers = game.players.length;

        // Notify host of answer progress
        io.to(`host:${gameId}`).emit('game:answer_count', {
          answered: answeredCount,
          total: totalPlayers,
        });

        if (answeredCount >= totalPlayers) {
          clearGameTimer(gameId);
          await showQuestionResults(io, gameId);
        }
      } catch (error) {
        console.error('player:answer error:', error);
        socket.emit('game:error', '提交答案失敗');
      }
    });

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);

      if (socket.data.role === 'player' && socket.data.playerId) {
        // Only deactivate if this socket is still the player's current one.
        // If the player already reconnected on another page, a newer socket id
        // is registered and this stale disconnect should be ignored.
        if (playerSockets[socket.data.playerId] !== socket.id) {
          return;
        }
        try {
          delete playerSockets[socket.data.playerId];
          await prisma.player.update({
            where: { id: socket.data.playerId },
            data: { isActive: false },
          });

          const players = await prisma.player.findMany({
            where: { gameId: socket.data.gameId, isActive: true },
            select: { id: true, nickname: true, score: true },
          });

          io.to(`game:${socket.data.gameId}`).emit('game:player_joined', { players });
        } catch (error) {
          console.error('disconnect cleanup error:', error);
        }
      }
    });
  });

  return io;
}

function scheduleQuestionEnd(io, gameId, questions, questionIndex) {
  const question = questions[questionIndex];
  const timeLimit = question.timeLimit * 1000;

  gameTimers[gameId] = setTimeout(async () => {
    await showQuestionResults(io, gameId);
  }, timeLimit + 500); // small buffer
}

// Advance to the next question (or end the game). Shared by the host's manual
// "next" button and the auto-advance timer.
async function advanceToNext(io, gameId) {
  clearGameTimer(gameId);

  const game = await prisma.game.findUnique({
    where: { id: parseInt(gameId) },
    include: {
      quiz: {
        include: {
          questions: {
            include: { options: { orderBy: { order: 'asc' } } },
            orderBy: { order: 'asc' },
          },
        },
      },
      players: { where: { isActive: true } },
    },
  });

  if (!game || game.status !== 'PLAYING') return;

  const questions = gameQuestions(gameId, game);
  const nextIndex = game.currentQuestion + 1;

  if (nextIndex >= questions.length) {
    await endGame(io, gameId, game);
    return;
  }

  await prisma.game.update({
    where: { id: parseInt(gameId) },
    data: { currentQuestion: nextIndex },
  });

  const nextQuestion = questions[nextIndex];
  const questionForClient = {
    id: nextQuestion.id,
    text: nextQuestion.text,
    timeLimit: nextQuestion.timeLimit,
    points: nextQuestion.points,
    options: nextQuestion.options.map((o) => ({ id: o.id, text: o.text, order: o.order })),
  };

  questionStartTimes[gameId] = Date.now();

  io.to(`game:${gameId}`).emit('game:question', {
    question: questionForClient,
    questionIndex: nextIndex,
    totalQuestions: questions.length,
  });

  scheduleQuestionEnd(io, gameId, questions, nextIndex);
}

function clearGameTimer(gameId) {
  if (gameTimers[gameId]) {
    clearTimeout(gameTimers[gameId]);
    delete gameTimers[gameId];
  }
}

async function showQuestionResults(io, gameId) {
  try {
    const game = await prisma.game.findUnique({
      where: { id: parseInt(gameId) },
      include: {
        quiz: {
          include: {
            questions: {
              include: { options: { orderBy: { order: 'asc' } } },
              orderBy: { order: 'asc' },
            },
          },
        },
        players: { where: { isActive: true }, orderBy: { score: 'desc' } },
      },
    });

    if (!game || game.status !== 'PLAYING') return;

    const questions = gameQuestions(gameId, game);
    const currentQ = questions[game.currentQuestion];
    const correctOption = currentQ.options.find(o => o.isCorrect);

    // Get answer stats
    const answers = await prisma.gameAnswer.findMany({
      where: { gameId: parseInt(gameId), questionId: currentQ.id },
    });

    const stats = currentQ.options.map(opt => ({
      optionId: opt.id,
      text: opt.text,
      count: answers.filter(a => a.optionId === opt.id).length,
      isCorrect: opt.isCorrect,
    }));

    const leaderboard = game.players.slice(0, 10).map((p, idx) => ({
      rank: idx + 1,
      nickname: p.nickname,
      score: p.score,
      id: p.id,
    }));

    io.to(`game:${gameId}`).emit('game:question_ended', {
      correctOptionId: correctOption ? correctOption.id : null,
      stats,
      leaderboard,
    });

    // Auto-advance mode: move on after a short results display. Stored in
    // gameTimers so a manual "next" (host:next → clearGameTimer) cancels it.
    const cfg = gameConfig.get(gameId);
    if (cfg?.autoAdvance) {
      clearGameTimer(gameId);
      gameTimers[gameId] = setTimeout(() => {
        advanceToNext(io, gameId).catch((e) => console.error('auto-advance error:', e));
      }, AUTO_ADVANCE_DELAY_MS);
    }
  } catch (error) {
    console.error('showQuestionResults error:', error);
  }
}

async function endGame(io, gameId, game) {
  try {
    const players = await prisma.player.findMany({
      where: { gameId: parseInt(gameId), isActive: true },
      orderBy: { score: 'desc' },
    });

    // Update ranks
    for (let i = 0; i < players.length; i++) {
      await prisma.player.update({
        where: { id: players[i].id },
        data: { rank: i + 1 },
      });
    }

    await prisma.game.update({
      where: { id: parseInt(gameId) },
      data: { status: 'FINISHED', finishedAt: new Date() },
    });

    const leaderboard = players.map((p, idx) => ({
      rank: idx + 1,
      nickname: p.nickname,
      score: p.score,
      id: p.id,
    }));

    io.to(`game:${gameId}`).emit('game:finished', { leaderboard });
    clearGameTimer(gameId);
    gameConfig.delete(gameId);
    console.log(`Game ${gameId} finished`);
  } catch (error) {
    console.error('endGame error:', error);
  }
}

module.exports = setupSocket;
