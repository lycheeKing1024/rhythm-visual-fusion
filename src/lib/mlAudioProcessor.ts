
import { pipeline, RawImage } from "@huggingface/transformers";
import { AudioFeatures } from "./audioProcessor";

// Interface for the ML model output
interface BeatDetectionResult {
  kick: number;
  snare: number;
  hihat: number;
  bass: number;
  energy: number;
}

class MLAudioProcessor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying: boolean = false;
  private audioSource: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;
  
  private mlModel: any = null;
  private isModelLoaded: boolean = false;
  private isLoadingModel: boolean = false;
  private spectrogramData: Float32Array = new Float32Array();
  private fftSize: number = 2048;
  private modelInitPromise: Promise<boolean> | null = null;
  
  constructor() {
    this.initAudioContext();
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.gainNode = this.audioContext.createGain();
      
      this.spectrogramData = new Float32Array(this.analyser.frequencyBinCount);
      
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    } catch (error) {
      console.error("AudioContext not supported or error initializing", error);
    }
  }
  
  public async initModel(): Promise<boolean> {
    if (this.isModelLoaded) return true;
    if (this.isLoadingModel) return this.modelInitPromise as Promise<boolean>;
    
    this.isLoadingModel = true;
    
    this.modelInitPromise = new Promise(async (resolve) => {
      try {
        console.log("Loading ML audio analysis model with WebGPU...");
        
        // Load a specialized audio classification model from Hugging Face
        // Using a small model optimized for real-time audio processing
        this.mlModel = await pipeline(
          "audio-classification",
          "MIT/ast-finetuned-audioset-10-10-0.4593", 
          { device: "webgpu" }
        );
        
        this.isModelLoaded = true;
        this.isLoadingModel = false;
        console.log("ML audio analysis model loaded successfully");
        resolve(true);
      } catch (error) {
        console.error("Failed to load ML audio model:", error);
        this.isLoadingModel = false;
        resolve(false);
      }
    });
    
    return this.modelInitPromise;
  }

  public async loadAudio(file: File): Promise<boolean> {
    if (!this.audioContext) {
      this.initAudioContext();
      if (!this.audioContext) return false;
    }
    
    try {
      // Initialize ML model in parallel with audio loading
      this.initModel();
      
      const arrayBuffer = await file.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      return true;
    } catch (error) {
      console.error("Error loading audio file:", error);
      return false;
    }
  }

  public play() {
    if (!this.audioContext || !this.audioBuffer || !this.gainNode || !this.analyser) return;
    
    // Stop previous playback if any
    this.stop();
    
    this.audioSource = this.audioContext.createBufferSource();
    this.audioSource.buffer = this.audioBuffer;
    this.audioSource.connect(this.gainNode);
    
    // Resume audio context if it's suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    const offset = this.pauseTime > 0 ? this.pauseTime : 0;
    this.audioSource.start(0, offset);
    this.startTime = this.audioContext.currentTime - offset;
    this.isPlaying = true;
  }

  public pause() {
    if (!this.isPlaying || !this.audioContext) return;
    
    this.pauseTime = this.audioContext.currentTime - this.startTime;
    this.stop();
  }

  public stop() {
    if (this.audioSource) {
      try {
        this.audioSource.stop();
      } catch (e) {
        // Source might already be stopped
      }
      this.audioSource.disconnect();
      this.audioSource = null;
    }
    this.isPlaying = false;
  }

  public setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    }
  }

  public getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying) return this.pauseTime;
    return this.audioContext.currentTime - this.startTime;
  }

  public getDuration(): number {
    return this.audioBuffer ? this.audioBuffer.duration : 0;
  }

  public getPlaybackState(): { isPlaying: boolean, currentTime: number, duration: number } {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.getCurrentTime(),
      duration: this.getDuration()
    };
  }

  public async getAudioFeatures(): Promise<AudioFeatures> {
    // Default values in case analysis fails
    const defaultFeatures: AudioFeatures = {
      kick: 0, snare: 0, hihat: 0, bass: 0, mids: 0, treble: 0, energy: 0, rhythm: 0
    };
    
    if (!this.analyser || !this.isPlaying) {
      return defaultFeatures;
    }
    
    // Get the frequency data from the analyzer
    const frequencyData = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(frequencyData);
    
    // If our model isn't loaded yet, just do a basic analysis
    if (!this.isModelLoaded) {
      return this.performBasicAnalysis(frequencyData);
    }
    
    try {
      // Normalize frequency data for the ML model input
      // Convert to format expected by the ML model
      const audioData = this.prepareAudioDataForModel(frequencyData);
      
      // Run prediction on our model
      const result = await this.mlModel(audioData, { topk: 10 });
      
      return this.processMLModelResults(result, frequencyData);
    } catch (error) {
      console.error("Error in ML audio analysis:", error);
      return this.performBasicAnalysis(frequencyData);
    }
  }
  
  private prepareAudioDataForModel(frequencyData: Float32Array): any {
    // Normalize the frequency data for the model
    // This is a simplified version - real implementation would depend on the model's expected format
    
    // For this example, we'll just create a small spectrogram-like representation
    const normalizedData = Array.from(frequencyData).map(val => {
      // Convert from dB to range 0-1
      return Math.min(1, Math.max(0, (val + 100) / 100));
    });
    
    // Return as dummy audio waveform (simplified for this example)
    // In a real implementation, you would format this properly for your specific model
    return {
      data: normalizedData,
      sampling_rate: this.audioContext?.sampleRate || 44100,
    };
  }
  
  private processMLModelResults(results: any, frequencyData: Float32Array): AudioFeatures {
    // Extract relevant information from ML model results
    // This is a simplified example - real implementation would map the model's outputs
    // to the features we need
    
    // Create result object
    const features: AudioFeatures = {
      kick: 0,
      snare: 0,
      hihat: 0,
      bass: 0,
      mids: 0,
      treble: 0,
      energy: 0,
      rhythm: 0
    };
    
    // Process model results to extract features
    // Here we're looking for labels that match our features
    for (const prediction of results) {
      const { label, score } = prediction;
      
      // Map model outputs to our features
      if (label.includes("drum") || label.includes("bass drum") || label.includes("kick")) {
        features.kick = Math.max(features.kick, score);
      }
      if (label.includes("snare") || label.includes("clap")) {
        features.snare = Math.max(features.snare, score);
      }
      if (label.includes("hi-hat") || label.includes("hihat") || label.includes("cymbal")) {
        features.hihat = Math.max(features.hihat, score);
      }
      if (label.includes("bass") && !label.includes("drum")) {
        features.bass = Math.max(features.bass, score);
      }
      
      // General energy detection
      if (label.includes("music") || label.includes("loud")) {
        features.energy = Math.max(features.energy, score);
      }
    }
    
    // Fallback to traditional analysis for features not detected by the model
    const traditionalFeatures = this.performBasicAnalysis(frequencyData);
    
    // Use ML results when confident, otherwise fall back to basic analysis
    features.kick = features.kick > 0.3 ? features.kick : traditionalFeatures.kick;
    features.snare = features.snare > 0.3 ? features.snare : traditionalFeatures.snare;
    features.hihat = features.hihat > 0.3 ? features.hihat : traditionalFeatures.hihat;
    features.bass = features.bass > 0.3 ? features.bass : traditionalFeatures.bass;
    
    // Use basic analysis for these features
    features.mids = traditionalFeatures.mids;
    features.treble = traditionalFeatures.treble;
    features.energy = features.energy > 0.3 ? features.energy : traditionalFeatures.energy;
    
    // Calculate rhythm based on kick and snare
    features.rhythm = this.calculateRhythm(features.kick, features.snare);
    
    return features;
  }
  
  private performBasicAnalysis(frequencyData: Float32Array): AudioFeatures {
    // Frequency bands (Hz) - these ranges are more precise for music analysis
    const bands = {
      kick: { min: 40, max: 120 },
      snare: { min: 120, max: 250 },
      hihat: { min: 8000, max: 16000 },
      bass: { min: 60, max: 250 },
      mids: { min: 250, max: 2000 },
      treble: { min: 2000, max: 16000 }
    };
    
    // Calculate frequency bins based on audio context's sample rate
    const nyquist = this.audioContext?.sampleRate ? this.audioContext.sampleRate / 2 : 22050;
    const binCount = frequencyData.length;
    
    // Extract features for each band
    const features: AudioFeatures = {
      kick: this.getAverageForBand(frequencyData, bands.kick.min, bands.kick.max, nyquist, binCount),
      snare: this.getAverageForBand(frequencyData, bands.snare.min, bands.snare.max, nyquist, binCount),
      hihat: this.getAverageForBand(frequencyData, bands.hihat.min, bands.hihat.max, nyquist, binCount),
      bass: this.getAverageForBand(frequencyData, bands.bass.min, bands.bass.max, nyquist, binCount),
      mids: this.getAverageForBand(frequencyData, bands.mids.min, bands.mids.max, nyquist, binCount),
      treble: this.getAverageForBand(frequencyData, bands.treble.min, bands.treble.max, nyquist, binCount),
      energy: 0,
      rhythm: 0
    };
    
    // Calculate overall energy
    features.energy = this.calculateEnergy(frequencyData);
    
    // Calculate rhythm based on kick and snare
    features.rhythm = this.calculateRhythm(features.kick, features.snare);
    
    return features;
  }
  
  private getAverageForBand(
    frequencyData: Float32Array, 
    minFreq: number, 
    maxFreq: number, 
    nyquist: number, 
    binCount: number
  ): number {
    const lowBin = Math.floor((minFreq / nyquist) * binCount);
    const highBin = Math.floor((maxFreq / nyquist) * binCount);
    
    let sum = 0;
    const binRange = highBin - lowBin;
    
    if (binRange <= 0) return 0;
    
    for (let i = lowBin; i <= highBin; i++) {
      // Convert from dB to normalized amplitude (0-1)
      const amplitude = (frequencyData[i] + 100) / 100; // +100 to shift from negative dB to positive, /100 to normalize
      sum += Math.max(0, Math.min(1, amplitude)); // Clamp between 0-1
    }
    
    return sum / binRange;
  }
  
  private calculateEnergy(frequencyData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      // Convert from dB to normalized amplitude (0-1)
      const amplitude = (frequencyData[i] + 100) / 100;
      sum += Math.max(0, Math.min(1, amplitude)); // Clamp between 0-1
    }
    
    return sum / frequencyData.length;
  }
  
  private calculateRhythm(kick: number, snare: number): number {
    // Weight kick more than snare for rhythm detection with enhanced sensitivity
    return Math.pow(kick, 1.5) * 0.7 + Math.pow(snare, 1.5) * 0.3;
  }
}

// Create singleton instance
const mlAudioProcessor = new MLAudioProcessor();
export default mlAudioProcessor;
