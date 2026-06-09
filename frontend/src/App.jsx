import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import QuizEditor from './pages/QuizEditor';
import HostLobby from './pages/HostLobby';
import HostGame from './pages/HostGame';
import PlayerJoin from './pages/PlayerJoin';
import PlayerLobby from './pages/PlayerLobby';
import PlayerGame from './pages/PlayerGame';
import Results from './pages/Results';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">載入中...</div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/join" element={<PlayerJoin />} />
          <Route path="/play/:gameId" element={<PlayerLobby />} />
          <Route path="/game/:gameId/play" element={<PlayerGame />} />
          <Route path="/game/:gameId/results" element={<Results />} />

          {/* Host routes (protected) */}
          <Route path="/dashboard" element={
            <PrivateRoute><Dashboard /></PrivateRoute>
          } />
          <Route path="/quiz/new" element={
            <PrivateRoute><QuizEditor /></PrivateRoute>
          } />
          <Route path="/quiz/:id/edit" element={
            <PrivateRoute><QuizEditor /></PrivateRoute>
          } />
          <Route path="/host/:gameId/lobby" element={
            <PrivateRoute><HostLobby /></PrivateRoute>
          } />
          <Route path="/host/:gameId/game" element={
            <PrivateRoute><HostGame /></PrivateRoute>
          } />
          <Route path="/host/:gameId/results" element={
            <PrivateRoute><Results isHost /></PrivateRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
