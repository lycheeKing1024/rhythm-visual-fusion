
export type EffectType = 'none' | 'noise' | 'displacement' | 'timeMachine' | 'pixelate' | 'rgb' | 'blur' | 'shake';

export interface Effect {
  type: EffectType;
  name: string;
  icon: string;
  description: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
  audioFeature: string | null; // Which audio feature this effect can be mapped to
}

export const EFFECTS: Record<EffectType, Effect> = {
  none: {
    type: 'none',
    name: 'None',
    icon: '✓',
    description: 'No effect applied',
    minValue: 0,
    maxValue: 0,
    defaultValue: 0,
    audioFeature: null
  },
  noise: {
    type: 'noise',
    name: 'Noise',
    icon: '📶',
    description: 'Adds noise to the video based on audio intensity',
    minValue: 0,
    maxValue: 1,
    defaultValue: 0.2,
    audioFeature: 'energy'
  },
  displacement: {
    type: 'displacement',
    name: 'Wave',
    icon: '🌊',
    description: 'Creates wave distortion based on audio rhythm',
    minValue: 0,
    maxValue: 50,
    defaultValue: 10,
    audioFeature: 'rhythm'
  },
  timeMachine: {
    type: 'timeMachine',
    name: 'Time Machine',
    icon: '⏱️',
    description: 'Creates time-based delay effects like in Ghost in the Shell',
    minValue: 0,
    maxValue: 30,
    defaultValue: 10,
    audioFeature: 'rhythm'
  },
  pixelate: {
    type: 'pixelate',
    name: 'Pixelate',
    icon: '🧩',
    description: 'Pixelates the video with audio bass response',
    minValue: 1,
    maxValue: 100,
    defaultValue: 20,
    audioFeature: 'bass'
  },
  rgb: {
    type: 'rgb',
    name: 'RGB Split',
    icon: '🎨',
    description: 'Splits RGB channels based on mid frequencies',
    minValue: 0,
    maxValue: 20,
    defaultValue: 5,
    audioFeature: 'mids'
  },
  blur: {
    type: 'blur',
    name: 'Blur',
    icon: '💨',
    description: 'Applies blur based on treble intensity',
    minValue: 0,
    maxValue: 20,
    defaultValue: 4,
    audioFeature: 'treble'
  },
  shake: {
    type: 'shake',
    name: 'Shake',
    icon: '📳',
    description: 'Camera shake effect triggered by kick drum',
    minValue: 0,
    maxValue: 50,
    defaultValue: 20,
    audioFeature: 'kick'
  }
};

interface Mapping {
  audioFeature: string;
  effectType: EffectType;
  intensity: number;
  enabled: boolean;
}

export interface VideoEffectConfig {
  mappings: Mapping[];
}

// TouchDesigner-like noise generator for displacement
class NoiseGenerator {
  private time: number = 0;
  private resolution: { width: number, height: number } = { width: 512, height: 512 };
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.resolution.width;
    this.canvas.height = this.resolution.height;
    this.ctx = this.canvas.getContext('2d')!;
  }
  
  public updateResolution(width: number, height: number) {
    this.resolution = { width, height };
    this.canvas.width = width;
    this.canvas.height = height;
  }
  
  public generatePerlinNoise(time: number, frequency: number, amplitude: number): ImageData {
    this.time = time;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw perlin-like noise pattern
    const cellSize = Math.max(2, Math.floor(10 / frequency));
    
    for (let y = 0; y < this.canvas.height; y += cellSize) {
      for (let x = 0; x < this.canvas.width; x += cellSize) {
        const noise = this.perlinValue(x * 0.01 * frequency, y * 0.01 * frequency, this.time) * 0.5 + 0.5;
        const value = Math.floor(noise * 255 * amplitude);
        
        this.ctx.fillStyle = `rgb(${value},${value},${value})`;
        this.ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
    
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }
  
  public generateRhythmicNoise(rhythm: number, energy: number, bass: number): ImageData {
    this.time += 0.01;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Base gradient for time displacement (emulating Ramp TOP)
    const gradientType = Math.sin(this.time * 0.5) > 0 ? 'radial' : 'linear';
    
    if (gradientType === 'radial') {
      const centerX = this.canvas.width / 2 + Math.sin(this.time) * this.canvas.width * 0.2 * rhythm;
      const centerY = this.canvas.height / 2 + Math.cos(this.time * 0.7) * this.canvas.height * 0.2 * rhythm;
      const radius = Math.min(this.canvas.width, this.canvas.height) * (0.3 + Math.sin(this.time * 0.2) * 0.2);
      
      const gradient = this.ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius * (1 + bass * 0.5)
      );
      
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(1, 'black');
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      const angle = this.time * 0.5;
      const startX = Math.cos(angle) * this.canvas.width * rhythm + this.canvas.width / 2;
      const startY = Math.sin(angle) * this.canvas.height * rhythm + this.canvas.height / 2;
      const endX = Math.cos(angle + Math.PI) * this.canvas.width * rhythm + this.canvas.width / 2;
      const endY = Math.sin(angle + Math.PI) * this.canvas.height * rhythm + this.canvas.height / 2;
      
      const gradient = this.ctx.createLinearGradient(startX, startY, endX, endY);
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(1, 'black');
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Add noise overlay based on energy
    if (energy > 0.1) {
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        if (Math.random() > 0.7) {
          const noise = (Math.random() - 0.5) * 255 * energy;
          data[i] = Math.min(Math.max(data[i] + noise, 0), 255);
          data[i + 1] = data[i];
          data[i + 2] = data[i];
        }
      }
      
      this.ctx.putImageData(imageData, 0, 0);
    }
    
    // Add beat response
    if (rhythm > 0.7) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${rhythm * 0.2})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }
  
  private perlinValue(x: number, y: number, z: number): number {
    // Simple noise function for demo purposes (not actual perlin)
    return Math.sin(x * 10 + this.time) * Math.cos(y * 10 + this.time) * Math.sin(z * 10);
  }
}

