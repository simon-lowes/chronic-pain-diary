/**
 * Tracker Configuration
 * 
 * Context-aware labels, options, and UI configuration for each tracker type.
 * This ensures the UI adapts correctly when switching between trackers.
 */

import type { TrackerPresetId } from './tracker';
import type { GeneratedTrackerConfig, IntensityScale } from './generated-config';

// =============================================================================
// Shared Helper Functions (DRY - Don't Repeat Yourself)
// =============================================================================

/**
 * Build intensity label function based on intensity scale
 */
export function createIntensityLabelFn(
  labels: [string, string, string, string, string]
): (value: number) => string {
  return (value: number) => {
    if (value <= 2) return labels[0];
    if (value <= 4) return labels[1];
    if (value <= 6) return labels[2];
    if (value <= 8) return labels[3];
    return labels[4];
  };
}

/**
 * Build intensity color function based on color palette
 */
export function createIntensityColorFn(
  colors: [string, string, string, string, string]
): (value: number) => string {
  return (value: number) => {
    if (value <= 2) return colors[0];
    if (value <= 4) return colors[1];
    if (value <= 6) return colors[2];
    if (value <= 8) return colors[3];
    return colors[4];
  };
}

// Common color palettes
const HIGH_BAD_COLORS: [string, string, string, string, string] = [
  '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'
]; // green to red (high = bad)

const LOW_BAD_COLORS: [string, string, string, string, string] = [
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'
]; // red to green (low = bad)

// Common message templates (DRY)
const deleteConfirm = (entryType?: string) =>
  entryType
    ? `Are you sure you want to delete this ${entryType} entry? This action cannot be undone.`
    : 'Are you sure you want to delete this entry? This action cannot be undone.';

// =============================================================================
// TrackerConfig Interface
// =============================================================================

export interface TrackerConfig {
  // Form labels
  intensityLabel: string;
  intensityMinLabel: string;
  intensityMaxLabel: string;
  locationLabel: string;
  locationPlaceholder: string;
  triggersLabel: string;
  notesLabel: string;
  notesPlaceholder: string;
  
  // Button labels
  addButtonLabel: string;
  formTitle: string;
  
  // Empty state content
  emptyStateTitle: string;
  emptyStateDescription: string;
  emptyStateBullets: string[];
  
  // Card/detail labels
  entryTitle: string;
  deleteConfirmMessage: string;
  
  // Options
  locations: { value: string; label: string }[];
  triggers: string[];
  suggestedHashtags?: string[];
  
  // Intensity helpers
  getIntensityLabel: (value: number) => string;
  getIntensityColor: (value: number) => string;
}

// Chronic Pain configuration
const chronicPainConfig: TrackerConfig = {
  intensityLabel: 'Pain Intensity',
  intensityMinLabel: '1 - Minimal',
  intensityMaxLabel: '10 - Extreme',
  locationLabel: 'Location(s)',
  locationPlaceholder: 'Where is the pain?',
  triggersLabel: 'Possible Triggers',
  notesLabel: 'Notes',
  notesPlaceholder: 'Describe your pain, what you were doing, how you\'re feeling...',
  addButtonLabel: 'Log Pain Entry',
  formTitle: 'Log Pain Entry',
  emptyStateTitle: 'Welcome to Your Pain Diary',
  emptyStateDescription: 'Start tracking your pain journey by logging your first entry. Understanding your patterns can help you and your healthcare provider make informed decisions.',
  emptyStateBullets: [
    'Track pain intensity, location, and triggers',
    'Identify patterns over time',
    'Share your history with doctors',
  ],
  entryTitle: 'Pain Entry Details',
  deleteConfirmMessage: deleteConfirm('pain'),
  locations: [
    { value: 'head', label: 'Head' },
    { value: 'neck', label: 'Neck' },
    { value: 'shoulders', label: 'Shoulders' },
    { value: 'upper-back', label: 'Upper Back' },
    { value: 'lower-back', label: 'Lower Back' },
    { value: 'chest', label: 'Chest' },
    { value: 'abdomen', label: 'Abdomen' },
    { value: 'hips', label: 'Hips' },
    { value: 'arms', label: 'Arms' },
    { value: 'hands', label: 'Hands' },
    { value: 'legs', label: 'Legs' },
    { value: 'knees', label: 'Knees' },
    { value: 'feet', label: 'Feet' },
  ],
  triggers: [
    'Stress', 'Weather', 'Physical Activity', 'Sleep Issues', 'Diet',
    'Medication Change', 'Prolonged Sitting', 'Cold', 'Heat',
  ],
  getIntensityLabel: createIntensityLabelFn(['Minimal', 'Mild', 'Moderate', 'Severe', 'Extreme']),
  getIntensityColor: createIntensityColorFn(HIGH_BAD_COLORS),
};

