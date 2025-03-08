export type EffectType = 'none' | 'noise' | 'displacement' | 'timeMachine' | 'pixelate' | 'rgb' | 'blur' | 'shake' | 'horizontalMove';

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
  },
  horizontalMove: {
    type: 'horizontalMove',
    name: 'Horizontal Move',
    icon: '↔️',
    description: 'Moves video horizontally based on kick drum',
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

class VideoEffects {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private video: HTMLVideoElement | null = null;
  private config: VideoEffectConfig = { mappings: [] };
  private isProcessing: boolean = false;
  private animationFrameId: number | null = null;
  private frameHistory: ImageData[] = [];
  private maxHistoryLength = 30;
  private lastShakeX: number = 0;
  private targetShakeX: number = 0;
  private shakeVelocity: number = 0;

  constructor() {
    this.resetConfig();
  }

  public resetConfig() {
    this.config = {
      mappings: [
        { audioFeature: 'kick', effectType: 'shake', intensity: 20, enabled: true },
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
      
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      
      const currentFrame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      
      this.frameHistory.unshift(currentFrame);
      if (this.frameHistory.length > this.maxHistoryLength) {
        this.frameHistory.pop();
      }
      
      this.config.mappings.forEach(mapping => {
        if (mapping.enabled && mapping.effectType !== 'none') {
          const featureValue = audioFeatures[mapping.audioFeature] || 0;
          this.applyEffect(mapping.effectType, featureValue, mapping.intensity);
        }
      });
      
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
    
    const imageData = this.ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    const value = Math.min(Math.max(audioValue, 0), 1);
    
    switch (effectType) {
      case 'noise':
        this.applyNoiseEffect(data, width, height, value * intensity);
        break;
      case 'displacement':
        this.applyDisplacementEffect(data, width, height, value * intensity);
        break;
      case 'timeMachine':
        this.applyTimeMachineEffect(value * intensity);
        return;
      case 'pixelate':
        this.applyPixelateEffect(value * intensity);
        return;
      case 'rgb':
        this.applyRGBSplitEffect(data, width, height, value * intensity);
        break;
      case 'blur':
        this.applyBlurEffect(value * intensity);
        return;
      case 'shake':
        this.applyShakeEffect(value * intensity);
        return;
      case 'horizontalMove':
        this.applyHorizontalMoveEffect(value * intensity);
        return;
      default:
        return;
    }
    
    this.ctx.putImageData(imageData, 0, 0);
  }

  private applyNoiseEffect(data: Uint8ClampedArray, width: number, height: number, intensity: number) {
    const length = data.length;
    for (let i = 0; i < length; i += 4) {
      if (Math.random() > 0.5) {
        const noise = (Math.random() - 0.5) * intensity * 255;
        data[i] = Math.min(Math.max(data[i] + noise, 0), 255);
        data[i + 1] = Math.min(Math.max(data[i + 1] + noise, 0), 255);
        data[i + 2] = Math.min(Math.max(data[i + 2] + noise, 0), 255);
      }
    }
  }

  private applyDisplacementEffect(data: Uint8ClampedArray, width: number, height: number, intensity: number) {
    const originalData = new Uint8ClampedArray(data);
    
    const time = Date.now() * 0.001;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const displaceX = Math.sin(y * 0.05 + time) * intensity;
        const displaceY = Math.cos(x * 0.05 + time) * intensity;
        
        const newX = Math.floor(x + displaceX);
        const newY = Math.floor(y + displaceY);
        
        if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
          const origPos = (y * width + x) * 4;
          const newPos = (newY * width + newX) * 4;
          
          data[origPos] = originalData[newPos];
          data[origPos + 1] = originalData[newPos + 1];
          data[origPos + 2] = originalData[newPos + 2];
        }
      }
    }
  }

  private applyTimeMachineEffect(intensity: number) {
    if (!this.ctx || !this.canvas || this.frameHistory.length < 2) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.drawImage(this.canvas, 0, 0);
    
    const gradientCanvas = document.createElement('canvas');
    gradientCanvas.width = width;
    gradientCanvas.height = height;
    const gradientCtx = gradientCanvas.getContext('2d');
    if (!gradientCtx) return;
    
    const time = Date.now() * 0.001;
    const gradientType = Math.sin(time * 0.5) > 0;
    
    if (gradientType) {
      const centerX = width / 2 + Math.sin(time) * width * 0.3;
      const centerY = height / 2 + Math.cos(time * 0.7) * height * 0.3;
      const radius = Math.min(width, height) * (0.3 + Math.sin(time * 0.2) * 0.2);
      
      const gradient = gradientCtx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius
      );
      
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(1, 'black');
      
      gradientCtx.fillStyle = gradient;
      gradientCtx.fillRect(0, 0, width, height);
    } else {
      const angle = time * 0.5;
      const startX = Math.cos(angle) * width + width / 2;
      const startY = Math.sin(angle) * height + height / 2;
      const endX = Math.cos(angle + Math.PI) * width + width / 2;
      const endY = Math.sin(angle + Math.PI) * height + height / 2;
      
      const gradient = gradientCtx.createLinearGradient(startX, startY, endX, endY);
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(1, 'black');
      
      gradientCtx.fillStyle = gradient;
      gradientCtx.fillRect(0, 0, width, height);
    }
    
    const gradientData = gradientCtx.getImageData(0, 0, width, height).data;
    
    const scaledIntensity = Math.floor(intensity * 0.5);
    const maxOffset = Math.min(scaledIntensity, this.frameHistory.length - 1);
    
    const currentData = this.ctx.getImageData(0, 0, width, height);
    const resultData = new Uint8ClampedArray(currentData.data);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        
        const offsetFactor = gradientData[pixelIndex] / 255;
        
        const frameOffset = Math.floor(offsetFactor * maxOffset);
        
        if (frameOffset > 0 && frameOffset < this.frameHistory.length) {
          const historicalFrame = this.frameHistory[frameOffset];
          
          resultData[pixelIndex] = historicalFrame.data[pixelIndex];
          resultData[pixelIndex + 1] = historicalFrame.data[pixelIndex + 1];
          resultData[pixelIndex + 2] = historicalFrame.data[pixelIndex + 2];
        }
      }
    }
    
    const resultImageData = new ImageData(resultData, width, height);
    this.ctx.putImageData(resultImageData, 0, 0);
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

  private applyRGBSplitEffect(data: Uint8ClampedArray, width: number, height: number, intensity: number) {
    const offsetX = Math.floor(intensity);
    if (offsetX === 0) return;
    
    const originalData = new Uint8ClampedArray(data);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        
        const rX = x - offsetX;
        if (rX >= 0 && rX < width) {
          const rI = (y * width + rX) * 4;
          data[i] = originalData[rI];
        }
        
        const bX = x + offsetX;
        if (bX >= 0 && bX < width) {
          const bI = (y * width + bX) * 4;
          data[i + 2] = originalData[bI + 2];
        }
      }
    }
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
    
    const maxOffset = this.canvas.width * 0.002;
    this.targetShakeX = (intensity - 0.5) * maxOffset;
    
    const spring = 0.12;
    const friction = 0.92;
    
    const distance = this.targetShakeX - this.lastShakeX;
    
    this.shakeVelocity += distance * spring;
    this.shakeVelocity *= friction;
    
    this.lastShakeX += this.shakeVelocity;
    
    this.ctx.save();
    this.ctx.translate(this.lastShakeX, 0);
    this.ctx.drawImage(
      this.video,
      0, 0, this.video.videoWidth, this.video.videoHeight,
      0, 0, this.canvas.width, this.canvas.height
    );
    this.ctx.restore();
  }

  private applyHorizontalMoveEffect(intensity: number) {
    if (!this.ctx || !this.canvas || !this.video) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const maxOffset = intensity;
    const moveX = Math.sin(Date.now() * 0.01) * maxOffset;
    
    this.ctx.save();
    this.ctx.translate(moveX, 0);
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
