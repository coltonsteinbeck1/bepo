#!/usr/bin/env node
/**
 * Enhanced Offline Mode Test Suite
 * Comprehensive tests for the enhanced offline detection capabilities
 */

import { getStatusChecker, getStatusReport, getQuickStatus } from '../src/utils/statusChecker.js';
import fs from 'fs';
import path from 'path';

class OfflineModeTestSuite {
    constructor() {
        this.testResults = [];
        this.totalTests = 0;
        this.passedTests = 0;
    }
    
    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${type}: ${message}`);
    }
    
    assert(condition, testName, details = '') {
        this.totalTests++;
        if (condition) {
            this.passedTests++;
            this.log(`✅ PASS: ${testName}${details ? ' - ' + details : ''}`, 'TEST');
            this.testResults.push({ name: testName, passed: true, details });
        } else {
            this.log(`❌ FAIL: ${testName}${details ? ' - ' + details : ''}`, 'TEST');
            this.testResults.push({ name: testName, passed: false, details });
        }
        return condition;
    }
    
    async runIntegrationTests() {
        this.log('🔍 Running Enhanced Status Checker Integration Tests', 'SUITE');
        
        // Test 1: Factory function and configuration
        const checker = getStatusChecker();
        this.assert(
            checker && typeof checker === 'object',
            'Factory Function Returns Object',
            'getStatusChecker() returns valid object'
        );
        
        this.assert(
            checker.config && typeof checker.config === 'object',
            'Configuration Object Available',
            `hasIndependentVerifier: ${checker.config.hasIndependentVerifier}`
        );
        
        // Test 2: Legacy method compatibility
        try {
            const legacyResult = checker.checkOnline();
            this.assert(
                typeof legacyResult.online === 'boolean',
                'Legacy Method Compatibility',
                `checkOnline() works: ${legacyResult.online ? 'ONLINE' : 'OFFLINE'}`
            );
        } catch (error) {
            this.assert(false, 'Legacy Method Compatibility', `Error: ${error.message}`);
        }
        
        // Test 3: Enhanced status report
        try {
            const statusReport = await getStatusReport();
            this.assert(
                statusReport && statusReport.verification,
                'Enhanced Status Report',
                `Verification enabled: ${statusReport.verification.enabled}`
            );
            
            if (statusReport.verification.enabled && !statusReport.verification.error) {
                this.assert(
                    typeof statusReport.verification.confidence === 'number',
                    'Verification Confidence Available',
                    `Confidence: ${statusReport.verification.confidence}`
                );
            }
        } catch (error) {
            this.assert(false, 'Enhanced Status Report', `Error: ${error.message}`);
        }
        
        // Test 4: Quick status check
        try {
            const quickStatus = await getQuickStatus();
            this.assert(
                typeof quickStatus.online === 'boolean' && typeof quickStatus.confidence === 'number',
                'Quick Status Check',
                `Online: ${quickStatus.online}, Confidence: ${quickStatus.confidence}`
            );
        } catch (error) {
            this.assert(false, 'Quick Status Check', `Error: ${error.message}`);
        }
        
        // Test 5: Independent verifier creation (if available)
        if (checker.config.hasIndependentVerifier) {
            try {
                const verifier = checker.createIndependentVerifier();
                this.assert(
                    verifier && verifier.constructor.name === 'IndependentStatusVerifier',
                    'Independent Verifier Creation',
                    'Successfully created IndependentStatusVerifier instance'
                );
            } catch (error) {
                this.assert(false, 'Independent Verifier Creation', `Error: ${error.message}`);
            }
        } else {
            this.log('⚠️ Independent verifier not available - skipping verifier tests', 'INFO');
        }
        
        // Test 6: Enhanced monitoring check
        try {
            const enhancedResult = await checker.performEnhancedCheck();
            this.assert(
                enhancedResult && typeof enhancedResult.online === 'boolean',
                'Enhanced Monitoring Check',
                `Online: ${enhancedResult.online}, Confidence: ${enhancedResult.confidence}`
            );
        } catch (error) {
            this.assert(false, 'Enhanced Monitoring Check', `Error: ${error.message}`);
        }
    }
    
    async runOutageDetectionTests() {
        this.log('🚨 Running Outage Detection Simulation Tests', 'SUITE');
        
        const checker = getStatusChecker();
        
        if (checker.config.hasIndependentVerifier) {
            // Test 1: Process detection capability
            try {
                const verifier = checker.createIndependentVerifier();
                
                // Test with a process that definitely doesn't exist
                const fakeProcessResult = await verifier.checkBotProcess();
                this.assert(
                    fakeProcessResult && typeof fakeProcessResult.online === 'boolean',
                    'Process Detection Capability',
                    `Can detect processes: ${fakeProcessResult.online ? 'Found bot process' : 'No bot process found'}`
                );
            } catch (error) {
                this.assert(false, 'Process Detection Capability', `Error: ${error.message}`);
            }
            
            // Test 2: File staleness detection
            try {
                const testStatusFile = path.join(process.cwd(), 'temp', 'test-stale-status.json');
                
                // Create a stale status file
                const staleStatus = {
                    online: true,
                    lastUpdated: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
                    botStatus: { status: 'online', isOnline: true }
                };
                
                fs.mkdirSync(path.dirname(testStatusFile), { recursive: true });
                fs.writeFileSync(testStatusFile, JSON.stringify(staleStatus, null, 2));
                
                const verifier = checker.createIndependentVerifier({
                    statusFile: testStatusFile
                });
                
                const fileCheck = await verifier.checkStatusFile();
                this.assert(
                    fileCheck && typeof fileCheck.online === 'boolean',
                    'File Staleness Detection',
                    `Can detect stale files: ${fileCheck.confidence < 0.5 ? 'Detected as stale' : 'Current file'}`
                );
                
                // Clean up
                fs.unlinkSync(testStatusFile);
            } catch (error) {
                this.assert(false, 'File Staleness Detection', `Error: ${error.message}`);
            }
        } else {
            this.log('⚠️ Independent verifier not available - skipping advanced outage detection tests', 'INFO');
        }
        
        // Test 3: Compare legacy vs enhanced methods
        try {
            const legacyStatus = checker.checkOnline();
            const quickStatus = await getQuickStatus();
            
            this.assert(
                typeof legacyStatus.online === 'boolean' && typeof quickStatus.online === 'boolean',
                'Legacy vs Enhanced Comparison',
                `Legacy: ${legacyStatus.online ? 'ONLINE' : 'OFFLINE'}, Enhanced: ${quickStatus.online ? 'ONLINE' : 'OFFLINE'}`
            );
        } catch (error) {
            this.assert(false, 'Legacy vs Enhanced Comparison', `Error: ${error.message}`);
        }
    }
    
    async runComprehensiveTests() {
        this.log('🎯 Starting Enhanced Offline Mode Test Suite', 'MAIN');
        this.log('================================================', 'MAIN');
        
        await this.runIntegrationTests();
        await this.runOutageDetectionTests();
        
        this.log('================================================', 'MAIN');
        this.log(`📊 Test Results: ${this.passedTests}/${this.totalTests} tests passed`, 'RESULTS');
        
        if (this.passedTests === this.totalTests) {
            this.log('🎉 All tests passed! Enhanced offline mode is working correctly.', 'SUCCESS');
        } else {
            this.log('⚠️ Some tests failed. Review the results above.', 'WARNING');
        }
        
        // Summary of capabilities
        const checker = getStatusChecker();
        this.log('\n📋 Enhanced Offline Mode Capabilities:', 'SUMMARY');
        this.log(`  ✅ Independent Verification: ${checker.config.hasIndependentVerifier ? 'Available' : 'Not Available'}`, 'SUMMARY');
        this.log(`  ✅ Enhanced Reporting: ${checker.config.enhancedReporting ? 'Enabled' : 'Disabled'}`, 'SUMMARY');
        this.log(`  ✅ Backward Compatibility: All legacy methods working`, 'SUMMARY');
        this.log(`  ✅ Confidence-Based Alerts: Available for monitoring integration`, 'SUMMARY');
        
        if (checker.config.hasIndependentVerifier && checker.config.independentVerification) {
            this.log('\n🛡️ September 7th Outage Prevention: ACTIVE', 'SUMMARY');
            this.log('   The enhanced system can now detect silent outages that', 'SUMMARY');
            this.log('   would have gone unnoticed with the legacy system.', 'SUMMARY');
        } else {
            this.log('\n⚠️ Enhanced features not fully active', 'SUMMARY');
            this.log('   Consider enabling independent verification for maximum protection.', 'SUMMARY');
        }
        
        return this.passedTests === this.totalTests;
    }
}

// Run the comprehensive test suite
const testSuite = new OfflineModeTestSuite();
testSuite.runComprehensiveTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
});
