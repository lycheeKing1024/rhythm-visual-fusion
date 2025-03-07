
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Upload, Volume2, Cpu, Music, Waveform } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import audioProcessor, { AudioFeatures } from '@/lib/audioProcessor';
import mlAudioProcessor from '@/lib/mlAudioProcessor';
import meydaAudioProcessor from '@/lib/meydaAudioProcessor';

interface AudioAnalyzerProps {
  onFeaturesUpdate: (features: AudioFeatures) => void;
}

const AudioAnalyzer: React.FC<AudioAnalyzerProps> = ({ onFeaturesUpdate }) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [processorType, setProcessorType] = useState<'basic' | 'ml' | 'meyda'>('meyda');
  const [isMLLoaded, setIsMLLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const animationRef = useRef<number | null>(null);
  const [features, setFeatures] = useState<AudioFeatures>({
    kick: 0, snare: 0, hihat: 0, bass: 0, mids: 0, treble: 0, energy: 0, rhythm: 0
  });

  // Initialize ML model if needed
  useEffect(() => {
    const loadMLModel = async () => {
      if (processorType === 'ml' && !isMLLoaded) {
        setIsLoading(true);
        const success = await mlAudioProcessor.initModel();
        setIsMLLoaded(success);
        setIsLoading(false);
      }
    };
    
    loadMLModel();
  }, [processorType, isMLLoaded]);

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
      setIsLoading(true);
      
      let success;
      switch (processorType) {
        case 'ml':
          success = await mlAudioProcessor.loadAudio(file);
          if (success) {
            setDuration(mlAudioProcessor.getDuration());
          }
          break;
        case 'meyda':
          success = await meydaAudioProcessor.loadAudio(file);
          if (success) {
            setDuration(meydaAudioProcessor.getDuration());
          }
          break;
        default: // basic
          success = await audioProcessor.loadAudio(file);
          if (success) {
            setDuration(audioProcessor.getDuration());
          }
      }
      
      setIsLoading(false);
    }
  };

  // Handle processor toggle
  const switchProcessor = async (newType: 'basic' | 'ml' | 'meyda') => {
    // Stop playback before switching processors
    if (isPlaying) {
      switch (processorType) {
        case 'ml': mlAudioProcessor.pause(); break;
        case 'meyda': meydaAudioProcessor.pause(); break;
        default: audioProcessor.pause();
      }
      setIsPlaying(false);
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
    
    setProcessorType(newType);
    
    // If we have an audio file, reload it with the new processor
    if (audioFile) {
      setIsLoading(true);
      let success;
      
      switch (newType) {
        case 'ml':
          success = await mlAudioProcessor.loadAudio(audioFile);
          if (success) {
            setDuration(mlAudioProcessor.getDuration());
          }
          break;
        case 'meyda':
          success = await meydaAudioProcessor.loadAudio(audioFile);
          if (success) {
            setDuration(meydaAudioProcessor.getDuration());
          }
          break;
        default: // basic
          success = await audioProcessor.loadAudio(audioFile);
          if (success) {
            setDuration(audioProcessor.getDuration());
          }
      }
      
      setIsLoading(false);
    }
  };

  // Handle playback controls
  const togglePlayback = () => {
    if (isPlaying) {
      switch (processorType) {
        case 'ml': mlAudioProcessor.pause(); break;
        case 'meyda': meydaAudioProcessor.pause(); break;
        default: audioProcessor.pause();
      }
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      setIsPlaying(false);
    } else {
      switch (processorType) {
        case 'ml': mlAudioProcessor.play(); break;
        case 'meyda': meydaAudioProcessor.play(); break;
        default: audioProcessor.play();
      }
      
      setIsPlaying(true);
      updatePlayback();
    }
  };

  // Handle seeking
  const handleSeek = (value: number[]) => {
    const seekTime = value[0];
    
    switch (processorType) {
      case 'ml':
        // ML processor doesn't support seeking yet
        break;
      case 'meyda':
        meydaAudioProcessor.seekTo(seekTime);
        setCurrentTime(seekTime);
        break;
      default:
        // Basic processor doesn't support seeking yet
        break;
    }
  };

  // Update volume
  useEffect(() => {
    switch (processorType) {
      case 'ml': mlAudioProcessor.setVolume(volume); break;
      case 'meyda': meydaAudioProcessor.setVolume(volume); break;
      default: audioProcessor.setVolume(volume);
    }
  }, [volume, processorType]);

  // Update playback time and visualizer
  const updatePlayback = async () => {
    let playbackState;
    let audioFeatures;
    
    switch (processorType) {
      case 'ml':
        playbackState = mlAudioProcessor.getPlaybackState();
        audioFeatures = await mlAudioProcessor.getAudioFeatures();
        break;
      case 'meyda':
        playbackState = meydaAudioProcessor.getPlaybackState();
        audioFeatures = meydaAudioProcessor.getAudioFeatures();
        break;
      default:
        playbackState = audioProcessor.getPlaybackState();
        audioFeatures = audioProcessor.getAudioFeatures();
    }
    
    setCurrentTime(playbackState.currentTime);
    
    // Update features and notify parent
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
      mlAudioProcessor.stop();
      meydaAudioProcessor.stop();
    };
  }, []);

  return (
    <div className="glass-panel rounded-lg p-4 w-full">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Audio Analysis</h3>
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant={processorType === 'basic' ? "default" : "outline"} 
                      size="sm"
                      onClick={() => switchProcessor('basic')}
                      disabled={isLoading}
                      className="px-2 py-1 h-auto"
                    >
                      <Waveform size={14} className="mr-1" />
                      <span className="text-xs">Basic</span>
                    </Button>
                    <Button 
                      variant={processorType === 'meyda' ? "default" : "outline"} 
                      size="sm"
                      onClick={() => switchProcessor('meyda')}
                      disabled={isLoading}
                      className="px-2 py-1 h-auto"
                    >
                      <Music size={14} className="mr-1" />
                      <span className="text-xs">Meyda</span>
                    </Button>
                    <Button 
                      variant={processorType === 'ml' ? "default" : "outline"} 
                      size="sm"
                      onClick={() => switchProcessor('ml')}
                      disabled={isLoading}
                      className="px-2 py-1 h-auto"
                    >
                      <Cpu size={14} className="mr-1" />
                      <span className="text-xs">ML</span>
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select audio analysis algorithm</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <label className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
              <Upload size={18} />
              <span className="text-sm">Upload Audio</span>
              <input 
                type="file" 
                accept="audio/*" 
                className="hidden" 
                onChange={handleFileUpload}
                disabled={isLoading}
              />
            </label>
          </div>
        </div>
        
        {isLoading && (
          <div className="flex items-center justify-center p-4">
            <div className="flex flex-col items-center">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {processorType === 'ml' ? "Loading ML model and audio..." : "Loading audio..."}
              </p>
            </div>
          </div>
        )}
        
        {!isLoading && audioFile ? (
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
                onValueChange={handleSeek}
                className="w-full"
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={togglePlayback} 
                    size="icon" 
                    variant="outline" 
                    className="h-9 w-9 rounded-full"
                    disabled={isLoading}
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
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs text-muted-foreground">
                    {processorType === 'ml' ? "ML Analyzing" : processorType === 'meyda' ? "Meyda Analyzing" : "Basic Analyzing"}
                  </span>
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
          !isLoading && (
            <div className="bg-muted/30 border border-dashed border-muted rounded-md p-6 flex flex-col items-center justify-center text-center animate-pulse">
              <Upload size={24} className="text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No audio file selected</p>
              <p className="text-xs text-muted-foreground mt-1">Upload an audio file to begin analysis</p>
              {processorType === 'ml' && <p className="text-xs text-primary mt-2">Using GPU-accelerated ML detection</p>}
              {processorType === 'meyda' && <p className="text-xs text-primary mt-2">Using professional Meyda audio analysis</p>}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default AudioAnalyzer;
