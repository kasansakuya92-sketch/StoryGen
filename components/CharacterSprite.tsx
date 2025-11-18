import React, { useState, useEffect } from 'react';

interface CharacterSpriteProps {
  src: string;
  alt: string;
  position: 'left' | 'center' | 'right';
}

const positionClasses = {
  left: 'left-[-10%] md:left-0',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-[-10%] md:right-0',
};

const CharacterSprite: React.FC<CharacterSpriteProps> = ({ src, alt, position }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fade in on mount
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, [src]); // Also re-trigger on src change

  return (
    <img
      src={src}
      alt={alt}
      className={`absolute bottom-0 h-[85%] md:h-[95%] max-h-[1200px] object-contain drop-shadow-2xl transition-all duration-700 ease-in-out ${positionClasses[position]} ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    />
  );
};

export default CharacterSprite;
