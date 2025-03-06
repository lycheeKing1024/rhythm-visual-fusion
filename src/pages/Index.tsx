
import React, { useState } from 'react';
import Header from '@/components/Header';
import VideoPreview from '@/components/VideoPreview';
import ControlPanel from '@/components/ControlPanel';
import { AudioFeatures } from '@/lib/audioProcessor';

const Index = () => {
  const [audioFeatures, setAudioFeatures] = useState<AudioFeatures>({
    kick: 0,
    snare: 0,
    hihat: 0,
    bass: 0,
    mids: 0,
    treble: 0,
    energy: 0,
    rhythm: 0
  });

  const handleFeaturesUpdate = (features: AudioFeatures) => {
    setAudioFeatures(features);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container py-6 flex flex-col lg:flex-row gap-6">
        <div className="lg:w-2/3 w-full h-[50vh] lg:h-auto">
          <VideoPreview audioFeatures={audioFeatures} />
        </div>
        
        <div className="lg:w-1/3 w-full">
          <ControlPanel onFeaturesUpdate={handleFeaturesUpdate} />
        </div>
      </main>
      
      <footer className="py-4 border-t border-muted">
        <div className="container text-center text-sm text-muted-foreground">
          <p>Audio-Visual Synchronizer • Created with advanced web technologies</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
