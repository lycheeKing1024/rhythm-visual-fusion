
export interface AudioFeatures {
  kick: number;
  snare: number;
  hihat: number;
  bass: number;
  mids: number;
  treble: number;
  energy: number;
  rhythm: number;
}

class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private audioSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseTime: number = 0;
  
  // FFT configuration
  private fftSize: number = 2048;
  private frequencyData: Uint8Array = new Uint8Array();
  private timeData: Uint8Array = new Uint8Array();
  
  // Frequency bands (Hz)
  private bands = {
    kick: { min: 40, max: 120 },
    snare: { min: 120, max: 250 },
    hihat: { min: 8000, max: 16000 },
    bass: { min: 60, max: 250 },
    mids: { min: 250, max: 2000 },
    treble: { min: 2000, max: 16000 }
  };

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.gainNode = this.audioContext.createGain();
      
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.frequencyBinCount);
      
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
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

  public getAudioFeatures(): AudioFeatures {
    if (!this.analyser) {
      return {
        kick: 0, snare: 0, hihat: 0, bass: 0, mids: 0, treble: 0, energy: 0, rhythm: 0
      };
    }
    
    // Get frequency data
    this.analyser.getByteFrequencyData(this.frequencyData);
    this.analyser.getByteTimeDomainData(this.timeData);
    
    // Extract features
    const features = {
      kick: this.getAverageForBand(this.bands.kick.min, this.bands.kick.max),
      snare: this.getAverageForBand(this.bands.snare.min, this.bands.snare.max),
      hihat: this.getAverageForBand(this.bands.hihat.min, this.bands.hihat.max),
      bass: this.getAverageForBand(this.bands.bass.min, this.bands.bass.max),
      mids: this.getAverageForBand(this.bands.mids.min, this.bands.mids.max),
      treble: this.getAverageForBand(this.bands.treble.min, this.bands.treble.max),
      energy: this.calculateEnergy(),
      rhythm: this.detectBeats()
    };
    
    return features;
  }

  private getAverageForBand(minFreq: number, maxFreq: number): number {
    if (!this.analyser || !this.frequencyData.length) return 0;
    
    const nyquist = this.audioContext!.sampleRate / 2;
    const lowBin = Math.floor((minFreq / nyquist) * this.analyser.frequencyBinCount);
    const highBin = Math.floor((maxFreq / nyquist) * this.analyser.frequencyBinCount);
    
    let sum = 0;
    const binCount = highBin - lowBin;
    
    if (binCount <= 0) return 0;
    
    for (let i = lowBin; i <= highBin; i++) {
      sum += this.frequencyData[i];
    }
    
    // Normalize to 0-1
    return sum / (binCount * 255);
  }

  private calculateEnergy(): number {
    if (!this.frequencyData.length) return 0;
    
    let sum = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      sum += this.frequencyData[i];
    }
    
    return sum / (this.frequencyData.length * 255);
  }

  private detectBeats(): number {
    // Simple beat detection algorithm based on energy thresholding in the kick band
    const kickEnergy = this.getAverageForBand(this.bands.kick.min, this.bands.kick.max);
    const snareEnergy = this.getAverageForBand(this.bands.snare.min, this.bands.snare.max);
    
    // Weight kick more than snare for rhythm detection
    return kickEnergy * 0.7 + snareEnergy * 0.3;
  }
}

// Singleton instance
const audioProcessor = new AudioProcessor();
export default audioProcessor;
