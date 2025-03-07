import Essentia from 'essentia.js';
import { AudioFeatures } from './audioProcessor';

class EssentiaAudioProcessor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private essentia: any | null = null;
  private isPlaying: boolean = false;
  private audioSource: AudioBufferSourceNode | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private audioElement: HTMLAudioElement | null = null;
  private frameSize: number = 2048;
  private hopSize: number = 1024;
  private scriptProcessor: ScriptProcessorNode | null = null;
  
  // Feature extraction configuration
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
  
  // Percussion detection accumulators
  private kickEnergy: number = 0;
  private snareEnergy: number = 0;
  private hihatEnergy: number = 0;
  
  // Frequency ranges for different percussion elements
  private ranges = {
    kick: { min: 40, max: 120 },    // Low frequencies for kick drum
    snare: { min: 120, max: 250 },  // Mid-low frequencies for snare's body
    snareCrack: { min: 2000, max: 5000 }, // High frequencies for snare's crack/snap
    hihat: { min: 8000, max: 16000 }  // High frequencies for hi-hats
  };
  
  constructor() {
    this.initAudioContext();
    this.initEssentia();
  }

  private async initEssentia() {
    try {
      // Initialize Essentia.js - correctly using the imported library
      this.essentia = await new Essentia();
      console.log('Essentia.js initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Essentia.js:', error);
    }
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.gainNode = this.audioContext.createGain();
      
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      
      // Set up analyzer for more detailed frequency data
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.3;
      
      console.log('Essentia Audio Processor initialized');
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
      
      // Also decode the audio data for buffer-based processing
      const arrayBuffer = await file.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Set up audio processing
      this.setupAudioProcessing();
      
      return true;
    } catch (error) {
      console.error("Error loading audio file:", error);
      return false;
    }
  }
  
  private setupAudioProcessing() {
    if (!this.audioContext || !this.audioElement) return;
    
    // Clean up previous media source
    if (this.mediaSource) {
      this.mediaSource.disconnect();
    }
    
    // Clean up previous script processor
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
    }
    
    // Create media source from audio element
    this.mediaSource = this.audioContext.createMediaElementSource(this.audioElement);
    this.mediaSource.connect(this.gainNode!);
    
    // Setup a ScriptProcessorNode for real-time analysis
    this.scriptProcessor = this.audioContext.createScriptProcessor(this.frameSize, 1, 1);
    this.mediaSource.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
    
    // Process audio in real-time
    this.scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
      const inputBuffer = audioProcessingEvent.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);
      
      // Process audio data with Essentia
      this.processAudioData(inputData);
    };
  }

  private processAudioData(audioData: Float32Array) {
    if (!this.essentia || !this.analyser) return;
    
    try {
      // Get frequency data from analyzer
      const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(frequencyData);
      
      // Analyze frequency bands with higher sensitivity and better thresholds
      this.analyzeFrequencyBands(frequencyData);
      
      // Log feature detection for debugging
      if (Math.random() < 0.01) { // Log only occasionally
        console.log('Essentia Features:', {
          kick: this.lastFeatures.kick.toFixed(2),
          snare: this.lastFeatures.snare.toFixed(2),
          hihat: this.lastFeatures.hihat.toFixed(2)
        });
      }
    } catch (error) {
      console.warn("Essentia processing error:", error);
    }
  }

  private analyzeFrequencyBands(frequencyData: Uint8Array) {
    if (!this.audioContext || !this.analyser) return;
    
    const sampleRate = this.audioContext.sampleRate;
    const binCount = this.analyser.frequencyBinCount;
    
    // Enhanced frequency ranges for better detection
    const ranges = {
      kick: { min: 40, max: 100 },      // Focused kick range
      snare: { min: 200, max: 500 },    // Better snare detection
      hihat: { min: 8000, max: 12000 }, // Focused hi-hat range
      bass: { min: 60, max: 250 },
      mids: { min: 250, max: 2000 },
      treble: { min: 2000, max: 16000 }
    };
    
    // Calculate band energies with improved sensitivity
    const kickEnergy = this.calculateBandEnergy(frequencyData, ranges.kick.min, ranges.kick.max, sampleRate, binCount);
    const snareEnergy = this.calculateBandEnergy(frequencyData, ranges.snare.min, ranges.snare.max, sampleRate, binCount);
    const hihatEnergy = this.calculateBandEnergy(frequencyData, ranges.hihat.min, ranges.hihat.max, sampleRate, binCount);
    const bassEnergy = this.calculateBandEnergy(frequencyData, ranges.bass.min, ranges.bass.max, sampleRate, binCount);
    const midsEnergy = this.calculateBandEnergy(frequencyData, ranges.mids.min, ranges.mids.max, sampleRate, binCount);
    const trebleEnergy = this.calculateBandEnergy(frequencyData, ranges.treble.min, ranges.treble.max, sampleRate, binCount);
    
    // Improved thresholds and sensitivity
    const thresholds = {
      kick: 0.1,   // More sensitive kick detection
      snare: 0.15, // Adjusted snare threshold
      hihat: 0.12  // More sensitive hi-hat detection
    };
    
    // Enhanced smoothing for more stable values
    const alpha = 0.4; // Faster response time
    
    // Update energies with improved thresholding and smoothing
    this.kickEnergy = alpha * (kickEnergy > thresholds.kick ? kickEnergy * 2 : 0) + (1 - alpha) * this.kickEnergy;
    this.snareEnergy = alpha * (snareEnergy > thresholds.snare ? snareEnergy * 2 : 0) + (1 - alpha) * this.snareEnergy;
    this.hihatEnergy = alpha * (hihatEnergy > thresholds.hihat ? hihatEnergy * 2 : 0) + (1 - alpha) * this.hihatEnergy;
    
    // Calculate overall energy
    let totalEnergy = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      totalEnergy += frequencyData[i] / 255;
    }
    totalEnergy /= frequencyData.length;
    
    // Update features with enhanced normalization
    this.lastFeatures = {
      kick: Math.min(1, this.kickEnergy * 4),    // Increased sensitivity
      snare: Math.min(1, this.snareEnergy * 4),  // Increased sensitivity
      hihat: Math.min(1, this.hihatEnergy * 4),  // Increased sensitivity
      bass: Math.min(1, bassEnergy * 3),
      mids: Math.min(1, midsEnergy * 3),
      treble: Math.min(1, trebleEnergy * 3),
      energy: Math.min(1, totalEnergy * 3),
      rhythm: Math.min(1, (this.kickEnergy + this.snareEnergy) * 3) // Better rhythm detection
    };
  }
  
  private calculateBandEnergy(
    frequencyData: Uint8Array, 
    minFreq: number, 
    maxFreq: number, 
    sampleRate: number,
    binCount: number
  ): number {
    // Convert frequencies to bin indices
    const nyquist = sampleRate / 2;
    const minBin = Math.floor((minFreq / nyquist) * binCount);
    const maxBin = Math.ceil((maxFreq / nyquist) * binCount);
    
    // Ensure bins are within valid range
    const validMinBin = Math.max(0, minBin);
    const validMaxBin = Math.min(binCount - 1, maxBin);
    
    if (validMaxBin <= validMinBin) return 0;
    
    // Sum energy within the frequency range
    let energy = 0;
    for (let i = validMinBin; i <= validMaxBin; i++) {
      energy += frequencyData[i] / 255; // Normalize to 0-1
    }
    
    // Normalize by the number of bins
    return energy / (validMaxBin - validMinBin + 1);
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
    
    this.isPlaying = false;
  }

  public stop() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    
    this.isPlaying = false;
    this.pauseTime = 0;
  }

  public seekTo(time: number) {
    if (!this.audioElement) return;
    
    this.audioElement.currentTime = time;
    this.pauseTime = time;
    
    if (this.isPlaying) {
      this.startTime = this.audioContext!.currentTime - time;
    }
  }

  public setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    }
    
    if (this.audioElement) {
      this.audioElement.volume = volume;
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
const essentiaAudioProcessor = new EssentiaAudioProcessor();
export default essentiaAudioProcessor;
