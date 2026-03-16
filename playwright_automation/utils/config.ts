import dotenv from 'dotenv';
import path from 'path';

// Initialize dotenv from the root of playwright_automation
dotenv.config();

/**
 * Centralized Configuration for the Automation Framework
 */
export const CONFIG = {
    BASE_URL: process.env.BASE_URL || 'https://api-build.gep.com', // fallback
    USER_ID: process.env.USER_ID || '',
    PASSWORD: process.env.PASSWORD || '',
    JUDGE_API_KEY: process.env.JUDGE_API_KEY || '',

    // Default timeouts
    TIMEOUTS: {
        SHORT: 5000,
        MEDIUM: 15000,
        LONG: 30000,
        NETWORK: 60000,
        LLM_RESPONSE: 120000,
    },

    // AI Events wait (optional): regex string for "AI Events (N)" pill; empty = use default, "off"/"none" = no pill, use networkidle only
    AI_EVENTS_PILL_REGEX: process.env.AI_EVENTS_PILL_REGEX ?? '',
    AI_EVENTS_TIMEOUT_MS: parseInt(process.env.AI_EVENTS_TIMEOUT_MS || '180000', 10),

    // Paths
    PATHS: {
        DATA_NODES: path.resolve(process.cwd(), 'bdd/data/nodes'),
    }
};

export default CONFIG;
