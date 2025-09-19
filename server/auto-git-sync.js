import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

let connectionSettings;

async function getAccessToken() {
  // First, try environment variable (more reliable)
  if (process.env.GITHUB_TOKEN) {
    console.log('🔑 Using GITHUB_TOKEN from environment');
    return process.env.GITHUB_TOKEN;
  }

  // If cached token is still valid, use it
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  // Try to fetch from Replit connector
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('No authentication available. Set GITHUB_TOKEN environment variable or ensure Replit GitHub integration is connected.');
  }

  try {
    connectionSettings = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    ).then(res => res.json()).then(data => data.items?.[0]);

    const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

    if (!connectionSettings || !accessToken) {
      throw new Error('GitHub integration not properly connected');
    }

    // Validate the token with a lightweight API call
    await validateToken(accessToken);
    
    return accessToken;
  } catch (error) {
    throw new Error(`GitHub authentication failed: ${error.message}. Try setting GITHUB_TOKEN environment variable or re-authorize the GitHub integration.`);
  }
}

async function validateToken(token) {
  try {
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Token validation failed: ${response.status} ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    throw new Error(`Invalid GitHub token: ${error.message}`);
  }
}

async function getGitHubClient() {
  try {
    const accessToken = await getAccessToken();
    return new Octokit({ auth: accessToken });
  } catch (error) {
    console.warn('⚠️ Authenticated access failed, trying public access for read-only operations');
    console.warn(`Authentication error: ${error.message}`);
    
    // For public repositories, try unauthenticated access
    return new Octokit();
  }
}

class AutoGitSync {
  constructor() {
    this.owner = 'Codertype';
    this.repo = 'Amrit-Dairy-System';
    this.backupDir = path.join(PROJECT_ROOT, '.sync-backup');
    this.syncLogFile = path.join(PROJECT_ROOT, '.sync-log.json');
  }

  async init() {
    console.log('🔧 Initializing Auto Git Sync System...');
    this.octokit = await getGitHubClient();
    
    // Verify repository access
    const { data: repo } = await this.octokit.rest.repos.get({
      owner: this.owner,
      repo: this.repo
    });
    
    console.log(`✅ Connected to repository: ${repo.full_name}`);
    console.log(`📝 Description: ${repo.description || 'No description'}`);
    
    return this;
  }

  async createBackup() {
    console.log('💾 Creating backup of current state...');
    
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `backup-${timestamp}`);
      
      // Create backup of key directories
      const dirsToBackup = ['client', 'server', 'shared'];
      const filesToBackup = ['package.json', 'vite.config.ts', 'tailwind.config.ts'];
      
      await fs.mkdir(backupPath, { recursive: true });
      
      for (const dir of dirsToBackup) {
        const srcDir = path.join(PROJECT_ROOT, dir);
        const destDir = path.join(backupPath, dir);
        
        try {
          await this.copyDirectory(srcDir, destDir);
          console.log(`  ✅ Backed up ${dir}/`);
        } catch (error) {
          console.log(`  ⚠️ Could not backup ${dir}/: ${error.message}`);
        }
      }
      
      for (const file of filesToBackup) {
        const srcFile = path.join(PROJECT_ROOT, file);
        const destFile = path.join(backupPath, file);
        
        try {
          await fs.copyFile(srcFile, destFile);
          console.log(`  ✅ Backed up ${file}`);
        } catch (error) {
          console.log(`  ⚠️ Could not backup ${file}: ${error.message}`);
        }
      }
      
