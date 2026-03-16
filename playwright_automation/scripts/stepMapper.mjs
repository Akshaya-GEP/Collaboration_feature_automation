/**
 * Step Definition Mapper for playwright_automation
 * Uses OpenAI or Azure OpenAI to map undefined Gherkin steps to existing step definitions.
 * Optionally applies converted steps to the feature file.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const STEP_DEF_DIR = path.join(ROOT, 'bdd', 'step-definitions');
const DEFAULT_FEATURE = path.join(ROOT, 'bdd', 'features', 'nodes', 'LLMNode.feature');

// Load .env from project root
const dotenvPath = path.join(ROOT, '.env');
if (fs.existsSync(dotenvPath)) {
    for (const line of fs.readFileSync(dotenvPath, 'utf-8').split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
    }
}

// Prefer Azure OpenAI for AI actions when configured (checked first in createClient)
const AZURE_OPENAI_CONFIG = {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
};

function isAzureConfig() {
    return (
        AZURE_OPENAI_CONFIG.endpoint &&
        AZURE_OPENAI_CONFIG.apiKey &&
        AZURE_OPENAI_CONFIG.deployment &&
        AZURE_OPENAI_CONFIG.apiVersion
    );
}

function getOpenAIKey() {
    return process.env.OPENAI_API_KEY || process.env.JUDGE_API_KEY || '';
}

function isOpenAIConfig() {
    return !!getOpenAIKey();
}

/**
 * Create OpenAI or Azure OpenAI client
 */
async function createClient() {
    const { OpenAI, AzureOpenAI } = await import('openai');
    if (isAzureConfig()) {
        return new AzureOpenAI({
            endpoint: AZURE_OPENAI_CONFIG.endpoint,
            apiKey: AZURE_OPENAI_CONFIG.apiKey,
            deployment: AZURE_OPENAI_CONFIG.deployment,
            apiVersion: AZURE_OPENAI_CONFIG.apiVersion,
        });
    }
    if (isOpenAIConfig()) {
        return new OpenAI({
            apiKey: getOpenAIKey(),
        });
    }
    throw new Error(
        'Set OPENAI_API_KEY or (AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY + AZURE_OPENAI_DEPLOYMENT + AZURE_OPENAI_API_VERSION) in .env to use the step mapper.'
    );
}

/**
 * Call chat completions (works for both OpenAI and Azure)
 */
async function chatComplete(client, options) {
    if (isAzureConfig()) {
        return client.chat.completions.create({
            ...options,
            model: AZURE_OPENAI_CONFIG.deployment,
        });
    }
    return client.chat.completions.create({
        ...options,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });
}

/**
 * Extract step definitions from .steps.ts files under stepDefDir
 */
function extractStepDefinitions(stepDefDir) {
    const stepDefs = [];
    function processFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const stepRegex = /(Given|When|Then)\s*\(\s*(['"`])(.*?)\2\s*,/g;
        let match;
        while ((match = stepRegex.exec(content)) !== null) {
            const keyword = match[1];
            const pattern = match[3];
            if (!stepDefs.some((s) => s.pattern === pattern)) {
                stepDefs.push({
                    keyword,
                    pattern,
                    file: path.relative(ROOT, filePath),
                });
            }
        }
    }
    function walkDir(dir) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walkDir(full);
            else if (entry.name.endsWith('.steps.ts') || entry.name.endsWith('.steps.js')) processFile(full);
        }
    }
    walkDir(stepDefDir);
    return stepDefs;
}

/**
 * Parse feature file and extract all steps (Given/When/Then/And/But)
 */
function extractFeatureSteps(featureFilePath) {
    const content = fs.readFileSync(featureFilePath, 'utf-8');
    const lines = content.split('\n');
    const steps = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const match = line.match(/^(Given|When|Then|And|But)\s+(.+)$/);
        if (match) {
            steps.push({
                keyword: match[1],
                text: match[2],
                lineNumber: i + 1,
                fullLine: line,
            });
        }
    }
    return { content, steps };
}

/**
 * Check if step text matches a step definition pattern (Cucumber-style {string}, {int}, {float})
 */
function matchesPattern(stepText, pattern) {
    let regexPattern = pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\{string\\}/g, '"([^"]*)"')
        .replace(/\\{int\\}/g, '(\\d+)')
        .replace(/\\{float\\}/g, '([\\d.]+)');
    try {
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(stepText);
    } catch {
        return false;
    }
}

/**
 * Map undefined steps to existing definitions using OpenAI/Azure
 */
