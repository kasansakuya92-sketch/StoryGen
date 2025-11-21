import React from 'react';

export interface SliderOption {
  value: string;
  label: string;
  description: string;
}

interface MilestoneSliderProps {
  label: string;
  value: string;
  onChange: (value: any) => void;
  options: SliderOption[];
  disabled?: boolean;
}

const MilestoneSlider: React.FC<MilestoneSliderProps> = ({ label, value, onChange, options, disabled }) => {
  // Find the index of the current value to set the slider position
  const currentIndex = options.findIndex(opt => opt.value === value);
  const max = options.length - 1;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    if (options[index]) {
      onChange(options[index].value);
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline mb-2">
        <label className="block text-sm font-bold text-foreground/80">{label}</label>
        <span className="text-xs font-medium text-primary">
            {options[currentIndex]?.description}
        </span>
      </div>
      
      <div className="relative h-12">
        {/* Slider Input */}
        <input
          type="range"
          min="0"
          max={max}
          step="1"
          value={currentIndex === -1 ? 0 : currentIndex}
          onChange={handleChange}
          disabled={disabled}
          className="absolute top-0 w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer z-10 opacity-0"
        />
        
        {/* Visual Track */}
        <div className="absolute top-1 left-0 w-full h-2 bg-secondary/50 rounded-lg pointer-events-none">
           <div 
             className="h-full bg-primary rounded-lg transition-all duration-300 ease-out"
             style={{ width: `${(currentIndex / max) * 100}%` }}
           ></div>
        </div>

        {/* Thumb Visual (approximate positioning) */}
        <div 
            className="absolute top-0 w-4 h-4 bg-primary border-2 border-background rounded-full shadow-md pointer-events-none transition-all duration-300 ease-out"
            style={{ 
                left: `calc(${(currentIndex / max) * 100}% - 8px)` // Center the 16px thumb
            }}
        ></div>

        {/* Milestones / Ticks */}
        <div className="absolute top-4 w-full flex justify-between pointer-events-none">
          {options.map((opt, index) => (
            <div key={opt.value} className="flex flex-col items-center w-8" style={{ 
                // Adjust margins for first and last to align with track edges
                marginLeft: index === 0 ? '-6px' : '0', 
                marginRight: index === max ? '-6px' : '0' 
            }}>
              <div className={`w-1 h-2 mb-1 ${index <= currentIndex ? 'bg-primary/50' : 'bg-border'}`}></div>
              <span className={`text-[10px] font-semibold ${index === currentIndex ? 'text-foreground' : 'text-foreground/50'}`}>
                {opt.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MilestoneSlider;