      console.log(`💾 Backup created at: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      throw error;
    }
  }

  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const items = await fs.readdir(src);
    
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      const stat = await fs.stat(srcPath);
      
      if (stat.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  async getRepositoryInfo() {
    console.log('📋 Fetching repository information...');
    
    try {
      const { data: repo } = await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo
      });
      
      const defaultBranch = repo.default_branch || 'main';
      console.log(`🌿 Using branch: ${defaultBranch}`);
      
      return { repo, defaultBranch };
    } catch (error) {
      console.error('❌ Failed to fetch repository info:', error.message);
      throw error;
    }
  }

  async getRepositoryTree() {
    console.log('🌳 Fetching repository file tree...');
    
    try {
      const { data: repo } = await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo
      });
      
      const defaultBranch = repo.default_branch || 'main';
      
      const { data: branch } = await this.octokit.rest.repos.getBranch({
        owner: this.owner,
        repo: this.repo,
        branch: defaultBranch
      });
      
      const { data: tree } = await this.octokit.rest.git.getTree({
        owner: this.owner,
        repo: this.repo,
        tree_sha: branch.commit.sha,
        recursive: true
      });
      
      console.log(`📁 Found ${tree.tree.length} files in repository`);
      return tree.tree;
    } catch (error) {
      console.error('❌ Failed to fetch repository tree:', error.message);
      throw error;
    }
  }

  async downloadRepositoryArchive(defaultBranch) {
    console.log('📦 Downloading repository archive...');
    
    try {
      const archiveUrl = `https://codeload.github.com/${this.owner}/${this.repo}/zip/refs/heads/${defaultBranch}`;
      
      const response = await fetch(archiveUrl);
      if (!response.ok) {
        throw new Error(`Failed to download archive: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log(`📦 Downloaded ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      console.error('❌ Failed to download repository archive:', error.message);
      throw error;
    }
  }

  async extractArchiveToTemp(archiveBuffer) {
    console.log('📂 Extracting archive to temporary directory...');
    
    const tempDir = path.join(PROJECT_ROOT, '.sync-temp');
    
    try {
      // Clean up any existing temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
      await fs.mkdir(tempDir, { recursive: true });
      
      // Save archive to temp file
      const archivePath = path.join(tempDir, 'repo.zip');
      await fs.writeFile(archivePath, archiveBuffer);
      
      // For simplicity, we'll use a basic ZIP extraction approach
      // In production, you'd want to use a proper ZIP library like 'yauzl' or 'adm-zip'
      console.log('⚠️ Archive extraction requires manual handling for this demo');
      console.log(`📁 Archive saved to: ${archivePath}`);
      
      return tempDir;
    } catch (error) {
      console.error('❌ Failed to extract archive:', error.message);
      throw error;
    }
  }

  async downloadFile(filePath) {
    try {
      const { data: file } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: filePath
      });
      
      if (file.type === 'file') {
        // Handle binary files properly by checking if content is base64
        if (file.encoding === 'base64') {
          const buffer = Buffer.from(file.content, 'base64');
          // For text files, convert to string; for binary files, this will be the raw content
          const content = buffer.toString('utf-8');
          return { content, sha: file.sha, isBinary: false };
        } else {
          return { content: file.content, sha: file.sha, isBinary: false };
        }
      }
      
      return null;
    } catch (error) {
      if (error.status === 404) {
        return null; // File doesn't exist in repository
      }
      throw error;
    }
  }

  async compareFiles(tree) {
    console.log('🔍 Comparing local files with repository...');
    
    const changes = {
      toUpdate: [],
      toAdd: [],
      conflicts: [],
      unchanged: []
    };
    
    const filesToSync = tree.filter(item => 
      item.type === 'blob' && 
      !item.path.startsWith('.git/') &&
      !item.path.startsWith('node_modules/') &&
      !item.path.includes('/.sync-backup/') &&
      !item.path.endsWith('.log') &&
      !item.path.endsWith('.lock')
    );
    
    for (const item of filesToSync) {
      const localPath = path.join(PROJECT_ROOT, item.path);
      
      try {
        const localContent = await fs.readFile(localPath, 'utf-8');
        const remoteFile = await this.downloadFile(item.path);
        
        if (remoteFile && remoteFile.content !== localContent) {
          changes.toUpdate.push({
            path: item.path,
            localPath,
            remoteContent: remoteFile.content,
            localContent
          });
        } else if (remoteFile) {
          changes.unchanged.push(item.path);
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          // File exists in repo but not locally
          const remoteFile = await this.downloadFile(item.path);
          if (remoteFile) {
            changes.toAdd.push({
              path: item.path,
              localPath,
              content: remoteFile.content
            });
          }
        }
      }
    }
    
    console.log(`📊 Comparison results:`);
    console.log(`  🔄 Files to update: ${changes.toUpdate.length}`);
    console.log(`  ➕ Files to add: ${changes.toAdd.length}`);
    console.log(`  ⚠️ Conflicts: ${changes.conflicts.length}`);
    console.log(`  ✅ Unchanged: ${changes.unchanged.length}`);
    
    return changes;
  }

  async applyChanges(changes, backupPath) {
    console.log('🔄 Applying changes...');
    
    const results = {
      updated: [],
      added: [],
      failed: []
    };
    
    // Apply updates
    for (const change of changes.toUpdate) {
      try {
        await fs.mkdir(path.dirname(change.localPath), { recursive: true });
        await fs.writeFile(change.localPath, change.remoteContent, 'utf-8');
        results.updated.push(change.path);
        console.log(`  🔄 Updated: ${change.path}`);
      } catch (error) {
        results.failed.push({ path: change.path, error: error.message });
        console.error(`  ❌ Failed to update ${change.path}: ${error.message}`);
      }
    }
    
    // Apply additions
    for (const change of changes.toAdd) {
      try {
        await fs.mkdir(path.dirname(change.localPath), { recursive: true });
        await fs.writeFile(change.localPath, change.content, 'utf-8');
        results.added.push(change.path);
        console.log(`  ➕ Added: ${change.path}`);
      } catch (error) {
        results.failed.push({ path: change.path, error: error.message });
        console.error(`  ❌ Failed to add ${change.path}: ${error.message}`);
      }
    }
    
    // Log sync results
    const syncLog = {
      timestamp: new Date().toISOString(),
      backupPath,
      results,
      success: results.failed.length === 0
    };
    
    await fs.writeFile(this.syncLogFile, JSON.stringify(syncLog, null, 2), 'utf-8');
    
    console.log(`\n📋 Sync Summary:`);
    console.log(`  ✅ Updated: ${results.updated.length} files`);
    console.log(`  ➕ Added: ${results.added.length} files`);
    console.log(`  ❌ Failed: ${results.failed.length} files`);
    
    if (results.failed.length > 0) {
      console.log(`\n⚠️ Failed operations:`);
      results.failed.forEach(fail => {
        console.log(`    ${fail.path}: ${fail.error}`);
      });
    }
    
    return results;
  }

  async performSync() {
    try {
      await this.init();
      
      const backupPath = await this.createBackup();
      const tree = await this.getRepositoryTree();
      const changes = await this.compareFiles(tree);
      
      if (changes.toUpdate.length === 0 && changes.toAdd.length === 0) {
        console.log('✅ Repository is already up to date!');
        return { success: true, message: 'Already up to date' };
      }
      
      console.log(`\n🔄 Ready to sync ${changes.toUpdate.length + changes.toAdd.length} files...`);
      
      const results = await this.applyChanges(changes, backupPath);
      
      console.log('\n🎉 Sync completed!');
      console.log(`💾 Backup available at: ${backupPath}`);
      console.log(`📝 Sync log saved to: ${this.syncLogFile}`);
      
      return { success: true, results, backupPath };
      
    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async showStatus() {
    try {
      await this.init();
      const tree = await this.getRepositoryTree();
      const changes = await this.compareFiles(tree);
      
      console.log('\n📊 Repository Status:');
      console.log(`Current local files vs Amrit-Dairy-System repository:`);
      console.log(`  🔄 Files that need updating: ${changes.toUpdate.length}`);
      console.log(`  ➕ New files to download: ${changes.toAdd.length}`);
      console.log(`  ✅ Files already in sync: ${changes.unchanged.length}`);
      
      if (changes.toUpdate.length > 0) {
        console.log('\n📝 Files that would be updated:');
        changes.toUpdate.forEach(change => {
          console.log(`    ${change.path}`);
        });
      }
      
      if (changes.toAdd.length > 0) {
        console.log('\n📝 New files that would be added:');
        changes.toAdd.forEach(change => {
          console.log(`    ${change.path}`);
        });
      }
      
      return changes;
    } catch (error) {
      console.error('❌ Status check failed:', error.message);
      throw error;
    }
  }
}

export { AutoGitSync };

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const sync = new AutoGitSync();
  const command = process.argv[2] || 'sync';
  
  if (command === 'status') {
    sync.showStatus().catch(console.error);
  } else if (command === 'sync') {
    sync.performSync().catch(console.error);
  } else {
    console.log('Usage: node auto-git-sync.js [sync|status]');
  }
}