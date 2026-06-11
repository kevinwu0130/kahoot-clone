const express = require('express');
const multer = require('multer');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 6 || !cols[0]) continue;
    rows.push(cols);
  }
  return rows;
}

// All routes require authentication
router.use(authMiddleware);

// GET /api/quizzes - list my quizzes
router.get('/', async (req, res, next) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: { createdById: req.user.id },
      include: {
        _count: { select: { questions: true, games: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ quizzes });
  } catch (error) {
    next(error);
  }
});

// POST /api/quizzes - create quiz
router.post('/', async (req, res, next) => {
  try {
    const { title, description, isPublic } = req.body;

    if (!title) {
      return res.status(400).json({ error: '請輸入測驗標題' });
    }

    const quiz = await prisma.quiz.create({
      data: {
        title,
        description: description || null,
        isPublic: isPublic || false,
        createdById: req.user.id,
      },
      include: {
        _count: { select: { questions: true } },
      },
    });

    res.status(201).json({ quiz });
  } catch (error) {
    next(error);
  }
});

// GET /api/quizzes/:id - get quiz with questions
router.get('/:id', async (req, res, next) => {
  try {
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: parseInt(req.params.id),
        createdById: req.user.id,
      },
      include: {
        questions: {
          include: { options: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!quiz) {
      return res.status(404).json({ error: '測驗不存在' });
    }

    res.json({ quiz });
  } catch (error) {
    next(error);
  }
});

// PUT /api/quizzes/:id - update quiz
router.put('/:id', async (req, res, next) => {
  try {
    const { title, description, isPublic } = req.body;

    const existing = await prisma.quiz.findFirst({
      where: { id: parseInt(req.params.id), createdById: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ error: '測驗不存在' });
    }

    const quiz = await prisma.quiz.update({
      where: { id: parseInt(req.params.id) },
      data: {
        title: title || existing.title,
        description: description !== undefined ? description : existing.description,
        isPublic: isPublic !== undefined ? isPublic : existing.isPublic,
      },
      include: {
        questions: {
          include: { options: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    });

    res.json({ quiz });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/quizzes/:id - delete quiz
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.quiz.findFirst({
      where: { id: parseInt(req.params.id), createdById: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ error: '測驗不存在' });
    }

    await prisma.quiz.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: '測驗已刪除' });
  } catch (error) {
    next(error);
  }
});

// POST /api/quizzes/:id/questions - add question
router.post('/:id/questions', async (req, res, next) => {
  try {
    const { text, timeLimit, points, options } = req.body;

    const quiz = await prisma.quiz.findFirst({
      where: { id: parseInt(req.params.id), createdById: req.user.id },
    });

    if (!quiz) {
      return res.status(404).json({ error: '測驗不存在' });
    }

    if (!text) {
      return res.status(400).json({ error: '請輸入題目文字' });
    }

    if (!options || options.length < 2) {
      return res.status(400).json({ error: '至少需要 2 個選項' });
    }

    const hasCorrect = options.some(o => o.isCorrect);
    if (!hasCorrect) {
      return res.status(400).json({ error: '至少需要一個正確答案' });
    }

    // Get max order
    const maxOrder = await prisma.question.aggregate({
      where: { quizId: parseInt(req.params.id) },
      _max: { order: true },
    });

    const newOrder = (maxOrder._max.order || 0) + 1;

    const question = await prisma.question.create({
      data: {
        quizId: parseInt(req.params.id),
        order: newOrder,
        text,
        timeLimit: timeLimit || 20,
        points: points || 1000,
        options: {
          create: options.map((opt, idx) => ({
            text: opt.text,
            isCorrect: opt.isCorrect || false,
            order: idx,
          })),
        },
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });

    res.status(201).json({ question });
  } catch (error) {
    next(error);
  }
});

// PUT /api/quizzes/questions/:qid - update question
router.put('/questions/:qid', async (req, res, next) => {
  try {
    const { text, timeLimit, points, options } = req.body;

    const question = await prisma.question.findFirst({
      where: {
        id: parseInt(req.params.qid),
        quiz: { createdById: req.user.id },
      },
      include: { options: true },
    });

    if (!question) {
      return res.status(404).json({ error: '題目不存在' });
    }

    // Update question and replace options
    const updatedQuestion = await prisma.$transaction(async (tx) => {
      await tx.option.deleteMany({ where: { questionId: question.id } });

      return tx.question.update({
        where: { id: question.id },
        data: {
          text: text || question.text,
          timeLimit: timeLimit || question.timeLimit,
          points: points || question.points,
          options: {
            create: (options || []).map((opt, idx) => ({
              text: opt.text,
              isCorrect: opt.isCorrect || false,
              order: idx,
            })),
          },
        },
        include: { options: { orderBy: { order: 'asc' } } },
      });
    });

    res.json({ question: updatedQuestion });
  } catch (error) {
    next(error);
  }
});

// POST /api/quizzes/:id/import - bulk import questions from CSV
router.post('/:id/import', upload.single('file'), async (req, res, next) => {
  try {
    const quiz = await prisma.quiz.findFirst({
      where: { id: parseInt(req.params.id), createdById: req.user.id },
    });
    if (!quiz) return res.status(404).json({ error: '測驗不存在' });
    if (!req.file) return res.status(400).json({ error: '請上傳 CSV 檔案' });

    const text = req.file.buffer.toString('utf-8');
    const rows = parseCSV(text);
    if (rows.length === 0) return res.status(400).json({ error: 'CSV 無有效資料' });

    const maxOrder = await prisma.question.aggregate({
      where: { quizId: quiz.id },
      _max: { order: true },
    });
    let order = (maxOrder._max.order || 0) + 1;

    const ANSWER_MAP = { A: 0, B: 1, C: 2, D: 3, a: 0, b: 1, c: 2, d: 3 };
    let imported = 0;
    const errors = [];

    for (const [i, cols] of rows.entries()) {
      const [qText, optA, optB, optC, optD, answer, timeStr, pointsStr] = cols;
      const answerIdx = ANSWER_MAP[answer];
      if (answerIdx === undefined) { errors.push(`第 ${i + 2} 行：正確答案格式錯誤（請填 A/B/C/D）`); continue; }

      const rawOptions = [optA, optB, optC, optD];
      const options = rawOptions
        .map((text, idx) => ({ text: text || '', isCorrect: idx === answerIdx, order: idx }))
        .filter(o => o.text);

      if (options.length < 2) { errors.push(`第 ${i + 2} 行：至少需要 2 個選項`); continue; }
      if (!options.some(o => o.isCorrect)) { errors.push(`第 ${i + 2} 行：正確答案對應的選項不存在`); continue; }

      const timeLimit = parseInt(timeStr) || 20;
      const points = parseInt(pointsStr) || 1000;

      await prisma.question.create({
        data: {
          quizId: quiz.id,
          order: order++,
          text: qText,
          timeLimit,
          points,
          options: { create: options },
        },
      });
      imported++;
    }

    res.json({ imported, errors, total: rows.length });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/quizzes/questions/:qid - delete question
router.delete('/questions/:qid', async (req, res, next) => {
  try {
    const question = await prisma.question.findFirst({
      where: {
        id: parseInt(req.params.qid),
        quiz: { createdById: req.user.id },
      },
    });

    if (!question) {
      return res.status(404).json({ error: '題目不存在' });
    }

    await prisma.question.delete({ where: { id: question.id } });
    res.json({ message: '題目已刪除' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