// Mood & Mental Health configuration
const moodConfig: TrackerConfig = {
  intensityLabel: 'Mood Level',
  intensityMinLabel: '1 - Very Low',
  intensityMaxLabel: '10 - Excellent',
  locationLabel: 'Category',
  locationPlaceholder: 'What best describes your mood?',
  triggersLabel: 'Contributing Factors',
  notesLabel: 'Reflections',
  notesPlaceholder: 'How are you feeling? What\'s on your mind?',
  addButtonLabel: 'Log Mood',
  formTitle: 'Log Mood Entry',
  emptyStateTitle: 'Welcome to Your Mood Tracker',
  emptyStateDescription: 'Start tracking your emotional wellbeing by logging your first entry. Understanding your mood patterns can help you identify what affects your mental health.',
  emptyStateBullets: [
    'Track mood levels and emotional states',
    'Identify triggers and patterns',
    'Build self-awareness over time',
  ],
  entryTitle: 'Mood Entry Details',
  deleteConfirmMessage: deleteConfirm('mood'),
  locations: [
    { value: 'anxiety', label: 'Anxiety' },
    { value: 'depression', label: 'Depression' },
    { value: 'stress', label: 'Stress' },
    { value: 'calm', label: 'Calm' },
    { value: 'happy', label: 'Happy' },
    { value: 'neutral', label: 'Neutral' },
    { value: 'irritable', label: 'Irritable' },
    { value: 'hopeful', label: 'Hopeful' },
    { value: 'overwhelmed', label: 'Overwhelmed' },
  ],
  triggers: [
    'Work', 'Relationships', 'Sleep', 'Exercise', 'Social Media',
    'Isolation', 'Therapy', 'Meditation', 'Weather', 'News',
  ],
  getIntensityLabel: createIntensityLabelFn(['Very Low', 'Low', 'Okay', 'Good', 'Excellent']),
  getIntensityColor: createIntensityColorFn(LOW_BAD_COLORS),
};

// Sleep configuration
const sleepConfig: TrackerConfig = {
  intensityLabel: 'Sleep Quality',
  intensityMinLabel: '1 - Terrible',
  intensityMaxLabel: '10 - Perfect',
  locationLabel: 'Sleep Type',
  locationPlaceholder: 'How was your sleep?',
  triggersLabel: 'Sleep Factors',
  notesLabel: 'Notes',
  notesPlaceholder: 'Any dreams, interruptions, or things affecting your sleep?',
  addButtonLabel: 'Log Sleep',
  formTitle: 'Log Sleep Entry',
  emptyStateTitle: 'Welcome to Your Sleep Tracker',
  emptyStateDescription: 'Start tracking your sleep quality by logging your first entry. Understanding your sleep patterns can help improve your rest and overall health.',
  emptyStateBullets: [
    'Track sleep quality and duration',
    'Identify factors affecting your sleep',
    'Improve your sleep hygiene',
  ],
  entryTitle: 'Sleep Entry Details',
  deleteConfirmMessage: deleteConfirm('sleep'),
  locations: [
    { value: 'insomnia', label: 'Insomnia' },
    { value: 'restful', label: 'Restful' },
    { value: 'disturbed', label: 'Disturbed' },
    { value: 'oversleep', label: 'Oversleep' },
    { value: 'nap', label: 'Nap' },
    { value: 'nightmare', label: 'Nightmare' },
    { value: 'light-sleep', label: 'Light Sleep' },
    { value: 'deep-sleep', label: 'Deep Sleep' },
  ],
  triggers: [
    'Caffeine', 'Screen Time', 'Stress', 'Exercise', 'Late Meal',
    'Alcohol', 'Medication', 'Noise', 'Temperature', 'Anxiety',
  ],
  getIntensityLabel: createIntensityLabelFn(['Terrible', 'Poor', 'Fair', 'Good', 'Perfect']),
  getIntensityColor: createIntensityColorFn(LOW_BAD_COLORS),
};

