/**
 * validationConfig.ts
 * Common validation rules for LLM validation. Used by all feature scenarios
 * so rules are not repeated in each scenario or in each turns JSON.
 * Configure once here; scenarios only reference the validation file (load turns from JSON).
 */

export interface ValidationRules {
    /** Minimum score per turn (0–100) for multi-turn validation. */
    minScorePerTurn: number;
    /** Minimum response length (structural check). */
    minLength: number;
    /** Default chat input selector (placeholder or CSS). */
    userQuerySelector: string;
    /** Default agent response selector (CSS). */
    agentResponseSelector: string;
}

/** Common validation rules – single source of truth for all LLM validation scenarios. */
export const VALIDATION_RULES: ValidationRules = {
    minScorePerTurn: 70,
    minLength: 10,
    userQuerySelector: 'Type your message here... (press enter to send)',
    agentResponseSelector: 'p.mb-0',
};

export default VALIDATION_RULES;
