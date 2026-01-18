import { useState, useCallback } from 'react';
import {
  generateGoalSuggestions,
  generateTreatmentRecommendations,
  generateIEPGoals,
  type GoalProgressData,
} from '../utils/gemini';
import { logError } from '../utils/logger';
import { getErrorMessage } from '../utils/validators';

interface UseAIFeaturesOptions {
  apiKey: string;
  studentName: string;
  studentAge: number;
  studentGrade: string;
}

export const useAIFeatures = ({ apiKey, studentName, studentAge, studentGrade }: UseAIFeaturesOptions) => {
  // Goal Suggestions
  const [goalSuggestions, setGoalSuggestions] = useState('');
  const [goalArea, setGoalArea] = useState('');
  const [loadingGoalSuggestions, setLoadingGoalSuggestions] = useState(false);
  const [goalSuggestionsError, setGoalSuggestionsError] = useState('');

  // Treatment Recommendations
  const [treatmentRecommendations, setTreatmentRecommendations] = useState('');
  const [loadingTreatmentRecs, setLoadingTreatmentRecs] = useState(false);
  const [treatmentRecsError, setTreatmentRecsError] = useState('');

  // IEP Goals
  const [iepGoals, setIepGoals] = useState('');
  const [assessmentData, setAssessmentData] = useState('');
  const [loadingIepGoals, setLoadingIepGoals] = useState(false);
  const [iepGoalsError, setIepGoalsError] = useState('');

  const generateSuggestions = useCallback(async (goalArea: string, concerns: string[] = []) => {
    if (!apiKey) {
      setGoalSuggestionsError('API key is required. Please configure it in Settings.');
      return;
    }

    setLoadingGoalSuggestions(true);
    setGoalSuggestionsError('');
    setGoalArea(goalArea);

    try {
      const suggestions = await generateGoalSuggestions(
        apiKey,
        goalArea,
        studentAge,
        studentGrade,
        concerns
      );
      setGoalSuggestions(suggestions);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logError('Failed to generate goal suggestions', err);
      setGoalSuggestionsError(errorMessage);
    } finally {
      setLoadingGoalSuggestions(false);
    }
  }, [apiKey, studentAge, studentGrade]);

  const generateTreatmentRecs = useCallback(async (goals: GoalProgressData[]) => {
    if (!apiKey) {
      setTreatmentRecsError('API key is required. Please configure it in Settings.');
      return;
    }

    setLoadingTreatmentRecs(true);
    setTreatmentRecsError('');

    try {
      const recommendations = await generateTreatmentRecommendations(
        apiKey,
        studentName,
        studentAge,
        goals
      );
      setTreatmentRecommendations(recommendations);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logError('Failed to generate treatment recommendations', err);
      setTreatmentRecsError(errorMessage);
    } finally {
      setLoadingTreatmentRecs(false);
    }
  }, [apiKey, studentName, studentAge]);

  const generateIEPGoalsFromAssessment = useCallback(async (assessmentData: string, concerns: string[] = []) => {
    if (!apiKey) {
      setIepGoalsError('API key is required. Please configure it in Settings.');
      return;
    }

    setLoadingIepGoals(true);
    setIepGoalsError('');
    setAssessmentData(assessmentData);

    try {
      const goals = await generateIEPGoals(
        apiKey,
        studentName,
        studentAge,
        studentGrade,
        assessmentData,
        concerns
      );
      setIepGoals(goals);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logError('Failed to generate IEP goals', err);
      setIepGoalsError(errorMessage);
    } finally {
      setLoadingIepGoals(false);
    }
  }, [apiKey, studentName, studentAge, studentGrade]);

  return {
    // Goal Suggestions
    goalSuggestions,
    goalArea,
    loadingGoalSuggestions,
    goalSuggestionsError,
    generateSuggestions,
    setGoalArea,
    setGoalSuggestions,

    // Treatment Recommendations
    treatmentRecommendations,
    loadingTreatmentRecs,
    treatmentRecsError,
    generateTreatmentRecs,
    setTreatmentRecommendations,
    setTreatmentRecsError,

    // IEP Goals
    iepGoals,
    assessmentData,
    loadingIepGoals,
    iepGoalsError,
    generateIEPGoalsFromAssessment,
    setAssessmentData,
    setIepGoals,
  };
};

