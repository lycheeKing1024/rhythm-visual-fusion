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
  private lastRhythm: number = 0;
  private rhythmSmoothed: number = 0;
  private kickSmoothed: number = 0;
  private snareSmoothed: number = 0;
  
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
  
  // Generate TD-style noise for displacement map
  public generateRhythmicNoise(
    rhythm: number, 
    kick: number, 
    snare: number, 
    energy: number, 
    bass: number
  ): ImageData {
    // Apply smoothing like TD's Lag CHOP for more natural transitions
    this.rhythmSmoothed = this.smoothValue(this.rhythmSmoothed, rhythm, 0.1);
    this.kickSmoothed = this.smoothValue(this.kickSmoothed, kick, 0.3);
    this.snareSmoothed = this.smoothValue(this.snareSmoothed, snare, 0.15);
    
    // Advance time (like Time CHOP)
    this.time += 0.01 * (1 + this.rhythmSmoothed * 2);  // Rhythm affects time speed
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // TD-like approach: Create a base gradient (simulating Ramp TOP)
    // Alternate between different pattern types based on time
    const patternType = Math.floor(this.time * 0.2) % 3;
    
    if (patternType === 0) {
      // Radial gradient pattern (like Radial TOP)
      const centerX = this.canvas.width / 2 + Math.sin(this.time) * this.canvas.width * 0.2 * this.rhythmSmoothed;
      const centerY = this.canvas.height / 2 + Math.cos(this.time * 0.7) * this.canvas.height * 0.2 * this.rhythmSmoothed;
      const radius = Math.min(this.canvas.width, this.canvas.height) * (0.3 + bass * 0.3);
      
      const gradient = this.ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius * (1 + this.kickSmoothed * 0.8)
      );
      
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(0.6 - this.kickSmoothed * 0.3, 'grey');
      gradient.addColorStop(1, 'black');
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } 
    else if (patternType === 1) {
      // Linear gradient with rotation (like Linear TOP with Math CHOP rotation)
      const angle = this.time * 0.5;
      const startX = Math.cos(angle) * this.canvas.width * this.rhythmSmoothed + this.canvas.width / 2;
      const startY = Math.sin(angle) * this.canvas.height * this.rhythmSmoothed + this.canvas.height / 2;
      const endX = Math.cos(angle + Math.PI) * this.canvas.width * this.rhythmSmoothed + this.canvas.width / 2;
      const endY = Math.sin(angle + Math.PI) * this.canvas.height * this.rhythmSmoothed + this.canvas.height / 2;
      
      const gradient = this.ctx.createLinearGradient(startX, startY, endX, endY);
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(0.5 - this.kickSmoothed * 0.2, '#888');
      gradient.addColorStop(1, 'black');
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    else {
      // Striped pattern (like Grid TOP)
      const stripeThickness = Math.max(5, 20 * (1 - this.rhythmSmoothed));
      const offset = this.time * 20 * this.rhythmSmoothed;
      
      this.ctx.fillStyle = 'black';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.ctx.fillStyle = 'white';
      for (let y = -stripeThickness; y < this.canvas.height + stripeThickness; y += stripeThickness * 2) {
        const yPos = (y + offset) % (this.canvas.height + stripeThickness * 2) - stripeThickness;
        this.ctx.fillRect(0, yPos, this.canvas.width, stripeThickness);
      }
      
      // Add diagonal stripes on kick
      if (this.kickSmoothed > 0.3) {
        this.ctx.globalCompositeOperation = 'difference';
        for (let x = -stripeThickness * 2; x < this.canvas.width + stripeThickness * 2; x += stripeThickness * 4) {
          const xPos = (x + offset * 2) % (this.canvas.width + stripeThickness * 4) - stripeThickness * 2;
          this.ctx.fillRect(xPos, 0, stripeThickness * 2, this.canvas.height);
        }
        this.ctx.globalCompositeOperation = 'source-over';
      }
    }
    
    // Add noise overlay based on energy (like Noise TOP)
    if (energy > 0.1) {
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const data = imageData.data;
      
      const noiseAmount = energy * 0.7;
      const noiseScale = 0.2 + energy * 0.8;
      
      for (let y = 0; y < this.canvas.height; y++) {
        for (let x = 0; x < this.canvas.width; x++) {
          const i = (y * this.canvas.width + x) * 4;
          
          // Simplex-like noise effect (more TD-realistic than pure random)
          const noiseValue = 
            this.simplexLike(x * noiseScale * 0.01, y * noiseScale * 0.01, this.time) * 0.5 + 0.5;
          
          // Apply noise as overlay
          if (Math.random() > 0.7) {
            data[i] = Math.min(Math.max(data[i] + (noiseValue - 0.5) * 255 * noiseAmount, 0), 255);
            data[i + 1] = data[i];
            data[i + 2] = data[i];
          }
        }
      }
      
      this.ctx.putImageData(imageData, 0, 0);
    }
    
    // Add kick response (like Transform TOP with scale animation)
    if (this.kickSmoothed > 0.6) {
      // Save current base image for kick-driven transform
      const baseImage = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      
      // Clear and set up for transform 
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Calculate scale factor based on kick
      const kickEffect = this.kickSmoothed * 0.3;
      const scaleX = 1 - kickEffect;
      const scaleY = 1 - kickEffect;
      
      // Apply transform (simulate transform TOP)
      this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.scale(scaleX, scaleY);
      this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
      
      // Create temporary canvas for the scaled image 
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.canvas.width;
      tempCanvas.height = this.canvas.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(baseImage, 0, 0);
      
      // Draw scaled version
      this.ctx.drawImage(tempCanvas, 0, 0);
      
      // Reset transform
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      // Add flash on heavy kick (like Constant TOP blended on beat)
      if (this.kickSmoothed > 0.8) {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${(this.kickSmoothed - 0.8) * 0.8})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
    
    // Add snare response (like blur TOP with strength tied to snare)
    if (this.snareSmoothed > 0.4) {
      // Apply quick horizontal smear on snare
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const resultData = new Uint8ClampedArray(imageData.data);
      const smearAmount = Math.floor(this.snareSmoothed * 10);
      
      for (let y = 0; y < this.canvas.height; y++) {
        for (let x = 0; x < this.canvas.width; x++) {
          const i = (y * this.canvas.width + x) * 4;
          
          // Simple horizontal smear
          if (x < this.canvas.width - smearAmount) {
            const targetIdx = (y * this.canvas.width + (x + smearAmount)) * 4;
            resultData[targetIdx] = (imageData.data[i] + imageData.data[targetIdx]) / 2;
            resultData[targetIdx + 1] = resultData[targetIdx];
            resultData[targetIdx + 2] = resultData[targetIdx];
          }
        }
      }
      
      this.ctx.putImageData(new ImageData(resultData, this.canvas.width, this.canvas.height), 0, 0);
    }
    
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }
  
  // Generate specialized pattern for time machine (like Ramp TOP in TD)
  public generateTimeMachineControl(
    rhythm: number, 
    kick: number, 
    snare: number, 
    energy: number
  ): ImageData {
    this.rhythmSmoothed = this.smoothValue(this.rhythmSmoothed, rhythm, 0.12);
    this.kickSmoothed = this.smoothValue(this.kickSmoothed, kick, 0.3);
    this.snareSmoothed = this.smoothValue(this.snareSmoothed, snare, 0.2);
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Create a time displacement map that responds to audio features
    // This mimics creating a control input for Time Machine TOP
    
    // On strong kick, create radial time ripple (white center, black edges)
    if (this.kickSmoothed > 0.6) {
      const rippleSize = this.canvas.width * (0.2 + this.kickSmoothed * 0.3);
      const gradient = this.ctx.createRadialGradient(
        this.canvas.width / 2, this.canvas.height / 2, 0,
        this.canvas.width / 2, this.canvas.height / 2, rippleSize
      );
      
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(1, 'black');
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    // On strong snare, create horizontal time ripple
    else if (this.snareSmoothed > 0.5) {
      const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, 0);
      gradient.addColorStop(0, 'black');
      gradient.addColorStop(0.5, 'white');
      gradient.addColorStop(1, 'black');
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    // Otherwise create rhythmic patterns (like combining Noise TOP with pattern TOPs)
    else {
      // Create gradient based on rhythm
      const noiseScale = 0.005 + this.rhythmSmoothed * 0.01;
      
      // Fill with noise pattern
      for (let y = 0; y < this.canvas.height; y++) {
        for (let x = 0; x < this.canvas.width; x++) {
          // Generate perlin-like noise value
          let noiseValue = this.simplexLike(
            x * noiseScale, 
            y * noiseScale, 
            this.time * 0.1
          ) * 0.5 + 0.5;
          
          // Add rhythm-driven waves
          noiseValue += Math.sin(x * 0.01 + this.time) * 0.1 * this.rhythmSmoothed;
          noiseValue += Math.cos(y * 0.01 + this.time * 0.7) * 0.1 * this.rhythmSmoothed;
          
          // Clamp and convert to grayscale
          noiseValue = Math.max(0, Math.min(1, noiseValue));
          const color = Math.floor(noiseValue * 255);
          
          // Set pixel directly
          const idx = (y * this.canvas.width + x) * 4;
          this.ctx.fillStyle = `rgb(${color},${color},${color})`;
          this.ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    
    // Apply overall energy influence
    if (energy > 0.3) {
      // Increase contrast based on energy (like Level TOP in TD)
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        // Adjust contrast
        const value = data[i] / 255;
        const newValue = Math.pow(value, 1 - energy * 0.5) * 255;
        data[i] = data[i+1] = data[i+2] = Math.min(255, Math.max(0, newValue));
      }
      
      this.ctx.putImageData(imageData, 0, 0);
    }
    
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }
  
  // Smooth values (like Lag CHOP in TouchDesigner)
  private smoothValue(current: number, target: number, smoothFactor: number): number {
    return current + (target - current) * smoothFactor;
  }
  
  // Basic simplex-like noise function for more organized patterns
  private simplexLike(x: number, y: number, z: number): number {
    return Math.sin(x * 10 + z) * Math.cos(y * 10 + z) * Math.sin(z * 10);
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
  
  // TD-style intermediate buffers (like Render TOPs/Cache TOPs)
  private displacementBuffer: ImageData | null = null;
  private timeMachineBuffer: ImageData | null = null;

  constructor() {
    this.resetConfig();
  }

  public resetConfig() {
    this.config = {
      mappings: [
        { audioFeature: 'kick', effectType: 'shake', intensity: 10, enabled: true },
        { audioFeature: 'rhythm', effectType: 'timeMachine', intensity: 20, enabled: true },
        { audioFeature: 'bass', effectType: 'displacement', intensity: 30, enabled: true },
        { audioFeature: 'mids', effectType: 'rgb', intensity: 5, enabled: false },
        { audioFeature: 'treble', effectType: 'blur', intensity: 4, enabled: false },
        { audioFeature: 'energy', effectType: 'noise', intensity: 0.2, enabled: false }
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
      
      // TD-like approach: Process step by step with intermediate buffers
      
      // Step 1: Draw the base video frame to the canvas (like Movie File In TOP)
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      
      // Step 2: Capture current frame for history (like Write TOP to Texture 3D)
      const currentFrame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      
      // Store in history (like Texture 3D TOP building up frames)
      this.frameHistory.unshift(currentFrame);
      if (this.frameHistory.length > this.maxHistoryLength) {
        this.frameHistory.pop();
      }
      
      // Apply effects in TouchDesigner-like node workflow
      
      // Get mapped feature values
      const rhythm = audioFeatures.rhythm || 0;
      const kick = audioFeatures.kick || 0;
      const snare = audioFeatures.snare || 0;
      const bass = audioFeatures.bass || 0;
      const energy = audioFeatures.energy || 0;
      const hihat = audioFeatures.hihat || 0;
      
      // Find which effects are enabled in the mappings
      const enabledMappings = this.config.mappings.filter(mapping => mapping.enabled && mapping.effectType !== 'none');
      
      // Sort effects by processing order (like node connections in TD)
      const sortedMappings = [...enabledMappings].sort((a, b) => {
        const orderA = this.effectOrder.indexOf(a.effectType);
        const orderB = this.effectOrder.indexOf(b.effectType);
        return orderA - orderB;
      });
      
      // First generate noise and displacement maps (like Noise TOP and CHOP processing)
      const displacementMap = this.noiseGenerator.generateRhythmicNoise(rhythm, kick, snare, energy, bass);
      const timeMachineMap = this.noiseGenerator.generateTimeMachineControl(rhythm, kick, snare, energy);
      
      // Process effects by layer (like node chain in TouchDesigner)
      let currentImage = currentFrame;
      for (const mapping of sortedMappings) {
        const effectType = mapping.effectType;
        const featureValue = audioFeatures[mapping.audioFeature] || 0;
        const intensity = mapping.intensity;
        
        // Pass both the time control map and displacement map to the effects that need them
        if (effectType === 'displacement') {
          currentImage = this.applyDisplacementEffect(currentImage, displacementMap, featureValue * intensity / 50);
        } 
        else if (effectType === 'timeMachine') {
          if (this.frameHistory.length >= 2) {
            currentImage = this.applyTimeMachineEffect(currentImage, timeMachineMap, featureValue * intensity);
          }
        } 
        else {
          // Other effects
          currentImage = this.applyGenericEffect(currentImage, effectType, featureValue, intensity);
        }
      }
      
      // Draw the final processed image to canvas
      this.ctx.putImageData(currentImage, 0, 0);
      
      // Continue rendering loop
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

  // Apply TouchDesigner-style Displacement TOP effect
  private applyDisplacementEffect(sourceImage: ImageData, displacementMap: ImageData, intensity: number): ImageData {
    if (!this.canvas) return sourceImage;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Create result buffer
    const resultData = new Uint8ClampedArray(sourceImage.data.length);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        
        // Get displacement amount from noise map
        // Use red channel for X displacement and green for Y
        const displaceX = (displacementMap.data[pixelIndex] / 255 - 0.5) * intensity * width * 0.1;
        const displaceY = (displacementMap.data[pixelIndex] / 255 - 0.5) * intensity * height * 0.1;
        
        // Calculate source coordinates with displacement
        const sourceX = Math.max(0, Math.min(width - 1, Math.floor(x + displaceX)));
        const sourceY = Math.max(0, Math.min(height - 1, Math.floor(y + displaceY)));
        
        // Get source pixel
        const sourceIndex = (sourceY * width + sourceX) * 4;
        
        // Copy the displaced pixel
        resultData[pixelIndex] = sourceImage.data[sourceIndex];
        resultData[pixelIndex + 1] = sourceImage.data[sourceIndex + 1];
        resultData[pixelIndex + 2] = sourceImage.data[sourceIndex + 2];
        resultData[pixelIndex + 3] = sourceImage.data[sourceIndex + 3];
      }
    }
    
    return new ImageData(resultData, width, height);
  }

  // Apply TouchDesigner-style Time Machine TOP effect
  private applyTimeMachineEffect(sourceImage: ImageData, timeMap: ImageData, intensity: number): ImageData {
    if (!this.canvas || this.frameHistory.length < 2) return sourceImage;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Create result buffer
    const resultData = new Uint8ClampedArray(sourceImage.data.length);
    
    // Set the range of frames to use (Black Offset and White Offset in TD terms)
    const maxFrameOffset = Math.min(Math.floor(intensity), this.frameHistory.length - 1);
    
    // Apply time displacement based on the time control map
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        
        // Get the time offset from the map (0-1 normalized)
        const timeValue = timeMap.data[pixelIndex] / 255;
        
        // Calculate frame index based on the time value (similar to TD's Time Machine TOP)
        // timeValue 0 (black) = oldest frame, timeValue 1 (white) = newest frame
        const frameOffset = Math.floor((1 - timeValue) * maxFrameOffset);
        
        // Clamp to available frames
        const frameIdx = Math.min(frameOffset, this.frameHistory.length - 1);
        
        // Get the pixel from the historical frame at this offset
        if (frameIdx >= 0 && frameIdx < this.frameHistory.length) {
          const historicalFrame = this.frameHistory[frameIdx];
          
          // Copy the pixel from the historical frame
          resultData[pixelIndex] = historicalFrame.data[pixelIndex];
          resultData[pixelIndex + 1] = historicalFrame.data[pixelIndex + 1];
          resultData[pixelIndex + 2] = historicalFrame.data[pixelIndex + 2];
          resultData[pixelIndex + 3] = 255; // Full opacity
        } else {
          // Fall back to current frame if out of range
          resultData[pixelIndex] = sourceImage.data[pixelIndex];
          resultData[pixelIndex + 1] = sourceImage.data[pixelIndex + 1];
          resultData[pixelIndex + 2] = sourceImage.data[pixelIndex + 2];
          resultData[pixelIndex + 3] = sourceImage.data[pixelIndex + 3];
        }
      }
    }
    
    return new ImageData(resultData, width, height);
  }

  // Apply other effects
  private applyGenericEffect(sourceImage: ImageData, effectType: EffectType, audioValue: number, intensity: number): ImageData {
    if (!this.canvas) return sourceImage;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    const value = Math.min(Math.max(audioValue, 0), 1);
    
    // Create a temporary canvas for effect application
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;
    
    // Put source image on temp canvas
    tempCtx.putImageData(sourceImage, 0, 0);
    
    // Create result
    let resultImage: ImageData;
    
    switch (effectType) {
      case 'noise':
        // Apply noise effect
        const noiseData = new Uint8ClampedArray(sourceImage.data);
        
        for (let i = 0; i < noiseData.length; i += 4) {
          if (Math.random() > 0.5) {
            const noise = (Math.random() - 0.5) * intensity * 255 * value;
            noiseData[i] = Math.min(Math.max(sourceImage.data[i] + noise, 0), 255);
            noiseData[i + 1] = Math.min(Math.max(sourceImage.data[i + 1] + noise, 0), 255);
            noiseData[i + 2] = Math.min(Math.max(sourceImage.data[i + 2] + noise, 0), 255);
          }
        }
        
        resultImage = new ImageData(noiseData, width, height);
        break;
        
      case 'pixelate':
        // Calculate pixel size
        const pixelSize = Math.max(1, Math.floor(value * intensity));
        
        // Clear and draw pixelated version
        tempCtx.clearRect(0, 0, width, height);
        
        // First scale down
        tempCtx.drawImage(
          tempCanvas, 
          0, 0, width, height,
          0, 0, width / pixelSize, height / pixelSize
        );
        
        // Then scale back up with nearest neighbor
        tempCtx.imageSmoothingEnabled = false;
        tempCtx.drawImage(
          tempCanvas,
          0, 0, width / pixelSize, height / pixelSize,
          0, 0, width, height
        );
        
        resultImage = tempCtx.getImageData(0, 0, width, height);
        break;
        
      case 'rgb':
        // Apply RGB split
        const rgbData = new Uint8ClampedArray(sourceImage.data);
        const rgbOffset = Math.floor(value * intensity);
        
        if (rgbOffset === 0) {
          resultImage = sourceImage;
          break;
        }
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            
            // Shift red to the left
            const rX = x - rgbOffset;
            if (rX >= 0 && rX < width) {
              const rI = (y * width + rX) * 4;
              rgbData[i] = sourceImage.data[rI];
            }
            
            // Shift blue to the right
            const bX = x + rgbOffset;
            if (bX >= 0 && bX < width) {
              const bI = (y * width + bX) * 4;
              rgbData[i + 2] = sourceImage.data[bI + 2];
            }
          }
        }
        
        resultImage = new ImageData(rgbData, width, height);
        break;
        
      case 'blur':
        // Apply blur using a simple box blur for performance
        const blurRadius = Math.floor(value * intensity);
        
        if (blurRadius === 0) {
          resultImage = sourceImage;
          break;
        }
        
        // Use canvas blur filter
        tempCtx.filter = `blur(${blurRadius}px)`;
        tempCtx.clearRect(0, 0, width, height);
        tempCtx.putImageData(sourceImage, 0, 0);
        tempCtx.drawImage(tempCanvas, 0, 0);
        tempCtx.filter = 'none';
        
        resultImage = tempCtx.getImageData(0, 0, width, height);
        break;
        
      case 'shake':
        // Apply shake effect
        const shakeX = (Math.random() - 0.5) * value * intensity;
        const shakeY = (Math.random() - 0.5) * value * intensity;
        
        tempCtx.clearRect(0, 0, width, height);
        tempCtx.putImageData(sourceImage, shakeX, shakeY);
        
        resultImage = tempCtx.getImageData(0, 0, width, height);
        break;
        
      default:
        resultImage = sourceImage;
    }
    
    return resultImage;
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
