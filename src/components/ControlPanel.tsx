
import React from 'react';
import AudioAnalyzer from './AudioAnalyzer';
import EffectMapper from './EffectMapper';
import { Info } from 'lucide-react';
import { AudioFeatures } from '@/lib/audioProcessor';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ControlPanelProps {
  onFeaturesUpdate: (features: AudioFeatures) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ onFeaturesUpdate }) => {
  return (
    <div className="flex flex-col gap-4 w-full">
      <AudioAnalyzer onFeaturesUpdate={onFeaturesUpdate} />
      
      <EffectMapper />
      
      <div className="glass-panel rounded-lg p-4">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="instructions" className="border-b-0">
            <AccordionTrigger className="py-2">
              <div className="flex items-center gap-2">
                <Info size={16} />
                <span>How to use</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              <ol className="list-decimal list-inside space-y-2">
                <li>Upload an audio file to analyze</li>
                <li>Upload a video to apply effects to</li>
                <li>Map audio features (like kick, bass) to visual effects</li>
                <li>Adjust intensity sliders to control the strength of each effect</li>
                <li>Play the audio to see the synchronized visual effects</li>
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
};

export default ControlPanel;