class VideoEffects {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private video: HTMLVideoElement | null = null;
  private config: VideoEffectConfig = { mappings: [] };
  private isProcessing: boolean = false;
  private animationFrameId: number | null = null;
  private frameHistory: ImageData[] = [];
  private maxHistoryLength = 30;
  private noiseGenerator: NoiseGenerator = new NoiseGenerator();
  private lastAudioFeatures: Record<string, number> = {};
  private effectOrder: EffectType[] = ['displacement', 'timeMachine', 'pixelate', 'rgb', 'blur', 'shake', 'noise'];

  constructor() {
    this.resetConfig();
  }

  public resetConfig() {
    this.config = {
      mappings: [
        { audioFeature: 'kick', effectType: 'shake', intensity: 10, enabled: true },
        { audioFeature: 'snare', effectType: 'noise', intensity: 0.2, enabled: false },
        { audioFeature: 'bass', effectType: 'pixelate', intensity: 20, enabled: false },
        { audioFeature: 'mids', effectType: 'rgb', intensity: 5, enabled: false },
        { audioFeature: 'treble', effectType: 'blur', intensity: 4, enabled: false },
        { audioFeature: 'rhythm', effectType: 'timeMachine', intensity: 10, enabled: false }
      ]
    };
  }

  public setupCanvas(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.video = video;
    
    this.updateCanvasSize();
    
    window.addEventListener('resize', this.updateCanvasSize);
  }

  private updateCanvasSize = () => {
    if (!this.canvas || !this.video) return;
    
    const videoRatio = this.video.videoWidth / this.video.videoHeight;
    const maxWidth = this.canvas.parentElement?.clientWidth || this.video.videoWidth;
    const maxHeight = this.canvas.parentElement?.clientHeight || this.video.videoHeight;
    
    let width = maxWidth;
    let height = width / videoRatio;
    
    if (height > maxHeight) {
      height = maxHeight;
      width = height * videoRatio;
    }
    
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Update noise generator resolution for better performance
    this.noiseGenerator.updateResolution(width, height);
  };

  public startProcessing(getAudioFeatures: () => Record<string, number>) {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.frameHistory = [];

    const render = () => {
      if (!this.ctx || !this.video || !this.canvas) {
        this.isProcessing = false;
        return;
      }
      
      const audioFeatures = getAudioFeatures();
      this.lastAudioFeatures = { ...audioFeatures };
      
      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Draw the base video frame
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      
      // Capture current frame for frame history
      const currentFrame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      
      // Store in history
      this.frameHistory.unshift(currentFrame);
      if (this.frameHistory.length > this.maxHistoryLength) {
        this.frameHistory.pop();
      }
      
      // Apply effects in specific order (TouchDesigner-like node workflow)
      const enabledMappings = this.config.mappings
        .filter(mapping => mapping.enabled && mapping.effectType !== 'none')
        .sort((a, b) => {
          const orderA = this.effectOrder.indexOf(a.effectType);
          const orderB = this.effectOrder.indexOf(b.effectType);
          return orderA - orderB;
        });
      
      for (const mapping of enabledMappings) {
        const featureValue = audioFeatures[mapping.audioFeature] || 0;
        this.applyEffect(mapping.effectType, featureValue, mapping.intensity);
      }
      
      this.animationFrameId = requestAnimationFrame(render);
    };
    
    this.animationFrameId = requestAnimationFrame(render);
  }

