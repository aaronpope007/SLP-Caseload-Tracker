import { useState, useCallback } from 'react';
import { goalTemplates } from '../utils/goalTemplates';

export const useGoalTemplate = (updateFormField: (field: keyof any, value: any) => void) => {
  const [selectedTemplate, setSelectedTemplate] = useState<typeof goalTemplates[0] | null>(null);
  const [templateFilterDomain, setTemplateFilterDomain] = useState<string>('');
  const [showRecommendedTemplates, setShowRecommendedTemplates] = useState(true);

  const useTemplate = useCallback((template: typeof goalTemplates[0]) => {
    setSelectedTemplate(template);
    updateFormField('description', template.description);
    updateFormField('baseline', template.suggestedBaseline || '');
    updateFormField('target', template.suggestedTarget || '');
    updateFormField('domain', template.domain);
  }, [updateFormField]);

  const clearTemplate = useCallback(() => {
    setSelectedTemplate(null);
  }, []);

  return {
    selectedTemplate,
    templateFilterDomain,
    showRecommendedTemplates,
    setTemplateFilterDomain,
    setShowRecommendedTemplates,
    useTemplate,
    clearTemplate,
  };
};

