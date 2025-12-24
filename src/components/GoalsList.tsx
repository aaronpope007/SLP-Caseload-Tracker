import { useState, useMemo } from 'react';
import {
  Grid,
  Typography,
  Card,
  CardContent,
  Button,
  Box,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import type { Goal } from '../types';
import { GoalCard } from './GoalCard';

interface RecentSessionData {
  date: string;
  accuracy?: number;
  correctTrials?: number;
  incorrectTrials?: number;
}

interface GoalsListProps {
  goals: Goal[];
  getRecentPerformance: (goalId: string) => { recentSessions: RecentSessionData[]; average: number | null };
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
  onCopyToSubGoal: (goal: Goal) => void;
  onAddSubGoal: (parentGoalId: string) => void;
  onEditSubGoal: (goal: Goal) => void;
  onDuplicateSubGoal: (goal: Goal) => void;
  onCopySubtree?: (goal: Goal) => void;
}

export const GoalsList = ({
  goals,
  getRecentPerformance,
  onEdit,
  onDelete,
  onCopyToSubGoal,
  onAddSubGoal,
  onEditSubGoal,
  onDuplicateSubGoal,
  onCopySubtree,
}: GoalsListProps) => {
  // State to track expanded goals and subgoals
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [expandedSubGoals, setExpandedSubGoals] = useState<Set<string>>(new Set());

  // Get all goal IDs that have subgoals (for expand all functionality)
  // Separate main goals and subgoals
  const { mainGoalIdsWithSubGoals, subGoalIdsWithSubGoals } = useMemo(() => {
    const mainGoals = goals.filter(g => !g.parentGoalId);
    const subGoals = goals.filter(g => g.parentGoalId);
    const subGoalsByParent = new Map<string, Goal[]>();
    subGoals.forEach(sub => {
      const parentId = sub.parentGoalId!;
      if (!subGoalsByParent.has(parentId)) {
        subGoalsByParent.set(parentId, []);
      }
      subGoalsByParent.get(parentId)!.push(sub);
    });
    
    const mainIds = new Set<string>();
    const subIds = new Set<string>();
    
    // Add main goals that have subgoals
    mainGoals.forEach(goal => {
      if ((subGoalsByParent.get(goal.id) || []).length > 0) {
        mainIds.add(goal.id);
      }
    });
    
    // Recursively find all subgoals that have their own subgoals
    const getAllNestedSubGoalIds = (goalId: string): string[] => {
      const result: string[] = [];
      const directSubs = subGoalsByParent.get(goalId) || [];
      directSubs.forEach(sub => {
        const nestedSubs = subGoalsByParent.get(sub.id) || [];
        if (nestedSubs.length > 0) {
          result.push(sub.id);
          result.push(...getAllNestedSubGoalIds(sub.id));
        }
      });
      return result;
    };
    
    mainGoals.forEach(goal => {
      const nestedIds = getAllNestedSubGoalIds(goal.id);
      nestedIds.forEach(id => subIds.add(id));
    });
    
    return { mainGoalIdsWithSubGoals: mainIds, subGoalIdsWithSubGoals: subIds };
  }, [goals]);

  const handleGoalExpandedChange = (goalId: string, expanded: boolean) => {
    setExpandedGoals(prev => {
      const newSet = new Set(prev);
      if (expanded) {
        newSet.add(goalId);
      } else {
        newSet.delete(goalId);
      }
      return newSet;
    });
  };

  const handleSubGoalExpandedChange = (goalId: string, expanded: boolean) => {
    setExpandedSubGoals(prev => {
      const newSet = new Set(prev);
      if (expanded) {
        newSet.add(goalId);
      } else {
        newSet.delete(goalId);
      }
      return newSet;
    });
  };

  const handleExpandAll = () => {
    const allMainExpanded = mainGoalIdsWithSubGoals.size > 0 && 
      Array.from(mainGoalIdsWithSubGoals).every(id => expandedGoals.has(id));
    const allSubExpanded = subGoalIdsWithSubGoals.size > 0 && 
      Array.from(subGoalIdsWithSubGoals).every(id => expandedSubGoals.has(id));
    const allExpanded = (mainGoalIdsWithSubGoals.size === 0 || allMainExpanded) &&
      (subGoalIdsWithSubGoals.size === 0 || allSubExpanded);
    
    if (allExpanded) {
      // Collapse all
      setExpandedGoals(new Set());
      setExpandedSubGoals(new Set());
    } else {
      // Expand all
      setExpandedGoals(new Set(mainGoalIdsWithSubGoals));
      setExpandedSubGoals(new Set(subGoalIdsWithSubGoals));
    }
  };

  if (goals.length === 0) {
    return (
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography color="text.secondary" align="center">
              No goals added yet. Click "Add Goal" to create one.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    );
  }

  // Organize goals: main goals first, then sub-goals grouped under parents
  const mainGoals = goals.filter(g => !g.parentGoalId);
  const subGoals = goals.filter(g => g.parentGoalId);
  const subGoalsByParent = new Map<string, Goal[]>();
  subGoals.forEach(sub => {
    const parentId = sub.parentGoalId!;
    if (!subGoalsByParent.has(parentId)) {
      subGoalsByParent.set(parentId, []);
    }
    subGoalsByParent.get(parentId)!.push(sub);
  });

  // Group main goals by domain for better organization
  const goalsByDomain = new Map<string, Goal[]>();
  const goalsWithoutDomain: Goal[] = [];
  mainGoals.forEach(goal => {
    if (goal.domain) {
      if (!goalsByDomain.has(goal.domain)) {
        goalsByDomain.set(goal.domain, []);
      }
      goalsByDomain.get(goal.domain)!.push(goal);
    } else {
      goalsWithoutDomain.push(goal);
    }
  });

  // Sort domains alphabetically
  const sortedDomains = Array.from(goalsByDomain.entries()).sort(([domainA], [domainB]) => 
    domainA.localeCompare(domainB)
  );

  const allMainExpanded = mainGoalIdsWithSubGoals.size > 0 && 
    Array.from(mainGoalIdsWithSubGoals).every(id => expandedGoals.has(id));
  const allSubExpanded = subGoalIdsWithSubGoals.size > 0 && 
    Array.from(subGoalIdsWithSubGoals).every(id => expandedSubGoals.has(id));
  const allExpanded = (mainGoalIdsWithSubGoals.size === 0 || allMainExpanded) &&
    (subGoalIdsWithSubGoals.size === 0 || allSubExpanded);

  return (
    <>
      {(mainGoalIdsWithSubGoals.size > 0 || subGoalIdsWithSubGoals.size > 0) && (
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={allExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={handleExpandAll}
              size="small"
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </Button>
          </Box>
        </Grid>
      )}
      {sortedDomains.map(([domain, domainGoals]) => (
        <Grid item xs={12} key={domain}>
          <Typography variant="h6" sx={{ mb: 1, mt: 1, fontSize: '1.5rem', fontWeight: 'bold' }}>
            {domain}
          </Typography>
          <Grid container spacing={2}>
            {domainGoals.map((goal) => {
              const subs = subGoalsByParent.get(goal.id) || [];
              return (
                <Grid item xs={12} md={6} key={goal.id}>
                  <GoalCard
                    goal={goal}
                    subGoals={subs}
                    allGoals={goals}
                    getRecentPerformance={getRecentPerformance}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onCopyToSubGoal={onCopyToSubGoal}
                    onAddSubGoal={onAddSubGoal}
                    onEditSubGoal={onEditSubGoal}
                    onDuplicateSubGoal={onDuplicateSubGoal}
                    onCopySubtree={onCopySubtree}
                    expanded={expandedGoals.has(goal.id)}
                    onExpandedChange={handleGoalExpandedChange}
                    expandedSubGoals={expandedSubGoals}
                    onSubGoalExpandedChange={handleSubGoalExpandedChange}
                  />
                </Grid>
              );
            })}
          </Grid>
        </Grid>
      ))}
      {goalsWithoutDomain.length > 0 && (
        <Grid item xs={12}>
          {goalsByDomain.size > 0 && (
            <Typography variant="h6" sx={{ mb: 1, mt: 1, fontSize: '1.5rem', fontWeight: 'bold' }}>
              Other Goals
            </Typography>
          )}
          <Grid container spacing={2}>
            {goalsWithoutDomain.map((goal) => {
              const subs = subGoalsByParent.get(goal.id) || [];
              return (
                <Grid item xs={12} md={6} key={goal.id}>
                  <GoalCard
                    goal={goal}
                    subGoals={subs}
                    allGoals={goals}
                    getRecentPerformance={getRecentPerformance}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onCopyToSubGoal={onCopyToSubGoal}
                    onAddSubGoal={onAddSubGoal}
                    onEditSubGoal={onEditSubGoal}
                    onDuplicateSubGoal={onDuplicateSubGoal}
                    onCopySubtree={onCopySubtree}
                    expanded={expandedGoals.has(goal.id)}
                    onExpandedChange={handleGoalExpandedChange}
                    expandedSubGoals={expandedSubGoals}
                    onSubGoalExpandedChange={handleSubGoalExpandedChange}
                  />
                </Grid>
              );
            })}
          </Grid>
        </Grid>
      )}
    </>
  );
};