  public stopProcessing() {
    this.isProcessing = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private applyEffect(effectType: EffectType, audioValue: number, intensity: number) {
    if (!this.ctx || !this.canvas) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    const value = Math.min(Math.max(audioValue, 0), 1);
    
    switch (effectType) {
      case 'noise':
        this.applyNoiseEffect(value * intensity);
        break;
      case 'displacement':
        this.applyAdvancedDisplacementEffect(value * intensity);
        break;
      case 'timeMachine':
        this.applyAdvancedTimeMachineEffect(value * intensity);
        break;
      case 'pixelate':
        this.applyPixelateEffect(value * intensity);
        break;
      case 'rgb':
        this.applyRGBSplitEffect(value * intensity);
        break;
      case 'blur':
        this.applyBlurEffect(value * intensity);
        break;
      case 'shake':
        this.applyShakeEffect(value * intensity);
        break;
      default:
        return;
    }
  }

  private applyNoiseEffect(intensity: number) {
    if (!this.ctx || !this.canvas) return;
    
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;
    const length = data.length;
    
    for (let i = 0; i < length; i += 4) {
      if (Math.random() > 0.5) {
        const noise = (Math.random() - 0.5) * intensity * 255;
        data[i] = Math.min(Math.max(data[i] + noise, 0), 255);
        data[i + 1] = Math.min(Math.max(data[i + 1] + noise, 0), 255);
        data[i + 2] = Math.min(Math.max(data[i + 2] + noise, 0), 255);
      }
    }
    
    this.ctx.putImageData(imageData, 0, 0);
  }

  private applyAdvancedDisplacementEffect(intensity: number) {
    if (!this.ctx || !this.canvas) return;
    
    const rhythm = this.lastAudioFeatures.rhythm || 0;
    const energy = this.lastAudioFeatures.energy || 0;
    const bass = this.lastAudioFeatures.bass || 0;
    
    // Generate noise pattern that will drive the displacement (like a displacement map TOP)
    const noiseData = this.noiseGenerator.generateRhythmicNoise(rhythm, energy, bass);
    
    // Apply displacement using the noise as a map
    const currentFrame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const resultData = new Uint8ClampedArray(currentFrame.data.length);
    
    for (let y = 0; y < this.canvas.height; y++) {
      for (let x = 0; x < this.canvas.width; x++) {
        const pixelIndex = (y * this.canvas.width + x) * 4;
        
        // Get displacement amount from noise
        const noiseValue = noiseData.data[pixelIndex] / 255;
        
        // Calculate displacement
        const displaceX = Math.sin(y * 0.05 + noiseValue * 10) * intensity * noiseValue;
        const displaceY = Math.cos(x * 0.05 + noiseValue * 10) * intensity * noiseValue;
        
        const sourceX = Math.max(0, Math.min(this.canvas.width - 1, Math.floor(x + displaceX)));
        const sourceY = Math.max(0, Math.min(this.canvas.height - 1, Math.floor(y + displaceY)));
        
        const sourceIndex = (sourceY * this.canvas.width + sourceX) * 4;
        
        // Copy the displaced pixel
        resultData[pixelIndex] = currentFrame.data[sourceIndex];
        resultData[pixelIndex + 1] = currentFrame.data[sourceIndex + 1];
        resultData[pixelIndex + 2] = currentFrame.data[sourceIndex + 2];
        resultData[pixelIndex + 3] = currentFrame.data[sourceIndex + 3];
      }
    }
    
    this.ctx.putImageData(new ImageData(resultData, this.canvas.width, this.canvas.height), 0, 0);
  }

  private applyAdvancedTimeMachineEffect(intensity: number) {
    if (!this.ctx || !this.canvas || this.frameHistory.length < 2) return;
    
    const rhythm = this.lastAudioFeatures.rhythm || 0;
    const kick = this.lastAudioFeatures.kick || 0;
    
    // Create a time displacement map (similar to TouchDesigner's Ramp TOP + Noise TOP)
    const noiseData = this.noiseGenerator.generateRhythmicNoise(rhythm, 0.3, kick);
    
    // Set the range of frames to use (Black Offset and White Offset in TouchDesigner terms)
    const maxFrameOffset = Math.min(Math.floor(intensity), this.frameHistory.length - 1);
    const minFrameOffset = 0;
    
    // Get current frame
    const currentFrameData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const resultData = new Uint8ClampedArray(currentFrameData.data);
    
    // Apply time displacement
    for (let y = 0; y < this.canvas.height; y++) {
      for (let x = 0; x < this.canvas.width; x++) {
        const pixelIndex = (y * this.canvas.width + x) * 4;
        
        // Use the noise data as a time displacement map (monochrome values determine time offset)
        const timeOffsetFactor = noiseData.data[pixelIndex] / 255;
        
        // Calculate frame index to sample from (similar to TouchDesigner's Black Offset to White Offset range)
        const frameOffset = Math.floor(minFrameOffset + timeOffsetFactor * (maxFrameOffset - minFrameOffset));
        
        // If we have a frame at this offset, use it
        if (frameOffset > 0 && frameOffset < this.frameHistory.length) {
          const historicalFrame = this.frameHistory[frameOffset];
          
          // Apply the historical pixel from the frame at this offset
          resultData[pixelIndex] = historicalFrame.data[pixelIndex];
          resultData[pixelIndex + 1] = historicalFrame.data[pixelIndex + 1];
          resultData[pixelIndex + 2] = historicalFrame.data[pixelIndex + 2];
        }
      }
    }
    
    // Draw result
    this.ctx.putImageData(new ImageData(resultData, this.canvas.width, this.canvas.height), 0, 0);
    
    // Add visual feedback for strong beats (like combining with a Constant TOP on beat in TouchDesigner)
    if (kick > 0.8) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${kick * 0.2})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private applyPixelateEffect(intensity: number) {
    if (!this.ctx || !this.canvas || !this.video) return;
    
    const pixelSize = Math.max(1, Math.floor(intensity));
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    this.ctx.save();
    
    this.ctx.drawImage(
      this.video, 
      0, 0, this.video.videoWidth, this.video.videoHeight, 
      0, 0, w / pixelSize, h / pixelSize
    );
    
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      this.canvas, 
      0, 0, w / pixelSize, h / pixelSize, 
      0, 0, w, h
    );
    
    this.ctx.restore();
  }

