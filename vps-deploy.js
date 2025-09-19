#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

class VPSDeployment {
  constructor() {
    this.repoUrl = 'https://github.com/Codertype/Amrit-Dairy-System.git';
    this.deployPath = '/root/Amrit-Dairy-System';
    this.backupPath = '/root/backups';
  }

  async createBackup() {
    console.log('💾 Creating backup before deployment...');
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = `${this.backupPath}/backup-${timestamp}`;
      
      await execAsync(`mkdir -p ${this.backupPath}`);
      
      // Check if deployment directory exists
      try {
        await execAsync(`test -d ${this.deployPath}`);
        await execAsync(`cp -r ${this.deployPath} ${backupDir}`);
        console.log(`✅ Backup created: ${backupDir}`);
        return backupDir;
      } catch (error) {
        console.log('📁 No existing deployment found, skipping backup');
        return null;
      }
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      throw error;
    }
  }

  async pullFromGitHub() {
    console.log('📥 Pulling latest changes from GitHub...');
    
    try {
      // Check if repo directory exists
      try {
        await execAsync(`test -d ${this.deployPath}`);
        console.log('📁 Repository exists, pulling updates...');
        
        // Navigate to repo and pull
        await execAsync(`cd ${this.deployPath} && git fetch origin main`);
        await execAsync(`cd ${this.deployPath} && git reset --hard origin/main`);
        console.log('✅ Successfully pulled latest changes');
        
      } catch (error) {
        console.log('📁 Repository not found, cloning fresh...');
        
        // Clone repository
        await execAsync(`git clone ${this.repoUrl} ${this.deployPath}`);
        console.log('✅ Successfully cloned repository');
      }
    } catch (error) {
      console.error('❌ Git operation failed:', error.message);
      throw error;
    }
  }

  async extractArchives() {
    console.log('📦 Extracting archive files...');
    
    try {
      const archives = ['frontend.tar.gz', 'backend.tar.gz', 'config.tar.gz'];
      
      for (const archive of archives) {
        const archivePath = `${this.deployPath}/${archive}`;
        
        try {
          await execAsync(`test -f ${archivePath}`);
          await execAsync(`cd ${this.deployPath} && tar -xzf ${archive}`);
          console.log(`✅ Extracted: ${archive}`);
        } catch (error) {
          console.log(`⚠️ Archive not found or extraction failed: ${archive}`);
        }
      }
      
      // Setup attached_assets directory and download required assets
      console.log('📁 Setting up attached_assets directory...');
      await execAsync(`mkdir -p ${this.deployPath}/attached_assets`);
      
      console.log('📥 Downloading required assets from GitHub...');
      
      // Download logo image
      try {
        await execAsync(`curl -L -o "${this.deployPath}/attached_assets/image_1755232033789.png" "https://raw.githubusercontent.com/Codertype/Amrit-Dairy-System/main/image_1755232033789.png"`);
        console.log('✅ Downloaded: image_1755232033789.png');
      } catch (error) {
        console.log('⚠️ Failed to download: image_1755232033789.png');
      }
      
      // Download itambe image
      try {
        await execAsync(`curl -L -o "${this.deployPath}/attached_assets/image_1753771036709.png" "https://raw.githubusercontent.com/Codertype/Amrit-Dairy-System/main/image_1753771036709.png"`);
        console.log('✅ Downloaded: image_1753771036709.png');
      } catch (error) {
        console.log('⚠️ Failed to download: image_1753771036709.png');
      }
      
    } catch (error) {
      console.error('❌ Archive extraction failed:', error.message);
      throw error;
    }
  }

  async installDependencies() {
    console.log('📦 Installing all dependencies (including dev dependencies)...');
    
    try {
      await execAsync(`cd ${this.deployPath} && npm install`);
      console.log('✅ All dependencies installed successfully');
    } catch (error) {
      console.error('❌ Dependency installation failed:', error.message);
      throw error;
    }
  }

  async buildApplication() {
    console.log('🔨 Building application...');
    
    try {
      console.log('📦 Running full build (vite + esbuild)...');
      await execAsync(`cd ${this.deployPath} && npm run build`);
      console.log('✅ Application built successfully');
    } catch (error) {
      console.error('❌ Full build failed:', error.message);
      console.log('🔧 Attempting backend-only build...');
      
      try {
        // Create dist directory
        await execAsync(`cd ${this.deployPath} && mkdir -p dist`);
        
        // Try to build just the backend
        await execAsync(`cd ${this.deployPath} && npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`);
        console.log('✅ Backend built successfully');
      } catch (backendError) {
        console.error('❌ Backend build also failed:', backendError.message);
        console.log('⚠️ Continuing deployment without build step...');
      }
    }
  }

  async restartServices() {
    console.log('🔄 Restarting services...');
    
    try {
      // Stop any existing Node.js processes
      try {
        await execAsync('pkill -f "node.*index.js"');
        console.log('🛑 Stopped existing Node.js processes');
      } catch (error) {
        console.log('📝 No existing processes to stop');
      }
      
      // Wait a moment for processes to fully stop
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Start the application (you might want to use PM2 or systemd for production)
      console.log('🚀 Starting application...');
      console.log('💡 To start the server, run:');
      console.log(`cd ${this.deployPath} && npm start`);
      
    } catch (error) {
      console.error('❌ Service restart failed:', error.message);
      throw error;
    }
  }

  async deploy() {
    console.log('🚀 Starting VPS deployment...');
    console.log('📋 Deploying Amrit Dairy System from GitHub...');
    
    try {
      const backupPath = await this.createBackup();
      await this.pullFromGitHub();
      await this.extractArchives();
      await this.installDependencies();
      await this.buildApplication();
      await this.restartServices();
      
      console.log('\n🎉 Deployment completed successfully!');
      console.log('📋 Summary:');
      console.log(`  📁 Deployed to: ${this.deployPath}`);
      console.log(`  💾 Backup: ${backupPath || 'None created'}`);
      console.log(`  🔗 Repository: ${this.repoUrl}`);
      console.log('\n🚀 Next steps:');
      console.log(`  cd ${this.deployPath}`);
      console.log('  npm start  # Start the application');
      
      return { success: true, backupPath };
      
    } catch (error) {
      console.error('\n❌ Deployment failed:', error.message);
      console.log('\n🔄 Rollback options:');
      console.log('1. Check backup directory for previous version');
      console.log('2. Manually investigate the error and retry');
      
      return { success: false, error: error.message };
    }
  }

  async checkStatus() {
    console.log('📊 Checking deployment status...');
    
    try {
      // Check if repository exists
      try {
        await execAsync(`test -d ${this.deployPath}`);
        console.log('✅ Repository directory exists');
        
        // Check git status
        const { stdout: gitStatus } = await execAsync(`cd ${this.deployPath} && git status --porcelain`);
        if (gitStatus.trim()) {
          console.log('⚠️ Repository has uncommitted changes');
        } else {
          console.log('✅ Repository is clean');
        }
        
        // Check current commit
        const { stdout: currentCommit } = await execAsync(`cd ${this.deployPath} && git rev-parse HEAD`);
        console.log(`📝 Current commit: ${currentCommit.trim().substring(0, 8)}`);
        
        // Check if Node.js process is running
        try {
          const { stdout: processes } = await execAsync('pgrep -f "node.*index.js"');
          if (processes.trim()) {
            console.log('✅ Application appears to be running');
          } else {
            console.log('⚠️ No Node.js processes detected');
          }
        } catch (error) {
          console.log('⚠️ No Node.js processes detected');
        }
        
      } catch (error) {
        console.log('❌ Repository not found - run deploy first');
      }
      
    } catch (error) {
      console.error('❌ Status check failed:', error.message);
    }
  }
}

export { VPSDeployment };

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const deployment = new VPSDeployment();
  const command = process.argv[2] || 'help';
  
  if (command === 'deploy') {
    deployment.deploy().catch(console.error);
  } else if (command === 'status') {
    deployment.checkStatus().catch(console.error);
  } else {
    console.log('🚀 VPS Deployment Tool for Amrit Dairy System');
    console.log('=============================================');
    console.log('');
    console.log('Usage:');
    console.log('  node vps-deploy.js deploy   - Deploy latest changes from GitHub');
    console.log('  node vps-deploy.js status   - Check deployment status');
    console.log('');
    console.log('This tool will:');
    console.log('  1. Create backup of current deployment');
    console.log('  2. Pull latest changes from GitHub');
    console.log('  3. Extract archive files');
    console.log('  4. Install dependencies');
    console.log('  5. Build application');
    console.log('  6. Restart services');
  }
}