// Menstrual Cycle configuration
const menstrualConfig: TrackerConfig = {
  intensityLabel: 'Symptom Intensity',
  intensityMinLabel: '1 - Minimal',
  intensityMaxLabel: '10 - Severe',
  locationLabel: 'Cycle Phase / Symptoms',
  locationPlaceholder: 'What are you experiencing?',
  triggersLabel: 'Related Factors',
  notesLabel: 'Notes',
  notesPlaceholder: 'How are you feeling? Any patterns you notice?',
  addButtonLabel: 'Log Cycle Entry',
  formTitle: 'Log Cycle Entry',
  emptyStateTitle: 'Welcome to Your Cycle Tracker',
  emptyStateDescription: 'Start tracking your menstrual cycle by logging your first entry. Understanding your patterns can help you plan ahead and identify health changes.',
  emptyStateBullets: [
    'Track cycle phases and symptoms',
    'Predict upcoming periods',
    'Share patterns with healthcare providers',
  ],
  entryTitle: 'Cycle Entry Details',
  deleteConfirmMessage: deleteConfirm('cycle'),
  locations: [
    { value: 'period', label: 'Period' },
    { value: 'ovulation', label: 'Ovulation' },
    { value: 'pms', label: 'PMS' },
    { value: 'cramps', label: 'Cramps' },
    { value: 'bloating', label: 'Bloating' },
    { value: 'headache', label: 'Headache' },
    { value: 'fatigue', label: 'Fatigue' },
    { value: 'mood-swings', label: 'Mood Swings' },
    { value: 'spotting', label: 'Spotting' },
  ],
  triggers: [
    'Stress', 'Diet', 'Exercise', 'Sleep', 'Hydration',
    'Medication', 'Hormones', 'Travel', 'Weather',
  ],
  getIntensityLabel: createIntensityLabelFn(['Minimal', 'Mild', 'Moderate', 'Severe', 'Extreme']),
  getIntensityColor: createIntensityColorFn(HIGH_BAD_COLORS),
};

// Medication configuration
const medicationConfig: TrackerConfig = {
  intensityLabel: 'Effectiveness',
  intensityMinLabel: '1 - No Effect',
  intensityMaxLabel: '10 - Very Effective',
  locationLabel: 'Medication Type',
  locationPlaceholder: 'What type of medication?',
  triggersLabel: 'Side Effects',
  notesLabel: 'Notes',
  notesPlaceholder: 'Dosage, timing, how you felt after taking it...',
  addButtonLabel: 'Log Medication',
  formTitle: 'Log Medication Entry',
  emptyStateTitle: 'Welcome to Your Medication Tracker',
  emptyStateDescription: 'Start tracking your medications by logging your first entry. Keeping a record helps you understand effectiveness and side effects.',
  emptyStateBullets: [
    'Track medication effectiveness',
    'Monitor side effects',
    'Keep records for doctor visits',
  ],
  entryTitle: 'Medication Entry Details',
  deleteConfirmMessage: deleteConfirm('medication'),
  locations: [
    { value: 'prescription', label: 'Prescription' },
    { value: 'otc', label: 'Over-the-Counter' },
    { value: 'supplement', label: 'Supplement' },
    { value: 'vitamin', label: 'Vitamin' },
    { value: 'painkiller', label: 'Painkiller' },
    { value: 'antibiotic', label: 'Antibiotic' },
    { value: 'antidepressant', label: 'Antidepressant' },
    { value: 'other', label: 'Other' },
  ],
  triggers: [
    'Nausea', 'Drowsiness', 'Headache', 'Dizziness', 'Appetite Change',
    'Mood Change', 'Skin Reaction', 'None', 'Other',
  ],
  getIntensityLabel: createIntensityLabelFn(['No Effect', 'Slight', 'Moderate', 'Good', 'Very Effective']),
  getIntensityColor: createIntensityColorFn(LOW_BAD_COLORS),
};

