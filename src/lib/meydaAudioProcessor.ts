
import * as Meyda from 'meyda';
import { AudioFeatures } from './audioProcessor';

class MeydaAudioProcessor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private meydaAnalyzer: any | null = null;
  private isPlaying: boolean = false;
  private audioSource: AudioBufferSourceNode | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private audioElement: HTMLAudioElement | null = null;
  
  // Feature extraction configuration
  private features: string[] = [
    'rms',
    'energy',
    'spectralCentroid',
    'spectralFlatness',
    'spectralSlope',
    'spectralRolloff',
    'loudness',
    'perceptualSpread',
    'spectralKurtosis',
    'zcr'
  ];
  
  private lastFeatures: AudioFeatures = {
    kick: 0,
    snare: 0,
    hihat: 0,
    bass: 0,
    mids: 0,
    treble: 0,
    energy: 0,
    rhythm: 0
  };
  
  // Percussion detector thresholds
  private thresholds = {
    kickEnergy: 0.7,
    kickSpecCentroid: 200,
    snareZcr: 0.3,
    snareSpecFlatness: 0.2,
    hihatSpecRolloff: 0.7
  };
  
  // Detection memory (to smooth out detection)
  private memory = {
    kickCount: 0,
    snareCount: 0,
    hihatCount: 0
  };
  
  constructor() {
    this.initAudioContext();
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.gainNode = this.audioContext.createGain();
      
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      
      console.log('Meyda Audio Processor initialized');
    } catch (error) {
      console.error("AudioContext not supported or error initializing", error);
    }
  }
  
  public async loadAudio(file: File): Promise<boolean> {
    if (!this.audioContext) {
      this.initAudioContext();
      if (!this.audioContext) return false;
    }
    
    try {
      // Create URL for the file
      const audioUrl = URL.createObjectURL(file);
      
      // Clean up previous audio element if it exists
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.src = '';
      }
      
      // Create audio element
      this.audioElement = new Audio();
      this.audioElement.src = audioUrl;
      this.audioElement.crossOrigin = 'anonymous';
      
      // Wait for the audio to be loaded
      await new Promise<void>((resolve) => {
        if (!this.audioElement) {
          resolve();
          return;
        }
        
        this.audioElement.onloadedmetadata = () => resolve();
        this.audioElement.onerror = () => resolve();
      });
      
      // Also decode the audio data for potential buffer-based processing
      const arrayBuffer = await file.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Set up Meyda analyzer
      this.setupMeydaAnalyzer();
      
      return true;
    } catch (error) {
      console.error("Error loading audio file:", error);
      return false;
    }
  }
  
  private setupMeydaAnalyzer() {
    if (!this.audioContext || !this.audioElement) return;
    
    // Clean up previous media source
    if (this.mediaSource) {
      this.mediaSource.disconnect();
    }
    
    // Create media source from audio element
    this.mediaSource = this.audioContext.createMediaElementSource(this.audioElement);
    this.mediaSource.connect(this.gainNode!);
    
    // Create Meyda analyzer
    this.meydaAnalyzer = Meyda.default.createMeydaAnalyzer({
      audioContext: this.audioContext,
      source: this.mediaSource,
      bufferSize: 512,
      featureExtractors: this.features,
      callback: (features) => this.processFeatures(features)
    });
  }
  
  private processFeatures(features: Partial<Meyda.MeydaFeaturesObject>) {
    if (!features) return;
    
    // Extract relevant features for percussion detection
    const rms = features.rms || 0;
    const energy = features.energy || 0;
    const spectralCentroid = features.spectralCentroid || 0;
    const spectralFlatness = features.spectralFlatness || 0;
    const spectralRolloff = features.spectralRolloff || 0;
    const zcr = features.zcr || 0;
    const loudness = features.loudness ? (features.loudness as any).total || 0 : 0;
    
    // Advanced percussion detection algorithms
    
    // Kick detection: low spectral centroid + high energy
    const isKick = 
      spectralCentroid < this.thresholds.kickSpecCentroid && 
      energy > this.thresholds.kickEnergy;
    
    // Snare detection: high zero crossing rate + specific spectral flatness
    const isSnare = 
      zcr > this.thresholds.snareZcr && 
      spectralFlatness > this.thresholds.snareSpecFlatness;
    
    // Hi-hat detection: high spectral rolloff
    const isHihat = spectralRolloff > this.thresholds.hihatSpecRolloff;
    
    // Apply memory/temporal smoothing for detection stability
    if (isKick) this.memory.kickCount = Math.min(8, this.memory.kickCount + 3);
    else this.memory.kickCount = Math.max(0, this.memory.kickCount - 1);
    
    if (isSnare) this.memory.snareCount = Math.min(8, this.memory.snareCount + 3);
    else this.memory.snareCount = Math.max(0, this.memory.snareCount - 1);
    
    if (isHihat) this.memory.hihatCount = Math.min(8, this.memory.hihatCount + 3);
    else this.memory.hihatCount = Math.max(0, this.memory.hihatCount - 1);
    
    // Update features with normalized values
    this.lastFeatures = {
      kick: this.memory.kickCount / 8,
      snare: this.memory.snareCount / 8,
      hihat: this.memory.hihatCount / 8,
      bass: this.mapRange(spectralCentroid, 0, 500, 1, 0), // Bass is inverse of spectral centroid
      mids: this.mapRange(spectralCentroid, 200, 2000, 0, 1),
      treble: this.mapRange(spectralCentroid, 2000, 8000, 0, 1),
      energy: this.mapRange(loudness || energy, 0, 10, 0, 1),
      rhythm: (this.memory.kickCount / 8) * 0.6 + (this.memory.snareCount / 8) * 0.4 // Rhythm is weighted kick+snare
    };
  }
  
  // Map a value from one range to another (with clamping)
  private mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    const mapped = ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    return Math.max(outMin, Math.min(outMax, mapped)); // Clamp to output range
  }

  public play() {
    if (!this.audioContext || !this.audioElement) return;
    
    // Resume audio context if it's suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Start Meyda analyzer
    if (this.meydaAnalyzer) {
      this.meydaAnalyzer.start();
    }
    
    // Play from the current position
    const offset = this.pauseTime > 0 ? this.pauseTime : 0;
    this.audioElement.currentTime = offset;
    this.audioElement.play();
    
    this.startTime = this.audioContext.currentTime - offset;
    this.isPlaying = true;
  }

  public pause() {
    if (!this.isPlaying || !this.audioContext || !this.audioElement) return;
    
    this.pauseTime = this.audioElement.currentTime;
    this.audioElement.pause();
    
    // Stop Meyda analyzer to save resources
    if (this.meydaAnalyzer) {
      this.meydaAnalyzer.stop();
    }
    
    this.isPlaying = false;
  }

  public stop() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    
    if (this.meydaAnalyzer) {
      this.meydaAnalyzer.stop();
    }
    
    this.isPlaying = false;
    this.pauseTime = 0;
  }

  public setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    }
    
    if (this.audioElement) {
      this.audioElement.volume = volume;
    }
  }
  
  public seekTo(time: number) {
    if (!this.audioElement) return;
    
    this.audioElement.currentTime = time;
    this.pauseTime = time;
    
    if (this.isPlaying) {
      this.startTime = this.audioContext!.currentTime - time;
    }
  }

  public getCurrentTime(): number {
    if (!this.audioElement) return this.pauseTime;
    return this.audioElement.currentTime;
  }

  public getDuration(): number {
    if (!this.audioElement) return 0;
    return this.audioElement.duration || 0;
  }

  public getPlaybackState(): { isPlaying: boolean, currentTime: number, duration: number } {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.getCurrentTime(),
      duration: this.getDuration()
    };
  }

  public getAudioFeatures(): AudioFeatures {
    return this.lastFeatures;
  }
}

// Singleton instance
const meydaAudioProcessor = new MeydaAudioProcessor();
export default meydaAudioProcessor;
