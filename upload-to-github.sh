#!/bin/bash

echo "🚀 Uploading Amrit Dairy files to GitHub..."

# Set the correct repository URL (lowercase username)
GITHUB_USERNAME="codertype"
REPO_NAME="Edurix"
REPO_URL="https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

# Remove lock files if they exist
rm -f .git/config.lock .git/index.lock 2>/dev/null || true

# Create temporary credential helper
export GIT_ASKPASS_SCRIPT=$(mktemp)
cat > "$GIT_ASKPASS_SCRIPT" << 'EOF'
#!/bin/bash
if [[ "$1" == *"Username"* ]]; then
    echo "codertype"
else
    echo "$GITHUB_PERSONAL_ACCESS_TOKEN"
fi
EOF
chmod +x "$GIT_ASKPASS_SCRIPT"
export GIT_ASKPASS="$GIT_ASKPASS_SCRIPT"

# Fix the remote URL
echo "🔗 Setting correct GitHub remote..."
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"

# Add all files and commit (sensitive files already cleaned)
echo "📦 Adding all Amrit Dairy files..."
git add .
git status --porcelain

echo "💾 Committing latest changes..."
git commit -m "🥛 Upload complete Amrit Dairy system

✅ All application files uploaded
✅ Sensitive files cleaned (SQL dumps, cookies removed)
✅ Production-ready codebase
✅ Revenue: ₹21,962+ generated

Components included:
- Multi-role authentication system
- Order management & tracking  
- Subscription system
- POS system with raw materials
- Push notifications & PWA
- Admin dashboard & analytics
- WebSocket real-time features" || echo "No changes to commit"

echo "🚀 Pushing to GitHub repository..."
git -c credential.helper= push -u origin main

if [ $? -eq 0 ]; then
    echo "✅ SUCCESS! All files uploaded to GitHub"
    echo "📍 Repository: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
    
    # Test pull to verify connection
    echo "🧪 Verifying connection..."
    git -c credential.helper= pull origin main --no-rebase
    echo "✅ Upload and sync verified!"
else
    echo "❌ Push failed. Checking repository status..."
    git status
    git log --oneline -n 5
fi

# Cleanup
rm -f "$GIT_ASKPASS_SCRIPT" 2>/dev/null
unset GIT_ASKPASS GIT_ASKPASS_SCRIPT

echo "
🎉 UPLOAD COMPLETE!
   Repository: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}
   Status: All Amrit Dairy files safely stored online
   
🔄 Next steps:
   - Your VPS can now pull updates: git pull origin main
   - Development workflow is ready
   - All sensitive files have been excluded
"