// Exercise configuration
const exerciseConfig: TrackerConfig = {
  intensityLabel: 'Workout Intensity',
  intensityMinLabel: '1 - Very Light',
  intensityMaxLabel: '10 - Maximum',
  locationLabel: 'Activity Type',
  locationPlaceholder: 'What did you do?',
  triggersLabel: 'How You Felt',
  notesLabel: 'Notes',
  notesPlaceholder: 'Duration, distance, reps, how you felt during/after...',
  addButtonLabel: 'Log Exercise',
  formTitle: 'Log Exercise Entry',
  emptyStateTitle: 'Welcome to Your Exercise Tracker',
  emptyStateDescription: 'Start tracking your workouts by logging your first entry. Monitoring your exercise helps you stay consistent and track progress.',
  emptyStateBullets: [
    'Track workout intensity and type',
    'Monitor progress over time',
    'Build healthy habits',
  ],
  entryTitle: 'Exercise Entry Details',
  deleteConfirmMessage: deleteConfirm('exercise'),
  locations: [
    { value: 'cardio', label: 'Cardio' },
    { value: 'strength', label: 'Strength' },
    { value: 'flexibility', label: 'Flexibility' },
    { value: 'walking', label: 'Walking' },
    { value: 'running', label: 'Running' },
    { value: 'cycling', label: 'Cycling' },
    { value: 'swimming', label: 'Swimming' },
    { value: 'yoga', label: 'Yoga' },
    { value: 'sports', label: 'Sports' },
    { value: 'hiit', label: 'HIIT' },
  ],
  triggers: [
    'Energized', 'Tired', 'Sore', 'Accomplished', 'Struggled',
    'Personal Best', 'Recovery Day', 'Outdoor', 'Gym', 'Home',
  ],
  getIntensityLabel: createIntensityLabelFn(['Very Light', 'Light', 'Moderate', 'Hard', 'Maximum']),
  getIntensityColor: createIntensityColorFn(HIGH_BAD_COLORS), // higher = warmer colors for effort
};

// Default/custom tracker configuration
const defaultConfig: TrackerConfig = {
  intensityLabel: 'Level',
  intensityMinLabel: '1 - Low',
  intensityMaxLabel: '10 - High',
  locationLabel: 'Category',
  locationPlaceholder: 'Select a category',
  triggersLabel: 'Tags',
  notesLabel: 'Notes',
  notesPlaceholder: 'Add any notes or details...',
  addButtonLabel: 'Log Entry',
  formTitle: 'Log Entry',
  emptyStateTitle: 'Welcome to Your Tracker',
  emptyStateDescription: 'Start tracking by logging your first entry. Understanding your patterns over time can provide valuable insights.',
  emptyStateBullets: [
    'Track levels and patterns',
    'Identify trends over time',
    'Keep a personal record',
  ],
  entryTitle: 'Entry Details',
  deleteConfirmMessage: deleteConfirm(),
  locations: [
    { value: 'general', label: 'General' },
    { value: 'positive', label: 'Positive' },
    { value: 'negative', label: 'Negative' },
    { value: 'neutral', label: 'Neutral' },
  ],
  triggers: ['Note', 'Important', 'Follow-up', 'Recurring'],
  getIntensityLabel: createIntensityLabelFn(['Very Low', 'Low', 'Medium', 'High', 'Very High']),
  getIntensityColor: createIntensityColorFn(['#6366f1', '#8b5cf6', '#a855f7', '#c026d3', '#db2777']), // purple gradient
};

