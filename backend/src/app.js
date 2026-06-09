require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const setupSocket = require('./socket');
const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quizzes');
const gameRoutes = require('./routes/games');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// Setup Socket.io
setupSocket(server);

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/games', gameRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = { app, server };
