import { Octokit } from '@octokit/rest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let connectionSettings;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function fixGitRemote() {
  try {
    console.log('🔧 Starting Git remote fix process...');
    
    // Get GitHub client
    const octokit = await getUncachableGitHubClient();
    
    // Verify we can access the correct repository
    console.log('🔍 Verifying access to Amrit-Dairy-System repository...');
    const { data: repo } = await octokit.rest.repos.get({
      owner: 'Codertype',
      repo: 'Amrit-Dairy-System'
    });
    
    console.log(`✅ Repository verified: ${repo.full_name}`);
    console.log(`📝 Description: ${repo.description || 'No description'}`);
    console.log(`🔗 Clone URL: ${repo.clone_url}`);
    
    // Check current remote
    console.log('\n🔍 Checking current Git remote...');
    const { stdout: currentRemote } = await execAsync('git remote get-url origin');
    console.log(`Current remote: ${currentRemote.trim()}`);
    
    const correctUrl = 'https://github.com/Codertype/Amrit-Dairy-System.git';
    
    if (currentRemote.trim() === correctUrl) {
      console.log('✅ Remote URL is already correct!');
      return;
    }
    
    // Update the remote URL
    console.log('\n🔄 Updating Git remote URL...');
    await execAsync(`git remote set-url origin ${correctUrl}`);
    
    // Verify the change
    const { stdout: newRemote } = await execAsync('git remote get-url origin');
    console.log(`✅ New remote: ${newRemote.trim()}`);
    
    // Test connection
    console.log('\n🔄 Testing Git connection...');
    await execAsync('git fetch origin --dry-run');
    console.log('✅ Git connection test successful!');
    
    console.log('\n🎉 Git remote fix completed successfully!');
    console.log('📋 Summary:');
    console.log(`   - Old remote: ${currentRemote.trim()}`);
    console.log(`   - New remote: ${correctUrl}`);
    console.log(`   - Repository: ${repo.full_name}`);
    
  } catch (error) {
    console.error('❌ Error fixing Git remote:', error.message);
    
    if (error.message.includes('GitHub not connected')) {
      console.log('💡 Please ensure GitHub integration is properly set up');
    }
    
    throw error;
  }
}

// Export for potential future use
export { getUncachableGitHubClient, fixGitRemote };

// Run the fix only if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixGitRemote().catch(console.error);
}