async function mapStepsWithAI(undefinedSteps, existingStepDefs) {
    const client = await createClient();
    const stepDefList = existingStepDefs
        .map((sd, i) => `${i + 1}. [${sd.keyword}] ${sd.pattern}`)
        .join('\n');
    const undefinedList = undefinedSteps
        .map((s, i) => `${i + 1}. [${s.keyword}] ${s.text}`)
        .join('\n');

    const prompt = `You are a BDD/Cucumber expert. Map the following undefined Gherkin steps to the most appropriate existing step definitions.

## Existing Step Definitions:
${stepDefList}

## Undefined Steps:
${undefinedList}

## Instructions:
For each undefined step, provide: 1) matching existing pattern (if any), 2) transformed Gherkin step with concrete values, 3) confidence (high/medium/low). If no good match, set matchFound: false.

Respond in JSON only:
{
  "mappings": [
    {
      "original": "original step text",
      "lineNumber": 1,
      "matchFound": true,
      "matchedPattern": "I click on {string}",
      "convertedStep": "I click on \\"Proceed\\"",
      "confidence": "high",
      "explanation": "brief reason"
    }
  ],
  "summary": { "totalSteps": 10, "mapped": 8, "notMapped": 2 }
}`;

    const response = await chatComplete(client, {
        messages: [
            { role: 'system', content: 'You are an expert in BDD/Cucumber test automation. You map undefined steps to existing step definitions. Respond only with valid JSON.' },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 4000,
    });

    const text = response.choices[0]?.message?.content || '{}';
    return JSON.parse(text);
}

/**
 * Generate converted feature file content from mappings
 */
function generateConvertedFeature(originalContent, mappings) {
    const lines = originalContent.split('\n');
    for (const mapping of mappings.mappings || []) {
        if (mapping.matchFound && mapping.convertedStep) {
            const lineIndex = mapping.lineNumber - 1;
            if (lineIndex >= 0 && lineIndex < lines.length) {
                const originalLine = lines[lineIndex];
                const indent = (originalLine.match(/^\s*/) || [''])[0];
                const keywordMatch = originalLine.match(/^\s*(Given|When|Then|And|But)\s/);
                if (keywordMatch) {
                    const keyword = keywordMatch[1];
                    lines[lineIndex] = `${indent}${keyword} ${mapping.convertedStep}`;
                }
            }
        }
    }
    return lines.join('\n');
}

/**
 * Main: analyze feature, find undefined steps, call AI, report (and optionally apply)
 */
async function run(featurePath, stepDefPath, apply, outPath) {
    console.log('\nStep Mapper – analyzing feature file\n');

    const stepDefs = extractStepDefinitions(stepDefPath);
    console.log(`Loaded ${stepDefs.length} step definitions from ${path.relative(ROOT, stepDefPath)}\n`);

    const { content, steps } = extractFeatureSteps(featurePath);
    console.log(`Parsed ${steps.length} steps from ${path.relative(ROOT, featurePath)}\n`);

    const undefinedSteps = steps.filter((step) => !stepDefs.some((sd) => matchesPattern(step.text, sd.pattern)));

    if (undefinedSteps.length === 0) {
        console.log('All steps already have matching definitions.\n');
        return;
    }

    console.log(`${undefinedSteps.length} undefined step(s):\n`);
    undefinedSteps.forEach((s) => console.log(`   Line ${s.lineNumber}: ${s.fullLine}`));
    console.log('');

    console.log('Calling AI to map steps...\n');
    const mappings = await mapStepsWithAI(undefinedSteps, stepDefs);

    console.log('Mapping results:\n');
    for (const m of mappings.mappings || []) {
        const status = m.matchFound ? 'OK' : 'NO_MATCH';
        console.log(`  ${status} Line ${m.lineNumber}: ${m.original}`);
        if (m.matchFound) {
            console.log(`     -> ${m.convertedStep} (${m.confidence || '?'})`);
        }
    }
    const summary = mappings.summary || {};
    console.log(`\nSummary: ${summary.mapped ?? 0}/${summary.totalSteps ?? undefinedSteps.length} mapped\n`);

    if (apply && (summary.mapped ?? 0) > 0) {
        const converted = generateConvertedFeature(content, mappings);
        const targetPath = outPath || featurePath;
        fs.writeFileSync(targetPath, converted, 'utf-8');
        console.log(`Applied converted steps to ${path.relative(ROOT, targetPath)}\n`);
    }
}

// CLI
const args = process.argv.slice(2);
let featurePath = DEFAULT_FEATURE;
let apply = false;
let outPath = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') apply = true;
    else if (args[i] === '--out' && args[i + 1]) {
        outPath = path.resolve(ROOT, args[++i]);
    } else if (!args[i].startsWith('-')) {
        featurePath = path.resolve(ROOT, args[i]);
    }
}

const resolvedFeature = path.isAbsolute(featurePath) ? featurePath : path.join(ROOT, featurePath);
if (!fs.existsSync(resolvedFeature)) {
    console.error(`Feature file not found: ${resolvedFeature}`);
    process.exit(1);
}

run(resolvedFeature, STEP_DEF_DIR, apply, outPath).catch((err) => {
    console.error(err);
    process.exit(1);
});
