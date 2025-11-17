# GitHub Actions Deployment Setup

This project uses GitHub Actions to automatically deploy to Devvit.

## 🔧 Initial Setup

### 1. Get Your Devvit Token

Your Devvit authentication token is stored locally at:
```
C:\Users\XPRTZRikOostveen\.devvit\token
```

On Linux/Mac:
```
~/.devvit/token
```

**To get the token:**
```bash
cat ~/.devvit/token
```

### 2. Add GitHub Secret

1. Go to your GitHub repository: `https://github.com/Zwemvest/rule5bot`
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `DEVVIT_TOKEN`
5. Value: Paste the contents of your `~/.devvit/token` file
6. Click **Add secret**

## 🚀 Deployment Workflows

### Automatic Upload (on push to main)

Every push to `main` branch:
1. ✅ Runs tests
2. ✅ Lints code
3. ✅ Builds TypeScript
4. ✅ Uploads to Devvit (visible only to you)

The app is uploaded but **not published** - it's only visible to the app owner for testing.

### Automatic Publish (on version tags)

When you create a version tag (e.g., `v1.0.2`):
1. ✅ Runs tests
2. ✅ Uploads to Devvit
3. ✅ **Publishes to App Directory** (available for installation by others)

**To create a release:**
```bash
# Update version in package.json and devvit.yaml
npm version patch  # or minor, major

# Push with tags
git push && git push --tags
```

### Manual Publish

You can manually trigger a publish from GitHub:
1. Go to **Actions** tab
2. Select **Deploy to Devvit** workflow
3. Click **Run workflow**
4. Check **Publish to App Directory**
5. Click **Run workflow**

## 📋 Workflow Details

### CI Workflow (`ci.yml`)
- **Triggers:** Pull requests and pushes to main
- **Purpose:** Run tests and build checks
- **No deployment** - just validation

### Deploy Workflow (`deploy.yml`)
- **Triggers:** Pushes to main, version tags, manual dispatch
- **Jobs:**
  1. **test** - Validates code quality
  2. **upload** - Uploads to Devvit (main branch only)
  3. **publish** - Publishes to App Directory (version tags only)

## 🧪 Testing the Deployment

### After Upload (non-published)
1. Visit https://developers.reddit.com/apps/rule5bot
2. Install to your test subreddit
3. Configure settings
4. Test functionality

### After Publish
- Other moderators can find and install the app
- It appears in the Devvit App Directory
- Installation instructions are in the main README

## 🔐 Security Notes

### Token Security
- **NEVER commit** your `.devvit/token` file
- **NEVER share** your Devvit token publicly
- Token has **full access** to your Reddit developer account
- Rotate token if compromised: `devvit logout && devvit login`

### GitHub Actions
- Token is stored as encrypted GitHub secret
- Only accessible to workflows in this repository
- Not visible in logs or to collaborators

## 🐛 Troubleshooting

### Upload fails with "Unauthorized"
**Problem:** Invalid or expired Devvit token

**Solution:**
1. Log out and back in: `devvit logout && devvit login`
2. Get new token: `cat ~/.devvit/token`
3. Update GitHub secret with new token

### Publish fails with "Version not found"
**Problem:** Trying to publish a version that wasn't uploaded

**Solution:**
1. Make sure upload step succeeded first
2. Check version in `package.json` matches what was uploaded
3. Try `devvit upload` manually to debug

### Tests pass locally but fail in CI
**Problem:** Environment differences

**Solution:**
1. Check Node.js version (CI uses Node 20)
2. Run `npm ci` locally (clean install)
3. Check for uncommitted files that tests depend on

## 📊 Monitoring Deployments

### GitHub Actions Dashboard
View all deployments at:
```
https://github.com/Zwemvest/rule5bot/actions
```

### Deployment Summary
Each successful deployment creates a summary with:
- Version number
- Upload/publish status
- Links to test/install the app

### Devvit Developer Portal
Check deployed versions at:
```
https://developers.reddit.com/apps/rule5bot
```

## 🔄 Rollback

If a deployment breaks something:

### Option 1: Install Previous Version
```bash
devvit install rule5bot@1.0.0 --subreddit yoursubreddit
```

### Option 2: Revert and Redeploy
```bash
git revert HEAD
git push
# Wait for automatic deployment
```

## 📝 Version Bumping Strategy

### Patch (1.0.X)
- Bug fixes
- Documentation updates
- No breaking changes
```bash
npm version patch
```

### Minor (1.X.0)
- New features
- New settings
- Backward compatible
```bash
npm version minor
```

### Major (X.0.0)
- Breaking changes
- Settings renamed/removed
- Migration required
```bash
npm version major
```

## 🎯 Best Practices

1. **Always test locally first**: `npm test && npm run build`
2. **Create PRs for features**: Let CI validate before merge
3. **Use semantic versioning**: Communicate changes clearly
4. **Update CHANGELOG.md**: Document what changed
5. **Test uploaded version**: Install to test subreddit before publishing
6. **Monitor after publish**: Watch for issues from users

---

**Questions?** Check [Devvit docs](https://developers.reddit.com/docs/) or create an issue.