  private applyRGBSplitEffect(intensity: number) {
    if (!this.ctx || !this.canvas) return;
    
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;
    const originalData = new Uint8ClampedArray(data);
    
    const offsetX = Math.floor(intensity);
    if (offsetX === 0) return;
    
    for (let y = 0; y < this.canvas.height; y++) {
      for (let x = 0; x < this.canvas.width; x++) {
        const i = (y * this.canvas.width + x) * 4;
        
        const rX = x - offsetX;
        if (rX >= 0 && rX < this.canvas.width) {
          const rI = (y * this.canvas.width + rX) * 4;
          data[i] = originalData[rI];
        }
        
        const bX = x + offsetX;
        if (bX >= 0 && bX < this.canvas.width) {
          const bI = (y * this.canvas.width + bX) * 4;
          data[i + 2] = originalData[bI + 2];
        }
      }
    }
    
    this.ctx.putImageData(imageData, 0, 0);
  }

  private applyBlurEffect(intensity: number) {
    if (!this.ctx || !this.canvas) return;
    
    this.ctx.filter = `blur(${intensity}px)`;
    
    if (this.video) {
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    }
    
    this.ctx.filter = 'none';
  }

  private applyShakeEffect(intensity: number) {
    if (!this.ctx || !this.canvas || !this.video) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const maxOffset = intensity;
    const shakeX = (Math.random() - 0.5) * maxOffset;
    const shakeY = (Math.random() - 0.5) * maxOffset;
    
    this.ctx.save();
    this.ctx.translate(shakeX, shakeY);
    this.ctx.drawImage(
      this.video,
      0, 0, this.video.videoWidth, this.video.videoHeight,
      0, 0, this.canvas.width, this.canvas.height
    );
    this.ctx.restore();
  }

  public updateMapping(index: number, updates: Partial<Mapping>) {
    if (index >= 0 && index < this.config.mappings.length) {
      this.config.mappings[index] = { ...this.config.mappings[index], ...updates };
    }
  }

  public getConfig(): VideoEffectConfig {
    return { ...this.config };
  }
}

const videoEffects = new VideoEffects();
export default videoEffects;
