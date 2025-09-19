import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

async function getGitHubClient() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }
  return new Octokit({ auth: token });
}

class GitPushSync {
  constructor() {
    this.owner = 'Codertype';
    this.repo = 'Amrit-Dairy-System';
    this.branch = 'main';
  }

  async init() {
    console.log('🔧 Initializing Git Push Sync System...');
    this.octokit = await getGitHubClient();
    
    // Verify repository access
    const { data: repo } = await this.octokit.rest.repos.get({
      owner: this.owner,
      repo: this.repo
    });
    
    console.log(`✅ Connected to repository: ${repo.full_name}`);
    return this;
  }

  async pushFile(localFilePath, repoPath = null) {
    try {
      console.log(`📤 Pushing file: ${localFilePath}`);
      
      // Use filename as repo path if not specified
      if (!repoPath) {
        repoPath = path.basename(localFilePath);
      }
      
      // Read local file (handle binary files properly)
      const content = await fs.readFile(path.join(PROJECT_ROOT, localFilePath));
      const encodedContent = content.toString('base64');
      
      // Check if file exists in repository
      let existingFile = null;
      try {
        const { data } = await this.octokit.rest.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: repoPath
        });
        existingFile = data;
        console.log(`📝 File exists in repository, will update`);
      } catch (error) {
        if (error.status === 404) {
          console.log(`📝 New file, will create`);
        } else {
          throw error;
        }
      }
      
      // Create or update file
      const params = {
        owner: this.owner,
        repo: this.repo,
        path: repoPath,
        message: `Add/Update ${repoPath} from Replit`,
        content: encodedContent,
        branch: this.branch
      };
      
      // Add SHA if updating existing file
      if (existingFile) {
        params.sha = existingFile.sha;
      }
      
      const { data: result } = await this.octokit.rest.repos.createOrUpdateFileContents(params);
      
      console.log(`✅ Successfully pushed: ${repoPath}`);
      console.log(`🔗 View at: ${result.content.html_url}`);
      
      return {
        success: true,
        url: result.content.html_url,
        sha: result.content.sha
      };
      
    } catch (error) {
      console.error(`❌ Failed to push ${localFilePath}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async pushMultipleFiles(fileList) {
    console.log(`📤 Pushing ${fileList.length} files to repository...`);
    
    const results = [];
    
    for (const fileInfo of fileList) {
      const localPath = typeof fileInfo === 'string' ? fileInfo : fileInfo.local;
      const repoPath = typeof fileInfo === 'string' ? null : fileInfo.remote;
      
      const result = await this.pushFile(localPath, repoPath);
      results.push({
        file: localPath,
        ...result
      });
      
      // Small delay to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`\n📋 Push Summary:`);
    console.log(`  ✅ Successful: ${successful.length} files`);
    console.log(`  ❌ Failed: ${failed.length} files`);
    
    if (failed.length > 0) {
      console.log(`\n⚠️ Failed files:`);
      failed.forEach(fail => {
        console.log(`    ${fail.file}: ${fail.error}`);
      });
    }
    
    return results;
  }

  async listLocalFiles() {
    console.log('📁 Scanning local files...');
    
    const filesToPush = [];
    
    // Scan for common file types to push
    const extensions = ['.md', '.txt', '.json', '.js', '.ts', '.css', '.html'];
    const ignorePaths = ['node_modules', '.git', '.sync-backup', 'dist'];
    
    async function scanDirectory(dir, relativePath = '') {
      const items = await fs.readdir(path.join(PROJECT_ROOT, dir));
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativeFullPath = path.join(relativePath, item);
        
        // Skip ignored paths
        if (ignorePaths.some(ignore => fullPath.includes(ignore))) {
          continue;
        }
        
        const stat = await fs.stat(path.join(PROJECT_ROOT, fullPath));
        
        if (stat.isFile()) {
          const ext = path.extname(item);
          if (extensions.includes(ext)) {
            filesToPush.push(relativeFullPath);
          }
        } else if (stat.isDirectory()) {
          await scanDirectory(fullPath, relativeFullPath);
        }
      }
    }
    
    await scanDirectory('.');
    
    console.log(`📁 Found ${filesToPush.length} files that could be pushed`);
    return filesToPush;
  }
}

export { GitPushSync };

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const pushSync = new GitPushSync();
  const command = process.argv[2] || 'help';
  const file = process.argv[3];
  
  if (command === 'push' && file) {
    pushSync.init().then(() => pushSync.pushFile(file)).catch(console.error);
  } else if (command === 'list') {
    pushSync.listLocalFiles().catch(console.error);
  } else if (command === 'test') {
    pushSync.init().then(() => pushSync.pushFile('test-sync-push.md')).catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  node git-push-sync.js push <filename>  - Push a specific file');
    console.log('  node git-push-sync.js list            - List files that can be pushed');
    console.log('  node git-push-sync.js test            - Push test file');
  }
}