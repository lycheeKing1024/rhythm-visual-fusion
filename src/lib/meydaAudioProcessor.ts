
import * as Essentia from 'essentia.js';

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
  private audioDataBuffer: Float32Array = new Float32Array(0);
  private frameSize: number = 2048;
  private hopSize: number = 1024;
  
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
      // Initialize Essentia.js
      this.essentia = await Essentia.EssentiaWASM();
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
    
    // Create media source from audio element
    this.mediaSource = this.audioContext.createMediaElementSource(this.audioElement);
    this.mediaSource.connect(this.gainNode!);
    
    // Setup a ScriptProcessorNode for real-time analysis
    // Note: ScriptProcessorNode is deprecated but still widely used;
    // replace with AudioWorkletNode in production
    const scriptNode = this.audioContext.createScriptProcessor(this.frameSize, 1, 1);
    this.mediaSource.connect(scriptNode);
    scriptNode.connect(this.audioContext.destination);
    
    // Process audio in real-time
    scriptNode.onaudioprocess = (audioProcessingEvent) => {
      const inputBuffer = audioProcessingEvent.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);
      
      // Process audio data with Essentia
      this.processAudioData(inputData);
    };
  }
  
  private processAudioData(audioData: Float32Array) {
    if (!this.essentia) return;
    
    try {
      // Create a copy of the audio data to avoid modifications to the original buffer
      const audioDataCopy = new Float32Array(audioData);
      
      // Extract spectrum using Essentia
      const frame = this.essentia.arrayToVector(audioDataCopy);
      const spectrum = this.essentia.Spectrum(frame, this.frameSize, this.frameSize, false, 'hann');
      
      // Get magnitude spectrum for band energy calculations
      const magnitudeSpectrum = spectrum.magnitude;
      
      // Calculate band energy for each percussion element
      const kickBandEnergy = this.calculateBandEnergy(
        magnitudeSpectrum, 
        this.ranges.kick.min, 
        this.ranges.kick.max, 
        this.audioContext!.sampleRate, 
        this.frameSize
      );
      
      const snareLowBandEnergy = this.calculateBandEnergy(
        magnitudeSpectrum, 
        this.ranges.snare.min, 
        this.ranges.snare.max, 
        this.audioContext!.sampleRate, 
        this.frameSize
      );
      
      const snareHighBandEnergy = this.calculateBandEnergy(
        magnitudeSpectrum, 
        this.ranges.snareCrack.min, 
        this.ranges.snareCrack.max, 
        this.audioContext!.sampleRate, 
        this.frameSize
      );
      
      const hihatBandEnergy = this.calculateBandEnergy(
        magnitudeSpectrum, 
        this.ranges.hihat.min, 
        this.ranges.hihat.max, 
        this.audioContext!.sampleRate, 
        this.frameSize
      );
      
      // Advanced percussion detection algorithms
      
      // Using Exponential Moving Average for smoother transitions
      const alpha = 0.3; // Smoothing factor
      
      // Kick detection: strong low frequency content
      this.kickEnergy = alpha * kickBandEnergy + (1 - alpha) * this.kickEnergy;
      
      // Snare detection: combination of mid-low body and high crack
      const snareEnergy = snareLowBandEnergy * 0.3 + snareHighBandEnergy * 0.7;
      this.snareEnergy = alpha * snareEnergy + (1 - alpha) * this.snareEnergy;
      
      // Hi-hat detection: high frequency content
      this.hihatEnergy = alpha * hihatBandEnergy + (1 - alpha) * this.hihatEnergy;
      
      // Calculate spectral centroid for bass/mid/treble balance
      const spectralCentroid = this.essentia.SpectralCentroid(magnitudeSpectrum);
      
      // Calculate overall energy
      const rms = this.essentia.RMS(frame);
      
      // Update features with normalized values
      this.lastFeatures = {
        // Normalize values to 0-1 range
        kick: Math.min(1, this.kickEnergy * 5),
        snare: Math.min(1, this.snareEnergy * 5),
        hihat: Math.min(1, this.hihatEnergy * 5),
        bass: this.mapRange(spectralCentroid.spectralCentroid, 0, 500, 1, 0), // Bass is inverse of spectral centroid
        mids: this.calculateBandEnergy(magnitudeSpectrum, 250, 2000, this.audioContext!.sampleRate, this.frameSize) * 3,
        treble: this.calculateBandEnergy(magnitudeSpectrum, 2000, 16000, this.audioContext!.sampleRate, this.frameSize) * 3,
        energy: Math.min(1, rms.rms * 3),
        rhythm: (this.kickEnergy * 0.6 + this.snareEnergy * 0.4) * 5 // Rhythm is weighted kick+snare
      };
      
      // Free Essentia vectors to prevent memory leaks
      this.essentia.freeVector(frame);
      this.essentia.freeVector(magnitudeSpectrum);
      
    } catch (error) {
      console.error("Error processing audio data with Essentia:", error);
    }
  }
  
  private calculateBandEnergy(
    spectrum: Float32Array, 
    minFreq: number, 
    maxFreq: number, 
    sampleRate: number, 
    frameSize: number
  ): number {
    // Convert frequencies to bin indices
    const minBin = Math.floor(minFreq * frameSize / sampleRate);
    const maxBin = Math.ceil(maxFreq * frameSize / sampleRate);
    
    // Ensure bins are within valid range
    const validMinBin = Math.max(0, minBin);
    const validMaxBin = Math.min(spectrum.length - 1, maxBin);
    
    // Sum squared magnitude within the frequency range
    let energy = 0;
    for (let i = validMinBin; i <= validMaxBin; i++) {
      energy += spectrum[i] * spectrum[i];
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
const essentiaAudioProcessor = new EssentiaAudioProcessor();
export default essentiaAudioProcessor;
