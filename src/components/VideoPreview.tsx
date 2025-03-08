import React, { useState, useRef, useEffect } from 'react';
import { Upload, LayoutPanelLeft } from 'lucide-react';
import videoEffects from '@/lib/videoEffects';
import { AudioFeatures } from '@/lib/audioProcessor';

interface VideoPreviewProps {
  audioFeatures: AudioFeatures;
  isAudioPlaying: boolean;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ audioFeatures, isAudioPlaying }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeaturesRef = useRef<AudioFeatures>(audioFeatures);
  const isPlayingRef = useRef<boolean>(isAudioPlaying);
  
  // Update audioFeaturesRef whenever audioFeatures changes
  useEffect(() => {
    audioFeaturesRef.current = audioFeatures;
  }, [audioFeatures]);

  // Update isPlayingRef whenever isAudioPlaying changes
  useEffect(() => {
    isPlayingRef.current = isAudioPlaying;
  }, [isAudioPlaying]);
  
  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
    }
  };
  
  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('video/')) {
        setVideoFile(file);
        const url = URL.createObjectURL(file);
        setVideoSrc(url);
      }
    }
  };
  
  // Set up video and canvas when video is loaded
  useEffect(() => {
    if (videoRef.current && canvasRef.current && videoSrc) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const handleVideoLoad = () => {
        // Initialize video effects with our canvas and video
        videoEffects.setupCanvas(canvas, video);
        
        // Use a ref to ensure we always get the latest audio features
        videoEffects.startProcessing(() => {
          // Convert AudioFeatures to Record<string, number> by explicitly creating an object
          // Always use the current ref value to get the latest audio features
          const currentFeatures = audioFeaturesRef.current;
          console.log('currentFeatures', currentFeatures);
          // 如果音频暂停，返回所有参数为0的效果
          if (!isPlayingRef.current) {
            return {
              kick: 0,
              snare: 0,
              hihat: 0,
              bass: 0,
              mids: 0,
              treble: 0,
              energy: 0,
              rhythm: 0
            };
          }
          return {
            kick: currentFeatures.kick,
            snare: currentFeatures.snare,
            hihat: currentFeatures.hihat,
            bass: currentFeatures.bass,
            mids: currentFeatures.mids,
            treble: currentFeatures.treble,
            energy: currentFeatures.energy,
            rhythm: currentFeatures.rhythm
          };
        });
        
        // Loop the video
        video.loop = true;
        
        // Ensure the video has enough frames for the Time Machine effect
        video.playbackRate = 1.0;
      };
      
      video.addEventListener('loadeddata', handleVideoLoad);
      
      return () => {
        video.removeEventListener('loadeddata', handleVideoLoad);
        videoEffects.stopProcessing();
        if (videoSrc) {
          URL.revokeObjectURL(videoSrc);
        }
      };
    }
  }, [videoSrc]);

  // 监听音频播放状态变化
  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      if (isAudioPlaying) {
        video.play().catch(err => {
          console.error('Error playing video:', err);
        });
      } else {
        video.pause();
      }
    }
  }, [isAudioPlaying]);

  return (
    <div className="glass-panel rounded-lg p-4 h-full w-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Video Preview</h3>
        <label className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
          <Upload size={18} />
          <span className="text-sm">Upload Video</span>
          <input 
            type="file" 
            accept="video/*" 
            className="hidden" 
            onChange={handleFileUpload}
          />
        </label>
      </div>
      
      <div 
        className={`flex-1 rounded-md overflow-hidden relative flex items-center justify-center ${isDragging ? 'border-2 border-primary' : 'border border-dashed border-muted'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {videoSrc ? (
          <>
            <video 
              ref={videoRef}
              src={videoSrc} 
              className="hidden"
            />
            <canvas 
              ref={canvasRef}
              className="max-w-full max-h-full"
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <LayoutPanelLeft size={32} className="text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-2">No video selected</p>
            <p className="text-xs text-muted-foreground">
              Drag and drop a video file, or click "Upload Video"
            </p>
          </div>
        )}
      </div>
      
      {videoFile && (
        <div className="mt-2 text-sm text-muted-foreground">
          {videoFile.name}
        </div>
      )}
    </div>
  );
};

export default VideoPreview;
