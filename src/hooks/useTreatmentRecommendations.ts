import { useCallback } from 'react';
import type { GoalProgressData } from '../utils/gemini';
import { getSessionsByStudent } from '../utils/storage-api';

interface UseTreatmentRecommendationsParams {
  studentId: string;
  selectedSchool: string;
  goals: Array<{
    id: string;
    description: string;
    baseline: string;
    target: string;
    status: string;
  }>;
  apiKey: string;
  setError: (error: string) => void;
  generateTreatmentRecs: (goalProgressData: GoalProgressData[]) => Promise<void>;
}

export const useTreatmentRecommendations = ({
  studentId,
  selectedSchool,
  goals,
  apiKey,
  setError,
  generateTreatmentRecs,
}: UseTreatmentRecommendationsParams) => {
  const handleGenerateTreatmentRecommendations = useCallback(async () => {
    if (!apiKey) {
      setError('Please set your Gemini API key in Settings');
      return;
    }

    try {
      // Convert goals to GoalProgressData format
      const studentSessions = studentId ? await getSessionsByStudent(studentId, selectedSchool) : [];
      const goalProgressData: GoalProgressData[] = goals.map(goal => {
        const goalSessions = studentSessions.filter(s => s.goalsTargeted.includes(goal.id));
        const latestPerf = goalSessions
          .flatMap(s => s.performanceData.filter(p => p.goalId === goal.id))
          .filter(p => p.accuracy !== undefined)
          .sort((a, b) => {
            const dateA = studentSessions.find(s => s.performanceData.includes(a))?.date || '';
            const dateB = studentSessions.find(s => s.performanceData.includes(b))?.date || '';
            return dateB.localeCompare(dateA);
          })[0];

        const baselineNum = parseFloat(goal.baseline) || 0;
        const targetNum = parseFloat(goal.target) || 100;
        const currentNum = latestPerf?.accuracy || baselineNum;

        return {
          goalDescription: goal.description,
          baseline: baselineNum,
          target: targetNum,
          current: currentNum,
          sessions: goalSessions.length,
          status: goal.status,
          performanceHistory: goalSessions.slice(0, 5).map(s => {
            const perf = s.performanceData.find(p => p.goalId === goal.id);
            return {
              date: s.date,
              accuracy: perf?.accuracy || 0,
              correctTrials: perf?.correctTrials,
              incorrectTrials: perf?.incorrectTrials,
              notes: perf?.notes || s.notes,
            };
          }),
        };
      });

      await generateTreatmentRecs(goalProgressData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate treatment recommendations');
    }
  }, [studentId, selectedSchool, goals, apiKey, setError, generateTreatmentRecs]);

  return { handleGenerateTreatmentRecommendations };
};

