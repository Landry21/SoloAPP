import React, { useState, useEffect } from 'react';
import '../styles/RollingText.css';

const RollingText = ({ words, speed = 2000 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % words.length);
    }, speed);

    return () => clearInterval(interval);
  }, [words.length, speed]);

  return (
    <div className="rolling-text-container">
      <span className="rolling-text">
        {words[currentIndex]}
      </span>
    </div>
  );
};

export default RollingText; 