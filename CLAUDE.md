# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JiraMetadata is a Forge app that provides **custom metadata fields for Jira Projects**. It fills a gap in Jira's native functionality by allowing organizations to define custom fields at the project level (similar to how Jira supports custom fields at the issue level).

### Use Cases
- Track contract details (type, billing rate, included hours)
- Tag projects for reporting and categorization
- Store operational metadata (account manager, renewal date)
- Integrate with external time tracking and reporting tools

### Key Design Goals
- **Generic and reusable** - Not tied to any specific use case
- **Self-service configuration** - Admins define schema via UI, no code changes
- **API-accessible** - External apps read data via standard Jira REST API
- **Minimal dependencies** - Forge + UI Kit only, no external services

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Global Admin Page (Gear > Jira admin settings > Marketplace Apps) │
│  ─────────────────────────────────────────────────────────────  │
│  • Define field schema (name, type, options, required)          │
│  • Add/edit/remove/reorder fields                               │
│  • Default fields: Billable (checkbox), Tags (multi-select)     │
│  • Storage: Forge App Storage (global)                          │
│  • Access: Jira Administrators                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ schema flows down
┌─────────────────────────────────────────────────────────────────┐
│  Project Settings Page                                          │
│  (Project Settings > Apps > Project Metadata)                   │
│  ─────────────────────────────────────────────────────────────  │
│  • Dynamically render form based on global schema               │
│  • Project admins fill in values for their project              │
│  • Storage: Project Properties (Jira REST API)                  │
│  • Access: Project Administrators                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ external access
┌─────────────────────────────────────────────────────────────────┐
│  External Apps (JiraTime, reporting tools, etc.)                │
│  ─────────────────────────────────────────────────────────────  │
│  • Read via: GET /rest/api/3/project/{key}/properties/jirametadata
│  • Standard Jira REST API, no special authentication            │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Platform:** Atlassian Forge (serverless, Atlassian-hosted)
- **UI:** Forge UI Kit (React-based, declarative components)
- **Storage:**
  - Schema: Forge App Storage (`@forge/api` storage module)
  - Values: Jira Project Properties (via REST API)
- **No external dependencies** - All data lives within Atlassian infrastructure

### Why Forge + UI Kit?
- Simplest path to embedded Jira UI
- No hosting infrastructure required
- Built-in security and permissions
- UI Kit provides consistent Atlassian Design System components

## Storage Model

| Data | Storage | API | Scope |
|------|---------|-----|-------|
| Field schema (definitions) | Forge App Storage | `storage.get/set` | Global (per installation) |
| Project field values | Project Properties | Jira REST API (`requestJira`) | Per project |

### Property Key
Use `jirametadata` as the property key for projects. This makes it predictable for external API consumers.

### Schema Storage Key
Use `field-schema` as the Forge App Storage key for the field definitions.

## Forge Modules

The app uses two modules defined in `manifest.yml`:

```yaml
modules:
  # Global admin page for schema management (Jira admins only)
  jira:adminPage:
    - key: jirametadata-admin
      title: JiraMetadata Config
      resource: adminPage
      render: native
      resolver:
        function: resolver

  # Per-project settings page (project admins)
  jira:projectSettingsPage:
    - key: jirametadata-project
      title: Project Metadata
      resource: projectPage
      render: native
      resolver:
        function: resolver

  function:
    - key: resolver
      handler: resolvers/index.handler

resources:
  - key: adminPage
    path: src/frontend/admin.jsx
  - key: projectPage
    path: src/frontend/project.jsx

permissions:
  scopes:
    - storage:app
    - read:project.property:jira
    - write:project.property:jira
    - read:jira-work
    - manage:jira-project

app:
  runtime:
    name: nodejs24.x
  id: ari:cloud:ecosystem::app/[generated-id]
```

**Note:** The `jiraServiceManagement:spaceSettingsPage` module type does not exist in Forge. For JSM projects, the `jira:projectSettingsPage` module works.

## Schema Definition Format

The field schema is stored as JSON in Forge App Storage:

```json
{
  "version": 1,
  "fields": [
    {
      "key": "billable",
      "label": "Billable",
      "type": "boolean",
      "description": "Whether this project is billable to a client",
      "required": false,
      "default": false,
      "system": false
    },
    {
      "key": "tags",
      "label": "Tags",
      "type": "multiselect",
      "description": "Tags for categorization and reporting",
      "required": false,
      "options": [],
      "allowCustom": true,
      "system": false
    }
  ]
}
```

**Note on tags:** For multiselect fields with `allowCustom: true`, the label and value are identical (e.g., `{ "label": "Client", "value": "Client" }`). This ensures the API returns exactly what users enter.

