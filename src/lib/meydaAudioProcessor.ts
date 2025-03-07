
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
      
      // Extract beat features using Essentia
      if (this.essentia.algorithmsByName && this.essentia.algorithmsByName.RhythmExtractor) {
        // Use Essentia's RhythmExtractor if available
        const audioVector = this.essentia.arrayToVector(audioData);
        const rhythmFeatures = this.essentia.RhythmExtractor(audioVector);
        
        // Extract beats information if available
        if (rhythmFeatures.beats) {
          // Process beat information
          console.log('Detected beats:', rhythmFeatures.beats.size());
        }
      } else {
        // Fallback to manual frequency band analysis
        this.analyzeFrequencyBands(frequencyData);
      }
    } catch (error) {
      // Fallback to manual frequency band analysis on error
      console.warn("Essentia algorithm error, falling back to manual analysis:", error);
      if (this.analyser) {
        const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(frequencyData);
        this.analyzeFrequencyBands(frequencyData);
      }
    }
  }
  
  private analyzeFrequencyBands(frequencyData: Uint8Array) {
    if (!this.audioContext || !this.analyser) return;
    
    const sampleRate = this.audioContext.sampleRate;
    const binCount = this.analyser.frequencyBinCount;
    
    // Calculate frequency band energy
    const kickBandEnergy = this.calculateBandEnergy(
      frequencyData,
      this.ranges.kick.min, 
      this.ranges.kick.max, 
      sampleRate,
      binCount
    );
    
    const snareLowBandEnergy = this.calculateBandEnergy(
      frequencyData,
      this.ranges.snare.min, 
      this.ranges.snare.max,
      sampleRate,
      binCount
    );
    
    const snareHighBandEnergy = this.calculateBandEnergy(
      frequencyData,
      this.ranges.snareCrack.min, 
      this.ranges.snareCrack.max,
      sampleRate,
      binCount
    );
    
    const hihatBandEnergy = this.calculateBandEnergy(
      frequencyData,
      this.ranges.hihat.min, 
      this.ranges.hihat.max,
      sampleRate,
      binCount
    );
    
    // Use Exponential Moving Average for smoother transitions
    const alpha = 0.3; // Smoothing factor
    
    // Kick detection with threshold
    const kickThreshold = 0.15;
    this.kickEnergy = alpha * (kickBandEnergy > kickThreshold ? kickBandEnergy : 0) + (1 - alpha) * this.kickEnergy;
    
    // Snare detection: combination of mid-low body and high crack
    const snareEnergy = snareLowBandEnergy * 0.3 + snareHighBandEnergy * 0.7;
    const snareThreshold = 0.12;
    this.snareEnergy = alpha * (snareEnergy > snareThreshold ? snareEnergy : 0) + (1 - alpha) * this.snareEnergy;
    
    // Hi-hat detection
    const hihatThreshold = 0.10;
    this.hihatEnergy = alpha * (hihatBandEnergy > hihatThreshold ? hihatBandEnergy : 0) + (1 - alpha) * this.hihatEnergy;
    
    // Calculate overall energy
    let totalEnergy = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      totalEnergy += frequencyData[i] / 255;
    }
    totalEnergy /= frequencyData.length;
    
    // Bass, mids, treble energy
    const bassEnergy = this.calculateBandEnergy(frequencyData, 60, 250, sampleRate, binCount);
    const midsEnergy = this.calculateBandEnergy(frequencyData, 250, 2000, sampleRate, binCount);
    const trebleEnergy = this.calculateBandEnergy(frequencyData, 2000, 16000, sampleRate, binCount);
    
    // Update features with normalized values
    this.lastFeatures = {
      kick: Math.min(1, this.kickEnergy * 5),
      snare: Math.min(1, this.snareEnergy * 5),
      hihat: Math.min(1, this.hihatEnergy * 5),
      bass: Math.min(1, bassEnergy * 3),
      mids: Math.min(1, midsEnergy * 3),
      treble: Math.min(1, trebleEnergy * 3),
      energy: Math.min(1, totalEnergy * 3),
      rhythm: Math.min(1, (this.kickEnergy * 0.6 + this.snareEnergy * 0.4) * 5) // Rhythm is weighted kick+snare
    };
    
    // Log feature values for debugging
    if (Math.random() < 0.01) { // Log only 1% of the time to avoid console spam
      console.log('Audio features:', { 
        kick: this.lastFeatures.kick.toFixed(2),
        snare: this.lastFeatures.snare.toFixed(2),
        hihat: this.lastFeatures.hihat.toFixed(2)
      });
    }
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
