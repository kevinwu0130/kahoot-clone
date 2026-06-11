const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');
const gameConfig = require('../lib/gameConfig');

const router = express.Router();

function generateGameCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Fisher–Yates shuffle (returns a new array)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// POST /api/games - create game room
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { quizId, questionCount, autoAdvance } = req.body;

    if (!quizId) {
      return res.status(400).json({ error: '請選擇測驗' });
    }

    const quiz = await prisma.quiz.findFirst({
      where: { id: parseInt(quizId), createdById: req.user.id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    if (!quiz) {
      return res.status(404).json({ error: '測驗不存在' });
    }

    if (quiz.questions.length === 0) {
      return res.status(400).json({ error: '測驗沒有題目，請先新增題目' });
    }

    // Decide which questions this game will use. Default = all (in order).
    // If questionCount is set and smaller than the pool, randomly pick that many.
    const total = quiz.questions.length;
    let count = parseInt(questionCount);
    if (!Number.isInteger(count) || count <= 0 || count >= total) {
      count = total;
    }
    const questionIds =
      count >= total
        ? quiz.questions.map((q) => q.id)
        : shuffle(quiz.questions.map((q) => q.id)).slice(0, count);

    // Generate unique code
    let code;
    let attempts = 0;
    do {
      code = generateGameCode();
      const existing = await prisma.game.findUnique({ where: { code } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    const game = await prisma.game.create({
      data: {
        code,
        quizId: parseInt(quizId),
        hostId: req.user.id,
        status: 'WAITING',
      },
      include: {
        quiz: {
          include: {
            questions: {
              include: { options: { orderBy: { order: 'asc' } } },
              orderBy: { order: 'asc' },
            },
          },
        },
        players: true,
      },
    });

    // Remember this game's chosen questions + advance mode (in-memory).
    gameConfig.set(game.id, { questionIds, autoAdvance: !!autoAdvance });

    res.status(201).json({
      game: {
        ...game,
        questionCount: questionIds.length,
        autoAdvance: !!autoAdvance,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/games/:id - get game details
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const game = await prisma.game.findFirst({
      where: {
        id: parseInt(req.params.id),
        hostId: req.user.id,
      },
      include: {
        quiz: {
          include: {
            questions: {
              include: { options: { orderBy: { order: 'asc' } } },
              orderBy: { order: 'asc' },
            },
          },
        },
        players: {
          where: { isActive: true },
          orderBy: { score: 'desc' },
        },
      },
    });

    if (!game) {
      return res.status(404).json({ error: '遊戲不存在' });
    }

    const cfg = gameConfig.get(game.id);
    const questionCount = cfg?.questionIds?.length ?? game.quiz.questions.length;
    const autoAdvance = cfg?.autoAdvance ?? false;

    res.json({ game: { ...game, questionCount, autoAdvance } });
  } catch (error) {
    next(error);
  }
});

// GET /api/games/:id/results - get final results
router.get('/:id/results', authMiddleware, async (req, res, next) => {
  try {
    const game = await prisma.game.findFirst({
      where: {
        id: parseInt(req.params.id),
        hostId: req.user.id,
      },
      include: {
        quiz: { select: { title: true } },
        players: {
          orderBy: { score: 'desc' },
        },
        answers: {
          include: {
            player: { select: { nickname: true } },
            question: { select: { text: true } },
          },
        },
      },
    });

    if (!game) {
      return res.status(404).json({ error: '遊戲不存在' });
    }

    const leaderboard = game.players.map((player, index) => ({
      ...player,
      rank: index + 1,
    }));

    res.json({ game, leaderboard });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
