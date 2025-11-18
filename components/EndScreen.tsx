import React from 'react';

interface EndScreenProps {
  onRestart: () => void;
  onGoToHub: () => void;
}

const EndScreen: React.FC<EndScreenProps> = ({ onRestart, onGoToHub }) => {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-8 bg-cover bg-center" style={{ backgroundImage: "url('https://picsum.photos/seed/vn-end/1920/1080')" }}>
      <div className="absolute inset-0 bg-onyx/70 backdrop-blur-md"></div>
      <div className="relative z-10 text-white">
        <h1 className="text-7xl md:text-9xl font-bold drop-shadow-lg mb-6">The End</h1>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
            onClick={onRestart}
            className="px-8 py-4 bg-primary text-primary-foreground font-bold text-xl rounded-lg shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-ring/50 transform hover:scale-105 transition-all duration-300 ease-in-out"
            >
            Play Again
            </button>
            <button
            onClick={onGoToHub}
            className="px-6 py-3 bg-card/30 border-2 border-border text-white font-semibold text-lg rounded-lg shadow-md backdrop-blur-sm hover:bg-card/50 focus:outline-none focus:ring-4 focus:ring-ring/50 transform hover:scale-105 transition-all duration-300 ease-in-out"
            >
            Back to Hub
            </button>
        </div>
      </div>
    </div>
  );
};

export default EndScreen;