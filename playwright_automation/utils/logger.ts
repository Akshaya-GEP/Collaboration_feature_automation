/**
 * Simple themed logger for beautiful console output
 */
export const Logger = {
    info: (msg: string) => console.log(`\x1b[34mℹ️  LOG: ${msg}\x1b[0m`),
    success: (msg: string) => console.log(`\x1b[32m✅ SUCCESS: ${msg}\x1b[0m`),
    warn: (msg: string) => console.log(`\x1b[33m⚠️  WARN: ${msg}\x1b[0m`),
    error: (msg: string) => console.error(`\x1b[31m❌ ERROR: ${msg}\x1b[0m`),
    step: (msg: string) => console.log(`\x1b[36m🚀 STEP: ${msg}\x1b[0m`),
    api: (msg: string) => console.log(`\x1b[35m📡 API: ${msg}\x1b[0m`),
    divider: () => console.log('\x1b[90m' + '─'.repeat(50) + '\x1b[0m'),
};

export default Logger;
