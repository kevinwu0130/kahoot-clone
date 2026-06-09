import { useState, useEffect, useRef } from 'react';

function Timer({ duration, onExpire, isRunning = true }) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    setTimeLeft(duration);
    startTimeRef.current = Date.now();
  }, [duration]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        if (onExpire) onExpire();
      }
    }, 100);

    return () => clearInterval(intervalRef.current);
  }, [duration, isRunning, onExpire]);

  const percentage = (timeLeft / duration) * 100;
  const circumference = 2 * Math.PI * 40; // radius = 40
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage > 50) return '#22c55e'; // green
    if (percentage > 25) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const displayTime = Math.ceil(timeLeft);

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={getColor()}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s ease' }}
        />
      </svg>
      <div
        className="absolute text-3xl font-black"
        style={{ color: getColor() }}
      >
        {displayTime}
      </div>
    </div>
  );
}

export default Timer;
