
import React from 'react';
import { Waveform } from 'lucide-react';

const Header = () => {
  return (
    <header className="w-full py-6 animate-fade-in">
      <div className="container flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Waveform size={28} className="text-neon-blue animate-pulse-glow" />
          <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-neon-blue to-neon-purple">
            SyncFusion
          </h1>
        </div>
        <div className="text-muted-foreground text-sm">
          <span className="glass-panel px-3 py-1 rounded-full">
            Audio-Visual Synchronizer
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
