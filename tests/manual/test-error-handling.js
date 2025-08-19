#!/usr/bin/env node

// Manual test script to validate error handling
import errorHandler, { safeAsync, handleDiscordError, handleDatabaseError } from './src/utils/errorHandler.js';

console.log('🧪 Starting Error Handler Validation Tests...\n');

async function runTests() {
    // Test 1: Safe Async with successful operation
    console.log('Test 1: Safe Async - Success Case');
    const result1 = await safeAsync(async () => {
        return 'success';
    }, 'fallback', 'test1');
    console.log(`✅ Result: ${result1}\n`);

    // Test 2: Safe Async with error and fallback
    console.log('Test 2: Safe Async - Error with Fallback');
    const result2 = await safeAsync(async () => {
        throw new Error('Test error');
    }, 'fallback_value', 'test2');
    console.log(`✅ Result: ${result2}\n`);

    // Test 3: Discord Error Handling
    console.log('Test 3: Discord Error Handling');
    const discordError = new Error('Missing permissions');
    discordError.code = 50013;
    const isRetryable = handleDiscordError(discordError, null, 'test3');
    console.log(`✅ Retryable: ${isRetryable}\n`);

    // Test 4: Database Error Handling
    console.log('Test 4: Database Error Handling');
    const dbError = new Error('Connection timeout');
    const isDbRetryable = handleDatabaseError(dbError, 'test_operation');
    console.log(`✅ DB Retryable: ${isDbRetryable}\n`);

    // Test 5: Health Status
    console.log('Test 5: Health Status Check');
    const health = errorHandler.getHealthStatus();
    console.log(`✅ Health Status:`, {
        healthy: health.healthy,
        errorCount: health.errorCount,
        uptime: `${Math.floor(health.uptime)} seconds`
    });
    console.log();

    // Test 6: Error Tracking
    console.log('Test 6: Error Tracking');
    const highErrorRate = errorHandler.trackError('test_error_type');
    console.log(`✅ High error rate detected: ${highErrorRate}\n`);

    console.log('🎉 All tests completed successfully!');
    console.log('💡 You can now test the bot with the /test-errors command in Discord');
    console.log('   Available test types:');
    console.log('   - uncaught: Test uncaught exception handling');
    console.log('   - promise: Test unhandled promise rejection');
    console.log('   - discord: Test Discord error handling');
    console.log('   - database: Test database error handling');
    console.log('   - safe_async: Test safe async wrapper');
    console.log('   - health: View health status');
}

runTests().catch(console.error);