### Field Definition Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `key`         | string  | Yes | Unique identifier (alphanumeric, snake_case) |
| `label`       | string  | Yes | Display label |
| `type`        | string  | Yes | Field type (see below) |
| `description` | string  | No  | Help text shown to users |
| `placeholder` | string  | No  | Placeholder text for input fields |
| `required`    | boolean | No  | Whether field must have a value |
| `default`     | any     | No  | Default value for new projects |
| `options`     | array   | For select types | Available options |
| `allowCustom` | boolean | No  | For multiselect, allow custom values |
| `checkboxLabel` | string | No | For boolean fields, custom label text (default: "Yes") |
| `system`      | boolean | No  | If true, cannot be deleted |

## Supported Field Types

| Type | UI Component | Value Type | Notes |
|------|--------------|------------|-------|
| `text`        | Textfield  | string | Single line text |
| `textarea`    | TextArea   | string | Multi-line text |
| `number`      | Textfield (number) | number | Numeric input |
| `boolean`     | Checkbox   | boolean | True/false toggle |
| `select`      | Select     | string | Single selection from options |
| `multiselect` | Select (multiple) | string[] | Multiple selections |
| `date`        | DatePicker | string (ISO) | Date selection |
| `user`        | UserPicker | string (accountId) | Jira user selection |
| `url`         | Textfield (url) | string | URL with validation |

## Default Fields

On first install, the schema should include these default fields (removable by admin):

### 1. Billable (boolean)
```json
{
  "key": "billable",
  "label": "Billable",
  "type": "boolean",
  "description": "Whether this project is billable to a client",
  "required": false,
  "default": false
}
```

### 2. Tags (multiselect)
```json
{
  "key": "tags",
  "label": "Tags",
  "type": "multiselect",
  "description": "Tags for categorization and reporting",
  "required": false,
  "options": [],
  "allowCustom": true
}
```

The Tags field with `allowCustom: true` allows users to add new tag values inline, which then become available for other projects.

## Permissions Model

Forge respects Jira's native permission model:

| Action | Required Permission | Enforced By |
|--------|---------------------|-------------|
| Manage field schema | Jira Administrator | Forge (adminPage module) |
| Edit project values | Project Administrator | Forge (projectSettingsPage module) |
| Read values via API | Project access | Jira REST API |

No custom permission logic is needed - Forge modules automatically enforce these based on module type.

## Project Values Storage

Values for each project are stored in Project Properties:

```json
{
  "billable": true,
  "tags": ["Client", "Managed"],
  "customField1": "value"
}
```

### API Access for External Apps

External applications (like JiraTime) read values via standard Jira REST API:

**Projects:**
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

## File Structure

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
└── README.md                 # User documentation
```

## Build Commands

```bash
# Install Forge CLI (first time)
npm install -g @forge/cli

# Login to Atlassian account
forge login

# Install dependencies
npm install

# Start development (with hot reload)
forge tunnel

# Deploy to production
forge deploy

# Install on a Jira site
forge install

# View logs
forge logs

# List installations
forge install:list
```

## Development Workflow

1. **Setup:** `forge create` from UI Kit template, then customize
2. **Develop:** Use `forge tunnel` for live development
3. **Test:** Install on a test Jira Cloud site
4. **Deploy:** `forge deploy` pushes to production

## UI Kit Components Reference

Key UI Kit components to use:

```jsx
// Forms
import { Form, TextField, TextArea, Select, Option, Checkbox, DatePicker, UserPicker } from '@forge/react';

// Layout
import { Stack, Inline, Box } from '@forge/react';

// Feedback
import { Button, Spinner, SectionMessage, Text, Heading } from '@forge/react';

// Data
import { Table, Head, Row, Cell } from '@forge/react';
```

## Implementation Notes

### Admin Page (admin.jsx)
- List all defined fields with edit/delete actions
- "Add Field" button opens inline field editor
- Up/down arrow buttons for field reordering
- System fields (if `system: true`) cannot be deleted
- Save persists to Forge App Storage immediately
- Validation ensures unique keys and required properties

### Project Page (project.jsx)
- Fetch schema from App Storage on load
- Fetch current values from Project Properties via Jira REST API
- Dynamically render form fields based on schema
- Save button persists to Project Properties
- Show loading states and success/error feedback

### Schema Initialization
- On first admin page load, check if schema exists
- If not, initialize with default fields (Billable, Tags)
- Default fields have `system: false` so they can be removed

### Multiselect with Custom Values
- When `allowCustom: true`, a text input appears below the select
- User types a new value and clicks "Add"
- New values are added to the schema's options array (label = value)
- Custom values are available for all projects once added

## Error Handling

- Handle missing schema gracefully (show "Configure fields in admin" message)
- Handle API errors with user-friendly messages
- Validate field keys are unique when adding/editing
- Validate required fields before saving project values

## Future Considerations (Out of Scope for v1)

- Field grouping/sections
- Conditional fields (show field B if field A = X)
- Field-level permissions (some fields only visible to certain roles)
- Import/export schema
- Audit log of changes
- Bulk edit values across projects
- Webhooks on value changes

## Related Projects

- **JiraTime** (`../jiratime`) - Time tracking app that will consume JiraMetadata values for project configuration like "Included Hours", "Billing Rate", etc.
