#!/usr/bin/env node

/**
 * Run Feature – select a feature file, auto-map undefined steps, then run tests
 * Same flow as leo-test-framework's run-with-mcp: auto-map with step definitions, then run.
 *
 * Usage:
 *   npm run run:feature                    # list features, select one, auto-map + run
 *   npm run run:feature -- path/to/file.feature   # run specific feature (auto-map then run)
 *   npm run run:feature -- path/to/file.feature --no-map   # run without auto-mapping
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const FEATURES_DIR = path.join(ROOT, 'bdd', 'features');
const STEP_DEF_DIR = path.join(ROOT, 'bdd', 'step-definitions');

function findFeatureFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findFeatureFiles(full));
        } else if (entry.name.endsWith('.feature')) {
            results.push(full);
        }
    }
    return results.sort();
}

function ask(rl, question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

function runStepMapper(featurePath, apply = true) {
    const applyFlag = apply ? '--apply' : '';
    const args = [path.relative(ROOT, featurePath)].filter(Boolean);
    if (applyFlag) args.push(applyFlag);
    return new Promise((resolve, reject) => {
        const child = spawn('node', ['scripts/stepMapper.mjs', ...args], {
            cwd: ROOT,
            stdio: 'inherit',
            shell: true,
        });
        child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`stepMapper exited ${code}`))));
        child.on('error', reject);
    });
}

function runCucumber(featurePath, headed = false) {
    const relPath = path.relative(ROOT, featurePath);
    const env = { ...process.env };
    if (headed) env.HEADED = '1';

    const cucumberBin = path.join(ROOT, 'node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber-js');
    const args = [
        '--import', 'tsx',
        cucumberBin,
        relPath,
        '--import', 'bdd/support/hooks.ts',
        '--import', 'bdd/step-definitions/**/*.steps.ts',
    ];

    return spawn('node', args, {
        cwd: ROOT,
        stdio: 'inherit',
        shell: true,
        env,
    });
}

async function main() {
    const args = process.argv.slice(2);
    let featurePathArg = null;
    let skipMap = false;
    let headed = false;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--no-map') skipMap = true;
        else if (args[i] === '--headed') headed = true;
        else if (!args[i].startsWith('-')) featurePathArg = args[i];
    }

    let selectedPath;
    if (featurePathArg) {
        selectedPath = path.isAbsolute(featurePathArg) ? featurePathArg : path.join(ROOT, featurePathArg);
        if (!fs.existsSync(selectedPath)) {
            console.error(`Feature file not found: ${selectedPath}`);
            process.exit(1);
        }
    } else {
        const featureFiles = findFeatureFiles(FEATURES_DIR);
        if (featureFiles.length === 0) {
            console.error('No .feature files found under bdd/features');
            process.exit(1);
        }
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        console.log('\n');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║   Playwright Automation — Interactive Feature Runner      ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('📂 Available feature files:\n');
        featureFiles.forEach((f, i) => {
            const relative = path.relative(FEATURES_DIR, f);
            console.log(`  [${i + 1}] ${relative}`);
        });
        console.log('');
        const choice = await ask(rl, '👉 Select a feature file (number): ');
        rl.close();
        const index = parseInt(choice, 10) - 1;
        if (!isNaN(index) && index >= 0 && index < featureFiles.length) {
            selectedPath = featureFiles[index];
        } else if (choice.trim()) {
            selectedPath = path.isAbsolute(choice.trim()) ? choice.trim() : path.join(ROOT, choice.trim());
            if (!fs.existsSync(selectedPath)) {
                console.error(`File not found: ${selectedPath}`);
                process.exit(1);
            }
        } else {
            console.error('Invalid selection');
            process.exit(1);
        }
    }

    const relativePath = path.relative(ROOT, selectedPath);
    console.log(`\n✅ Feature: ${relativePath}\n`);

    if (!skipMap) {
        console.log('🔄 Auto-mapping undefined steps to step definitions...\n');
        try {
            await runStepMapper(selectedPath, true);
        } catch (e) {
            console.warn('Step mapper finished with issues; continuing to run tests.\n');
        }
    }

    console.log('🧪 Running tests...\n');
    const proc = runCucumber(selectedPath, headed);
    proc.on('close', (code) => process.exit(code ?? 0));
    proc.on('error', (err) => {
        console.error(err);
        process.exit(1);
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
