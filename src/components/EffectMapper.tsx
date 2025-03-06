
import React, { useState, useEffect } from 'react';
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import videoEffects, { EFFECTS, EffectType } from '@/lib/videoEffects';

const EffectMapper: React.FC = () => {
  const [config, setConfig] = useState(videoEffects.getConfig());
  const [expanded, setExpanded] = useState<number[]>([0]);

  // Update the effect configuration in the video effects module when it changes
  useEffect(() => {
    const { mappings } = config;
    mappings.forEach((mapping, index) => {
      videoEffects.updateMapping(index, mapping);
    });
  }, [config]);

  const toggleExpand = (index: number) => {
    setExpanded(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const updateMapping = (index: number, updates: Partial<typeof config.mappings[0]>) => {
    setConfig(prev => {
      const newMappings = [...prev.mappings];
      newMappings[index] = { ...newMappings[index], ...updates };
      return { ...prev, mappings: newMappings };
    });
  };

  return (
    <div className="glass-panel rounded-lg p-4 w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Effect Mapping</h3>
      </div>
      
      <div className="space-y-3">
        {config.mappings.map((mapping, index) => {
          const effect = EFFECTS[mapping.effectType];
          const isExpanded = expanded.includes(index);
          
          return (
            <div 
              key={index}
              className="border border-border rounded-md overflow-hidden transition-all duration-200"
            >
              <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/20"
                onClick={() => toggleExpand(index)}
              >
                <div className="flex items-center gap-3">
                  <Switch 
                    checked={mapping.enabled}
                    onCheckedChange={(checked) => {
                      updateMapping(index, { enabled: checked });
                      if (checked && !isExpanded) {
                        toggleExpand(index);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div>
                    <div className="font-medium capitalize">{mapping.audioFeature}</div>
                    <div className="text-xs text-muted-foreground">
                      {mapping.enabled 
                        ? `Mapped to ${effect.name}` 
                        : 'Not mapped'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {mapping.enabled && (
                    <div className="px-2 py-1 bg-muted/30 rounded text-xs font-medium">
                      {effect.icon} {effect.name}
                    </div>
                  )}
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>
              
              {isExpanded && (
                <div className="p-3 pt-0 border-t border-border/50 space-y-4 animate-slide-in">
                  <div className="pt-3">
                    <div className="text-sm mb-2">Map to Effect</div>
                    <Select
                      value={mapping.effectType}
                      onValueChange={(value: EffectType) => {
                        updateMapping(index, { 
                          effectType: value,
                          intensity: EFFECTS[value].defaultValue
                        });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an effect" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(EFFECTS).map((effect) => (
                          <SelectItem 
                            key={effect.type} 
                            value={effect.type}
                          >
                            <div className="flex items-center gap-2">
                              <span>{effect.icon}</span>
                              <span>{effect.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="text-xs text-muted-foreground mt-1">
                      {effect.description}
                    </div>
                  </div>
                  
                  {mapping.effectType !== 'none' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm">Intensity</div>
                        <div className="text-xs text-muted-foreground">
                          {mapping.intensity.toFixed(effect.type === 'noise' ? 2 : 0)}
                        </div>
                      </div>
                      <Slider
                        value={[mapping.intensity]}
                        min={effect.minValue}
                        max={effect.maxValue}
                        step={effect.type === 'noise' ? 0.01 : 1}
                        onValueChange={(value) => {
                          updateMapping(index, { intensity: value[0] });
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EffectMapper;