// Map preset IDs to their configurations
const configMap: Record<TrackerPresetId, TrackerConfig> = {
  chronic_pain: chronicPainConfig,
  mood: moodConfig,
  sleep: sleepConfig,
  menstrual_cycle: menstrualConfig,
  medication: medicationConfig,
  exercise: exerciseConfig,
};

/**
 * Get intensity labels based on scale type
 */
function getIntensityLabels(scale: IntensityScale): string[] {
  if (scale === 'high_bad') {
    return ['Normal', 'Mild', 'Moderate', 'Elevated', 'High'];
  }
  if (scale === 'low_bad') {
    return ['Very Low', 'Low', 'Moderate', 'Good', 'Excellent'];
  }
  return ['Very Light', 'Light', 'Moderate', 'Intense', 'Maximum'];
}

/**
 * Build intensity label function based on scale type
 */
function buildIntensityLabelFn(scale: IntensityScale): (value: number) => string {
  const labels = getIntensityLabels(scale);
  
  return (value: number) => {
    if (value <= 2) return labels[0];
    if (value <= 4) return labels[1];
    if (value <= 6) return labels[2];
    if (value <= 8) return labels[3];
    return labels[4];
  };
}

/**
 * Get intensity color palette based on scale type
 */
function getIntensityColors(scale: IntensityScale): string[] {
  if (scale === 'high_bad') {
    // High is bad (like pain) - green to red
    return ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
  }
  if (scale === 'low_bad') {
    // Low is bad (like mood) - red to green
    return ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
  }
  // Neutral - use purple gradient
  return ['#6366f1', '#8b5cf6', '#a855f7', '#c026d3', '#db2777'];
}

/**
 * Get color from palette based on value
 */
function getColorFromPalette(colors: string[], value: number): string {
  if (value <= 2) return colors[0];
  if (value <= 4) return colors[1];
  if (value <= 6) return colors[2];
  if (value <= 8) return colors[3];
  return colors[4];
}

/**
 * Build intensity color function based on scale type
 */
function buildIntensityColorFn(scale: IntensityScale): (value: number) => string {
  const colors = getIntensityColors(scale);
  return (value: number) => getColorFromPalette(colors, value);
}

/**
 * Build a TrackerConfig from a GeneratedTrackerConfig
 */
export function buildConfigFromGenerated(generated: GeneratedTrackerConfig): TrackerConfig {
  return {
    intensityLabel: generated.intensityLabel,
    intensityMinLabel: generated.intensityMinLabel,
    intensityMaxLabel: generated.intensityMaxLabel,
    locationLabel: generated.locationLabel,
    locationPlaceholder: generated.locationPlaceholder,
    triggersLabel: generated.triggersLabel,
    notesLabel: generated.notesLabel,
    notesPlaceholder: generated.notesPlaceholder,
    addButtonLabel: generated.addButtonLabel,
    formTitle: generated.formTitle,
    emptyStateTitle: generated.emptyStateTitle,
    emptyStateDescription: generated.emptyStateDescription,
    emptyStateBullets: generated.emptyStateBullets,
    entryTitle: generated.entryTitle,
    deleteConfirmMessage: generated.deleteConfirmMessage,
    locations: generated.locations,
    triggers: generated.triggers,
    getIntensityLabel: buildIntensityLabelFn(generated.intensityScale),
    getIntensityColor: buildIntensityColorFn(generated.intensityScale),
  };
}

/**
 * Get the configuration for a tracker based on its preset_id or generated config
 */
export function getTrackerConfig(
  presetId: TrackerPresetId | null | undefined,
  generatedConfig?: GeneratedTrackerConfig | null
): TrackerConfig {
  // If we have a generated config, use it
  if (generatedConfig) {
    return buildConfigFromGenerated(generatedConfig);
  }
  
  // Otherwise fall back to preset or default
  if (!presetId) {
    return defaultConfig;
  }
  return configMap[presetId] ?? defaultConfig;
}
