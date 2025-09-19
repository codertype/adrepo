#!/usr/bin/env node
import { AutoGitSync } from './auto-git-sync.js';
import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function main() {
  console.log('🚀 Amrit Dairy Auto Git Sync Tool');
  console.log('=====================================\n');
  
  const sync = new AutoGitSync();
  
  try {
    console.log('1️⃣  Check sync status');
    console.log('2️⃣  Perform full sync');
    console.log('3️⃣  Exit\n');
    
    const choice = await ask('Choose an option (1-3): ');
    
    switch (choice) {
      case '1':
        console.log('\n🔍 Checking repository status...\n');
        const changes = await sync.showStatus();
        
        if (changes.toUpdate.length > 0 || changes.toAdd.length > 0) {
          const proceed = await ask('\n❓ Would you like to sync these changes? (y/n): ');
          if (proceed.toLowerCase() === 'y' || proceed.toLowerCase() === 'yes') {
            console.log('\n🔄 Starting sync...\n');
            await sync.performSync();
          }
        }
        break;
        
      case '2':
        console.log('\n⚠️  This will sync all changes from the Amrit-Dairy-System repository.');
        console.log('📋 A backup will be created before making any changes.');
        
        const confirm = await ask('\n❓ Are you sure you want to proceed? (y/n): ');
        if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
          console.log('\n🔄 Starting full sync...\n');
          const result = await sync.performSync();
          
          if (result.success) {
            console.log('\n✅ Sync completed successfully!');
            if (result.backupPath) {
              console.log(`💾 Backup saved to: ${result.backupPath}`);
              console.log('🔄 You can rollback if needed using the rollback command.');
            }
          } else {
            console.log('\n❌ Sync failed:', result.error);
          }
        }
        break;
        
      case '3':
        console.log('👋 Goodbye!');
        break;
        
      default:
        console.log('❌ Invalid option');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

// Handle rollback command
if (process.argv[2] === 'rollback') {
  console.log('🔄 Rollback functionality...');
  console.log('📁 Available backups in .sync-backup/ directory:');
  
  try {
    const backupDir = path.join(process.cwd(), '.sync-backup');
    const backups = await fs.readdir(backupDir);
    
    if (backups.length === 0) {
      console.log('❌ No backups found');
    } else {
      backups.forEach((backup, index) => {
        console.log(`${index + 1}. ${backup}`);
      });
      
      const rl2 = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl2.question('Choose backup to restore (number): ', async (choice) => {
        const backupIndex = parseInt(choice) - 1;
        if (backupIndex >= 0 && backupIndex < backups.length) {
          console.log(`🔄 Restoring from ${backups[backupIndex]}...`);
          console.log('⚠️  Manual restore required - copy files from backup directory');
          console.log(`📁 Backup location: ${path.join(backupDir, backups[backupIndex])}`);
        } else {
          console.log('❌ Invalid selection');
        }
        rl2.close();
      });
    }
  } catch (error) {
    console.error('❌ Error accessing backups:', error.message);
  }
} else {
  main();
}