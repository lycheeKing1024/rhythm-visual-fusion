
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Upload, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import audioProcessor, { AudioFeatures } from '@/lib/audioProcessor';

interface AudioAnalyzerProps {
  onFeaturesUpdate: (features: AudioFeatures) => void;
}

const AudioAnalyzer: React.FC<AudioAnalyzerProps> = ({ onFeaturesUpdate }) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const animationRef = useRef<number | null>(null);
  const [features, setFeatures] = useState<AudioFeatures>({
    kick: 0, snare: 0, hihat: 0, bass: 0, mids: 0, treble: 0, energy: 0, rhythm: 0
  });

  // Format time in mm:ss
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setAudioFile(file);
      const success = await audioProcessor.loadAudio(file);
      if (success) {
        setDuration(audioProcessor.getDuration());
      }
    }
  };

  // Handle playback controls
  const togglePlayback = () => {
    if (isPlaying) {
      audioProcessor.pause();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      setIsPlaying(false);
    } else {
      audioProcessor.play();
      setIsPlaying(true);
      updatePlayback();
    }
  };

  // Update volume
  useEffect(() => {
    audioProcessor.setVolume(volume);
  }, [volume]);

  // Update playback time and visualizer
  const updatePlayback = () => {
    const playbackState = audioProcessor.getPlaybackState();
    setCurrentTime(playbackState.currentTime);
    
    // Get audio features and update state
    const audioFeatures = audioProcessor.getAudioFeatures();
    setFeatures(audioFeatures);
    onFeaturesUpdate(audioFeatures);
    
    // Continue animation loop if still playing
    if (playbackState.isPlaying) {
      animationRef.current = requestAnimationFrame(updatePlayback);
    } else {
      setIsPlaying(false);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      audioProcessor.stop();
    };
  }, []);

  return (
    <div className="glass-panel rounded-lg p-4 w-full">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Audio Analysis</h3>
          <label className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
            <Upload size={18} />
            <span className="text-sm">Upload Audio</span>
            <input 
              type="file" 
              accept="audio/*" 
              className="hidden" 
              onChange={handleFileUpload}
            />
          </label>
        </div>
        
        {audioFile ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate max-w-[200px]">{audioFile.name}</span>
              <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>
            
            <div className="flex flex-col gap-4">
              <Slider 
                value={[currentTime]} 
                max={duration} 
                step={0.01}
                onValueChange={(value) => {
                  // TODO: Implement seek functionality
                }}
                className="w-full"
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={togglePlayback} 
                    size="icon" 
                    variant="outline" 
                    className="h-9 w-9 rounded-full"
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </Button>
                  
                  <div className="flex items-center gap-2 ml-2">
                    <Volume2 size={16} className="text-muted-foreground" />
                    <Slider 
                      value={[volume * 100]} 
                      max={100} 
                      step={1}
                      onValueChange={(value) => setVolume(value[0] / 100)}
                      className="w-24"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neon-blue animate-pulse" />
                  <span className="text-xs text-muted-foreground">Analyzing</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2 mt-2">
              {Object.entries(features).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <div className="text-xs text-muted-foreground capitalize">{key}</div>
                  <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-100"
                      style={{ width: `${value * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="bg-muted/30 border border-dashed border-muted rounded-md p-6 flex flex-col items-center justify-center text-center animate-pulse">
            <Upload size={24} className="text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No audio file selected</p>
            <p className="text-xs text-muted-foreground mt-1">Upload an audio file to begin analysis</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioAnalyzer;
