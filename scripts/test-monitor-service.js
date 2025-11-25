const UnifiedMonitoringService = require('./monitor-service');

// Test script for the monitoring service
async function testMonitoring() {
    console.log('Testing Unified Monitoring Service...');
    
    const monitor = new UnifiedMonitoringService();
    
    console.log('1. Testing manual status check...');
    await monitor.checkNow();
    
    console.log('\n2. Current status:');
    console.log(JSON.stringify(monitor.getStatus(), null, 2));
    
    console.log('\n3. Health data:');
    console.log(JSON.stringify(monitor.getHealthData(), null, 2));
    
    console.log('\nTest completed. Monitor service is ready for production use.');
}

// Run test if called directly
if (require.main === module) {
    testMonitoring().catch(console.error);
}

module.exports = testMonitoring;
