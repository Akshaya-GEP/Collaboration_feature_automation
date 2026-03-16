import { AzureOpenAI } from 'openai';

/**
 * Azure OpenAI Configuration
 * Uses environment variables for connectivity.
 */
export const AZURE_OPENAI_CONFIG = {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
};
/**
 * Check if Azure OpenAI configuration is complete
 */
export function isAzureConfigured(): boolean {
    return !!(
        AZURE_OPENAI_CONFIG.endpoint &&
        AZURE_OPENAI_CONFIG.apiKey &&
        AZURE_OPENAI_CONFIG.deployment &&
        AZURE_OPENAI_CONFIG.apiVersion
    );
}

/**
 * Create Azure OpenAI client
 */
export function createAzureClient(): AzureOpenAI {
    if (!isAzureConfigured()) {
        throw new Error('Azure OpenAI not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, and AZURE_OPENAI_API_VERSION in .env');
    }

    return new AzureOpenAI({
        endpoint: AZURE_OPENAI_CONFIG.endpoint!,
        apiKey: AZURE_OPENAI_CONFIG.apiKey!,
        deployment: AZURE_OPENAI_CONFIG.deployment!,
        apiVersion: AZURE_OPENAI_CONFIG.apiVersion!,
    });
}
