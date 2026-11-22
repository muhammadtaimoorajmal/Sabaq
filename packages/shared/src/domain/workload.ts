import type { TaskType } from '../schemas/task.js';
import { addDays, dayKeyOf, daysBetween, dayOfWeekOf, eachDay, type Instant } from './time.js';

/** Default effort per task type, from 1 (light) to 5 (very heavy). */
export const DEFAULT_TASK_EFFORT: Readonly<Record<TaskType, number>> = {
  exam: 5,
  project: 4,
  assignment: 3,
  quiz: 3,
  presentation: 3,
  lab: 2,
  other: 2,
  reading: 1,
};

export const LOAD_LEVELS = ['none', 'light', 'moderate', 'heavy', 'extreme'] as const;
export type LoadLevel = (typeof LOAD_LEVELS)[number];

/** Upper bound (inclusive) of each load level. Above the last bound is `extreme`. */
export const LOAD_THRESHOLDS = { none: 0, light: 3, moderate: 6, heavy: 9 } as const;

/** Longest range the workload functions accept, to protect against accidental huge requests. */
export const MAX_WORKLOAD_RANGE_DAYS = 400;

export interface WorkloadTask {
  id?: string;
  dueAt: Instant;
  type: TaskType;
  effort?: number | null;
}

export interface DailyLoad {
  date: string;
  taskCount: number;
  load: number;
  level: LoadLevel;
}

export function effortOf(task: Pick<WorkloadTask, 'type' | 'effort'>): number {
  return task.effort ?? DEFAULT_TASK_EFFORT[task.type];
}

export function loadLevelOf(load: number): LoadLevel {
  if (load <= LOAD_THRESHOLDS.none) return 'none';
  if (load <= LOAD_THRESHOLDS.light) return 'light';
  if (load <= LOAD_THRESHOLDS.moderate) return 'moderate';
  if (load <= LOAD_THRESHOLDS.heavy) return 'heavy';
  return 'extreme';
}

function assertRange(from: string, to: string): void {
  const days = daysBetween(from, to);
  if (days < 0) throw new RangeError('The range must end on or after its start');
  if (days >= MAX_WORKLOAD_RANGE_DAYS) {
    throw new RangeError(`The range may span at most ${MAX_WORKLOAD_RANGE_DAYS} days`);
  }
}

/**
 * Workload for every day from `from` to `to` (inclusive), including days with nothing due,
 * so a heatmap can render a complete calendar.
 */
export function computeDailyLoad(
  tasks: readonly WorkloadTask[],
  range: { from: string; to: string; timeZone: string },
): DailyLoad[] {
  assertRange(range.from, range.to);
  const totals = new Map<string, { taskCount: number; load: number }>();
  for (const task of tasks) {
    const date = dayKeyOf(task.dueAt, range.timeZone);
    const total = totals.get(date) ?? { taskCount: 0, load: 0 };
    total.taskCount += 1;
    total.load += effortOf(task);
    totals.set(date, total);
  }
  return eachDay(range.from, range.to).map((date) => {
    const { taskCount, load } = totals.get(date) ?? { taskCount: 0, load: 0 };
    return { date, taskCount, load, level: loadLevelOf(load) };
  });
}

export interface DueDateSuggestion {
  date: string;
  /** Days from the proposed date: negative is earlier, positive is later. */
  offsetDays: number;
  /** Load on that day if the new task were moved there. */
  projectedLoad: number;
  level: LoadLevel;
}

export interface DueDateAssessment {
  date: string;
  /** Load already on that day, before adding the new task. */
  existingLoad: number;
  existingTaskCount: number;
  projectedLoad: number;
  projectedLevel: LoadLevel;
  /** True when adding the task makes the day heavy or extreme. */
  isClash: boolean;
  /** Lighter nearby days, best first. Empty when there is no clash. */
  suggestions: DueDateSuggestion[];
}

export interface AssessDueDateOptions {
  timeZone: string;
  now: Instant;
  /** How many days before and after the proposed date to consider. Default 3. */
  windowDays?: number;
  /** Maximum number of suggestions. Default 3. */
  maxSuggestions?: number;
  /** Days of the week never to suggest (0 Sunday … 6 Saturday), e.g. weekends. */
  avoidDaysOfWeek?: readonly number[];
  /** Ignore this task when counting load (when an existing task's date is being edited). */
  ignoreTaskId?: string;
}

const CLASH_LEVELS: readonly LoadLevel[] = ['heavy', 'extreme'];

/**
 * Advises an instructor or class representative choosing a due date: how loaded the class
 * already is that day and, if adding the task would overload it, which nearby days are lighter.
 * Advisory only: the person decides.
 */
export function assessDueDate(
  tasks: readonly WorkloadTask[],
  proposed: Omit<WorkloadTask, 'id'>,
  options: AssessDueDateOptions,
): DueDateAssessment {
  const { timeZone, windowDays = 3, maxSuggestions = 3, avoidDaysOfWeek = [] } = options;
  const relevant = tasks.filter(
    (task) => options.ignoreTaskId === undefined || task.id !== options.ignoreTaskId,
  );
  const date = dayKeyOf(proposed.dueAt, timeZone);
  const today = dayKeyOf(options.now, timeZone);
  const effort = effortOf(proposed);

  const window = computeDailyLoad(relevant, {
    from: addDays(date, -windowDays),
    to: addDays(date, windowDays),
    timeZone,
  });
  const sameDay = relevant.filter((task) => dayKeyOf(task.dueAt, timeZone) === date);
  const existing = {
    load: sameDay.reduce((total, task) => total + effortOf(task), 0),
    taskCount: sameDay.length,
  };
  const projectedLoad = existing.load + effort;
  const projectedLevel = loadLevelOf(projectedLoad);
  const isClash = CLASH_LEVELS.includes(projectedLevel);

  const suggestions = isClash
    ? window
        .filter(
          (day) =>
            day.date !== date &&
            daysBetween(today, day.date) >= 0 &&
            !avoidDaysOfWeek.includes(dayOfWeekOf(day.date)) &&
            day.load + effort < projectedLoad,
        )
        .map((day) => ({
          date: day.date,
          offsetDays: daysBetween(date, day.date),
          projectedLoad: day.load + effort,
          level: loadLevelOf(day.load + effort),
        }))
        // Lightest first; then closest; then later dates, which give students more time.
        .sort(
          (a, b) =>
            a.projectedLoad - b.projectedLoad ||
            Math.abs(a.offsetDays) - Math.abs(b.offsetDays) ||
            b.offsetDays - a.offsetDays,
        )
        .slice(0, maxSuggestions)
    : [];

  return {
    date,
    existingLoad: existing.load,
    existingTaskCount: existing.taskCount,
    projectedLoad,
    projectedLevel,
    isClash,
    suggestions,
  };
}
