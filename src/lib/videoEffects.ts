
export type EffectType = 'none' | 'noise' | 'displacement' | 'pixelate' | 'rgb' | 'blur' | 'shake';

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
    description: 'Shakes the video on kick drum hits',
    minValue: 0,
    maxValue: 30,
    defaultValue: 10,
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

class VideoEffects {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private video: HTMLVideoElement | null = null;
  private config: VideoEffectConfig = { mappings: [] };
  private isProcessing: boolean = false;
  private animationFrameId: number | null = null;
  
  constructor() {
    // Initialize with default mappings
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
        { audioFeature: 'rhythm', effectType: 'displacement', intensity: 10, enabled: false }
      ]
    };
  }

  public setupCanvas(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.video = video;
    
    // Set canvas dimensions to match video
    this.updateCanvasSize();
    
    // Add resize listener
    window.addEventListener('resize', this.updateCanvasSize);
  }

  private updateCanvasSize = () => {
    if (!this.canvas || !this.video) return;
    
    // Set canvas size to match video while maintaining aspect ratio
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
  };

  public startProcessing(getAudioFeatures: () => Record<string, number>) {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    const render = () => {
      if (!this.ctx || !this.video || !this.canvas) {
        this.isProcessing = false;
        return;
      }
      
      // Get current audio features
      const audioFeatures = getAudioFeatures();
      
      // Clear the canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Draw the base video frame
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      
      // Apply enabled effects
      this.config.mappings.forEach(mapping => {
        if (mapping.enabled && mapping.effectType !== 'none') {
          const featureValue = audioFeatures[mapping.audioFeature] || 0;
          this.applyEffect(mapping.effectType, featureValue, mapping.intensity);
        }
      });
      
      // Continue rendering
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
    
    // Get image data
    const imageData = this.ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Scale the audio value between 0 and 1
    const value = Math.min(Math.max(audioValue, 0), 1);
    
    switch (effectType) {
      case 'noise':
        this.applyNoiseEffect(data, width, height, value * intensity);
        break;
      case 'displacement':
        this.applyDisplacementEffect(data, width, height, value * intensity);
        break;
      case 'pixelate':
        this.applyPixelateEffect(value * intensity);
        return; // This effect doesn't modify imageData directly
      case 'rgb':
        this.applyRGBSplitEffect(data, width, height, value * intensity);
        break;
      case 'blur':
        this.applyBlurEffect(value * intensity);
        return; // This effect doesn't modify imageData directly
      case 'shake':
        this.applyShakeEffect(value * intensity);
        return; // This effect doesn't modify imageData directly
      default:
        return;
    }
    
    // Put the modified image data back
    this.ctx.putImageData(imageData, 0, 0);
  }

  private applyNoiseEffect(data: Uint8ClampedArray, width: number, height: number, intensity: number) {
    const length = data.length;
    for (let i = 0; i < length; i += 4) {
      // Only apply noise to every other pixel for optimization
      if (Math.random() > 0.5) {
        const noise = (Math.random() - 0.5) * intensity * 255;
        data[i] = Math.min(Math.max(data[i] + noise, 0), 255);
        data[i + 1] = Math.min(Math.max(data[i + 1] + noise, 0), 255);
        data[i + 2] = Math.min(Math.max(data[i + 2] + noise, 0), 255);
      }
    }
  }

  private applyDisplacementEffect(data: Uint8ClampedArray, width: number, height: number, intensity: number) {
    // Create a copy of the original image data
    const originalData = new Uint8ClampedArray(data);
    
    const time = Date.now() * 0.001;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Create sine wave displacement
        const displaceX = Math.sin(y * 0.05 + time) * intensity;
        const displaceY = Math.cos(x * 0.05 + time) * intensity;
        
        // Calculate new position
        const newX = Math.floor(x + displaceX);
        const newY = Math.floor(y + displaceY);
        
        // Check bounds
        if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
          const origPos = (y * width + x) * 4;
          const newPos = (newY * width + newX) * 4;
          
          // Copy pixels from the source to the displaced position
          data[origPos] = originalData[newPos];
          data[origPos + 1] = originalData[newPos + 1];
          data[origPos + 2] = originalData[newPos + 2];
        }
      }
    }
  }

  private applyPixelateEffect(intensity: number) {
    if (!this.ctx || !this.canvas || !this.video) return;
    
    // The size of the pixelation blocks
    const pixelSize = Math.max(1, Math.floor(intensity));
    
    // Clear the canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Redraw with pixelation
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    this.ctx.save();
    
    // Draw video at reduced resolution
    this.ctx.drawImage(
      this.video, 
      0, 0, this.video.videoWidth, this.video.videoHeight, 
      0, 0, w / pixelSize, h / pixelSize
    );
    
    // Scale it back up
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      this.canvas, 
      0, 0, w / pixelSize, h / pixelSize, 
      0, 0, w, h
    );
    
    this.ctx.restore();
  }

  private applyRGBSplitEffect(data: Uint8ClampedArray, width: number, height: number, intensity: number) {
    const offsetX = Math.floor(intensity);
    if (offsetX === 0) return;
    
    // Create a copy of the original image data
    const originalData = new Uint8ClampedArray(data);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        
        // Offset red channel to the left
        const rX = x - offsetX;
        if (rX >= 0 && rX < width) {
          const rI = (y * width + rX) * 4;
          data[i] = originalData[rI];
        }
        
        // Offset blue channel to the right
        const bX = x + offsetX;
        if (bX >= 0 && bX < width) {
          const bI = (y * width + bX) * 4;
          data[i + 2] = originalData[bI + 2];
        }
        
        // Green channel stays in place
      }
    }
  }

  private applyBlurEffect(intensity: number) {
    if (!this.ctx || !this.canvas) return;
    
    // Apply CSS blur filter
    this.ctx.filter = `blur(${intensity}px)`;
    
    // Draw the video again with the filter
    if (this.video) {
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Reset filter
    this.ctx.filter = 'none';
  }

  private applyShakeEffect(intensity: number) {
    if (!this.ctx || !this.canvas || !this.video) return;
    
    // Clear the canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Calculate random shake offset based on intensity
    const shakeX = (Math.random() - 0.5) * intensity * 2;
    const shakeY = (Math.random() - 0.5) * intensity * 2;
    
    // Draw video with offset
    this.ctx.drawImage(
      this.video, 
      0, 0, this.video.videoWidth, this.video.videoHeight,
      shakeX, shakeY, this.canvas.width, this.canvas.height
    );
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

// Singleton instance
const videoEffects = new VideoEffects();
export default videoEffects;
