#!/bin/bash
# Start Kahoot Clone - both backend and frontend
export PATH="/c/Program Files/nodejs:$PATH"

echo "Starting Kahoot Clone..."
echo ""

# Start backend
cd /c/Users/kevin.wu/Projects/kahoot-clone/backend
echo "Starting backend on http://localhost:3001 ..."
node src/app.js &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
cd /c/Users/kevin.wu/Projects/kahoot-clone/frontend
echo "Starting frontend on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo " Kahoot Clone is running!"
echo "========================================"
echo " Frontend: http://localhost:5173"
echo " Backend:  http://localhost:3001"
echo ""
echo " Host login: admin@kahoot.com / Admin@1234"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop..."

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; echo 'Stopped.'; exit" INT
wait
