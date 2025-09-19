#!/usr/bin/env node
/**
 * VPS Storage System Test Script
 * This script verifies that the VPS object storage system is working correctly
 */

const { storageService, StorageType } = require('./server/storageFactory');
const path = require('path');

async function testVpsStorage() {
  console.log('🧪 Testing VPS Object Storage System...\n');
  
  try {
    // Test 1: Storage Service Type
    console.log('1️⃣ Testing Storage Service Type...');
    const storageType = storageService.getType();
    console.log(`   Storage Type: ${storageType}`);
    console.log(`   ✅ Expected VPS storage: ${storageType === StorageType.VPS_LOCAL ? 'PASS' : 'FAIL'}\n`);
    
    // Test 2: Health Check
    console.log('2️⃣ Testing Storage Health Check...');
    const healthCheck = await storageService.healthCheck();
    console.log(`   Status: ${healthCheck.status}`);
    console.log(`   Type: ${healthCheck.type}`);
    if (healthCheck.error) {
      console.log(`   Error: ${healthCheck.error}`);
    }
    console.log(`   ✅ Health Check: ${healthCheck.status === 'healthy' ? 'PASS' : 'FAIL'}\n`);
    
    // Test 3: Storage Service Instance
    console.log('3️⃣ Testing Storage Service Instance...');
    const storage = await storageService.get();
    console.log(`   Service initialized: ${storage ? 'YES' : 'NO'}`);
    console.log(`   ✅ Instance creation: ${storage ? 'PASS' : 'FAIL'}\n`);
    
    // Test 4: Directory Configuration
    console.log('4️⃣ Testing Directory Configuration...');
    if (storage) {
      const publicPaths = storage.getPublicObjectSearchPaths();
      const privateDir = storage.getPrivateObjectDir();
      console.log(`   Public paths: ${publicPaths.join(', ')}`);
      console.log(`   Private directory: ${privateDir}`);
      console.log(`   ✅ Configuration: PASS\n`);
    } else {
      console.log(`   ❌ Configuration: FAIL - No storage instance\n`);
    }
    
    // Test 5: Environment Variables
    console.log('5️⃣ Testing Environment Variables...');
    const requiredVars = [
      'OBJECT_STORAGE_TYPE',
      'VPS_STORAGE_BASE_DIR', 
      'VPS_MAX_FILE_SIZE'
    ];
    
    let envScore = 0;
    requiredVars.forEach(varName => {
      const value = process.env[varName];
      console.log(`   ${varName}: ${value || 'NOT SET'}`);
      if (value) envScore++;
    });
    
    console.log(`   ✅ Environment: ${envScore}/${requiredVars.length} variables set\n`);
    
    // Summary
    console.log('📊 TEST SUMMARY:');
    console.log('==================');
    console.log(`✅ Storage Type: ${storageType}`);
    console.log(`✅ Health Status: ${healthCheck.status}`);
    console.log(`✅ Service Ready: ${storage ? 'YES' : 'NO'}`);
    console.log(`✅ Environment: ${envScore}/${requiredVars.length} vars configured`);
    
    if (storageType === StorageType.VPS_LOCAL && healthCheck.status === 'healthy' && storage) {
      console.log('\n🎉 VPS Object Storage System: FULLY OPERATIONAL');
    } else {
      console.log('\n⚠️  VPS Object Storage System: NEEDS CONFIGURATION');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testVpsStorage();