# JiraMetadata

A Forge app that provides custom metadata fields for Jira Projects and JSM Spaces.

## Overview

JiraMetadata fills a gap in Jira's native functionality by allowing organizations to define custom fields at the project/space level (similar to how Jira supports custom fields at the issue level).

### Use Cases

- Track contract details (type, billing rate, included hours)
- Tag projects for reporting and categorization
- Store operational metadata (account manager, renewal date)
- Integrate with external time tracking and reporting tools

## First-Time Forge Setup

If you've never used Atlassian Forge before, follow these steps to get set up.

### Prerequisites

- **Node.js**: Version 24.x
- **npm**: Comes with Node.js
- **Atlassian Cloud Site**: You need a Jira Cloud site for testing. Create a free developer site at https://developer.atlassian.com/

### 1. Install the Forge CLI

```bash
nvm install 24 && nvm use 24 # Make sure you have node.js version 24
npm install -g @forge/cli
```

Verify the installation:

```bash
forge --version
```

### 2. Log in to Atlassian

```bash
forge login
```

This opens a browser window to authenticate with your Atlassian account. You'll need to:

1. Log in with your Atlassian account
2. Authorize the Forge CLI to access your account
3. Return to the terminal - it should confirm successful login

To verify you're logged in:

```bash
forge whoami
```

### 3. Register the App

Before deploying, you need to register the app to get an App ID:

```bash
cd /path/to/jirametadata
forge register
```

When prompted:
- **App name**: `JiraMetadata`

This creates an app in the Atlassian Developer Console and updates `manifest.yml` with your unique app ID.

### 4. Install Dependencies

```bash
npm install
```

### 5. Deploy the App

Deploy to your development environment:

```bash
forge deploy
```

For the first deployment, you'll be asked to confirm the environment (development).

### 6. Install on a Jira Site

```bash
forge install
```

When prompted:
- **Select product**: Jira
- **Enter site URL**: Your Jira Cloud site (e.g., `your-site.atlassian.net`)

The app will be installed on your site. You can install on multiple sites if needed.

## Development Workflow

### Local Development with Tunnel

For rapid development with hot reload:

```bash
forge tunnel
```

This creates a tunnel from your local machine to Atlassian's servers, allowing you to see changes immediately without redeploying.

**Note**: Tunneling requires Docker to be running on some systems.

### View Logs

To see console output and errors:

```bash
forge logs
```

To see recent logs with more detail:

```bash
forge logs --verbose --grouped
```

### Redeploy After Changes

After making changes (when not using tunnel):

```bash
forge deploy
```

### List Installations

See where your app is installed:

```bash
forge install:list
```

### Uninstall from a Site

```bash
forge uninstall
```

## Using the App

### Admin Configuration

1. Go to **Gear icon** → **Jira admin settings** → **Marketplace Apps** → **JiraMetadata Config**
2. Define your custom fields:
   - Click "Add Field"
   - Choose field type (text, number, boolean, select, etc.)
   - Set label, key, description, and other options
   - Use up/down arrows to reorder fields
   - Save the schema

### Project Settings

1. Go to **Spaces** → **{Target Space}** → **Space Settings** → **Apps** → **Project Metadata**
2. Fill in values for the fields defined by your admin
3. Click Save

**Note:** For JSM projects, use the same Project Settings path - there is no separate Space Settings page.

### Accessing Data via API

External applications can read project metadata via the standard Jira REST API:

```
GET /rest/api/3/project/{projectKeyOrId}/properties/jirametadata

Response:
{
  "key": "jirametadata",
  "value": {
    "billable": true,
    "tags": ["Client", "Managed"]
  }
}
```

## Supported Field Types

| Type | Description | Value Type |
|------|-------------|------------|
| `text` | Single line text | string |
| `textarea` | Multi-line text | string |
| `number` | Numeric input | number |
| `boolean` | Checkbox toggle | boolean |
| `select` | Single selection dropdown | string |
| `multiselect` | Multiple selection | string[] |
| `date` | Date picker | string (ISO) |
| `user` | Jira user picker | string (accountId) |
| `url` | URL with validation | string |

## Project Structure

```
jirametadata/
├── manifest.yml              # Forge app definition
├── package.json              # Dependencies
├── src/
│   ├── frontend/
│   │   ├── admin.jsx         # Global admin page (schema management)
│   │   └── project.jsx       # Project settings page (value entry)
│   └── resolvers/
│       └── index.js          # Backend resolver functions
├── CLAUDE.md                 # Development documentation
└── README.md                 # This file
```

## Troubleshooting

### "App not registered" error

Run `forge register` to register the app and get an App ID.

### "Permission denied" errors

Ensure your Atlassian account has admin access to the target Jira site.

### Changes not appearing

1. If using tunnel: Check that the tunnel is still running
2. If deployed: Run `forge deploy` again
3. Clear browser cache or try incognito mode or use `Shift + Reload`
4. Check `forge logs` for errors

### Tunnel not connecting

- Ensure Docker is running (required on some systems)
- Check firewall settings
- Try restarting the tunnel

## Environments and Production Deployment

Forge supports three environments: **development** (default), **staging**, and **production**.

### Environment Overview

| Environment | Use Case | Tunnel Support | Logs |
|-------------|----------|----------------|------|
| development | Active development, testing | Yes | Yes |
| staging | Pre-production testing | No | Yes |
| production | Live users | No | No |

### Deploying to Production

1. **Deploy to production environment:**

```bash
forge deploy -e production
```

2. **Install on a site (first time):**

```bash
forge install -e production
```

3. **Upgrade existing installation:**

```bash
forge install --upgrade -e production
```

### Production Restrictions

- **No tunneling**: `forge tunnel` is not available for production
- **No logs**: `forge logs` is not available for production
- Changes require a full deploy cycle

### Recommended Workflow

1. Develop and test locally using `forge tunnel` (development environment)
2. Deploy to development: `forge deploy`
3. Test on your development site
4. Deploy to staging: `forge deploy -e staging`
5. Test on staging site
6. Deploy to production: `forge deploy -e production`
7. Upgrade production installations: `forge install --upgrade -e production`

### Checking Environment Status

To see which environments have deployments:

```bash
forge deploy:list
```

## Useful Commands Reference

```bash
# First-time setup
nvm install 24 && nvm use 24 # Make sure you have node.js version 24
npm install -g @forge/cli    # Install Forge CLI
forge login                  # Authenticate
forge register               # Register app (get App ID)
npm install                  # Install dependencies

# Development
forge tunnel                 # Local dev with hot reload
forge deploy                 # Deploy to development
forge deploy -e production   # Deploy to production
forge logs                   # View logs (dev/staging only)
forge logs --verbose         # View logs with metadata

# Installation management
forge install                # Install on a site
forge install -e production  # Install production version
forge install --upgrade      # Upgrade existing installation
forge install:list           # List installations
forge uninstall              # Remove from a site

# Account
forge whoami                 # Check logged-in user
forge logout                 # Log out
```

## License

MIT
