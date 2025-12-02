import React from 'react';
import { PlotFormData, PlotStructureType } from '../types';
import { PLOT_STRUCTURE_CONFIGS } from '../constants';
import { PlotStructureField } from './PlotStructureField';

interface PlotStructureSectionProps {
  structure: PlotStructureType;
  formData: PlotFormData;
  collapsedSections: Set<string>;
  isGenerating: string | null;
  onFieldChange: (fieldKey: keyof PlotFormData, value: string) => void;
  onToggleCollapse: (sectionId: string) => void;
  onAISupplement: (fieldKey: keyof PlotFormData, fieldLabel: string) => void;
  onCopy: (fieldKey: keyof PlotFormData) => void;
  onClear: (fieldKey: keyof PlotFormData) => void;
}

export const PlotStructureSection: React.FC<PlotStructureSectionProps> = ({
  structure,
  formData,
  collapsedSections,
  isGenerating,
  onFieldChange,
  onToggleCollapse,
  onAISupplement,
  onCopy,
  onClear,
}) => {
  const config = PLOT_STRUCTURE_CONFIGS[structure];

  return (
    <div className="space-y-6">
      {config.fields.map((field) => {
        const fieldKey = field.key as keyof PlotFormData;
        const value = formData[fieldKey];
        const isCollapsed = collapsedSections.has(fieldKey);
        const generatingKey = `supplement-${fieldKey}`;
        const isFieldGenerating = isGenerating === generatingKey;

        return (
          <PlotStructureField
            key={fieldKey}
            fieldKey={fieldKey}
            label={field.label}
            description={field.description}
            placeholder={field.placeholder}
            value={value}
            color={field.color}
            isCollapsed={isCollapsed}
            isGenerating={isFieldGenerating}
            formData={formData}
            onChange={(newValue) => onFieldChange(fieldKey, newValue)}
            onToggleCollapse={() => onToggleCollapse(fieldKey)}
            onAISupplement={() => onAISupplement(fieldKey, field.label)}
            onCopy={() => onCopy(fieldKey)}
            onClear={() => onClear(fieldKey)}
          />
        );
      })}
    </div>
  );
};

