// Test file to debug exports
import fs from 'fs';

try {
    console.log('Testing apexUtils imports...');

    const module = await import('./src/utils/apexUtils.js');
    console.log('Available exports:', Object.keys(module));

    if (module.filterPatchNotes) {
        console.log('✅ filterPatchNotes is available');
    } else {
        console.log('❌ filterPatchNotes is NOT available');
    }

    if (module.formatContent) {
        console.log('✅ formatContent is available');
    } else {
        console.log('❌ formatContent is NOT available');
    }

} catch (error) {
    console.error('Import error:', error.message);
    console.error('Stack:', error.stack);
}
