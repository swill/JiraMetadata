import Resolver from '@forge/resolver';
import api, { storage, route } from '@forge/api';

const resolver = new Resolver();

const SCHEMA_STORAGE_KEY = 'field-schema';
const VALUES_PROPERTY_KEY = 'jirametadata';
const SCHEMA_VERSION = 1;

/**
 * Default schema with initial fields
 */
function getDefaultSchema() {
  return {
    version: SCHEMA_VERSION,
    fields: [
      {
        key: 'billable',
        label: 'Billable',
        type: 'boolean',
        description: 'Whether this project is billable to a client',
        required: false,
        default: false,
        system: false,
      },
      {
        key: 'tags',
        label: 'Tags',
        type: 'multiselect',
        description: 'Tags for categorization and reporting',
        required: false,
        options: [],
        allowCustom: true,
        system: false,
      },
    ],
  };
}

/**
 * Get the field schema from Forge App Storage
 */
resolver.define('getSchema', async () => {
  try {
    let schema = await storage.get(SCHEMA_STORAGE_KEY);

    if (!schema) {
      schema = getDefaultSchema();
      await storage.set(SCHEMA_STORAGE_KEY, schema);
    }

    return { schema };
  } catch (err) {
    console.error('Error getting schema:', err);
    return { error: err.message || 'Failed to load schema' };
  }
});

/**
 * Save the field schema to Forge App Storage
 */
resolver.define('saveSchema', async ({ payload }) => {
  try {
    const { schema } = payload;

    if (!schema || !Array.isArray(schema.fields)) {
      return { error: 'Invalid schema format' };
    }

    schema.version = SCHEMA_VERSION;

    await storage.set(SCHEMA_STORAGE_KEY, schema);

    return { schema };
  } catch (err) {
    console.error('Error saving schema:', err);
    return { error: err.message || 'Failed to save schema' };
  }
});

/**
 * Get field values from Project Properties via Jira REST API
 */
resolver.define('getValues', async ({ payload, context }) => {
  try {
    const { contextType, contextId } = payload || {};

    if (contextType && contextType !== 'project') {
      return { error: `Unsupported context type: ${contextType}` };
    }

    // Get project key from context first (resolver context is reliable)
    const projectKey = context?.extension?.project?.key || contextId;
    console.log('getValues - projectKey:', projectKey);
    console.log('getValues - full context:', JSON.stringify(context, null, 2));

    if (!projectKey) {
      return { error: 'No project context available in resolver' };
    }

    const url = `/rest/api/3/project/${projectKey}/properties/${VALUES_PROPERTY_KEY}`;
    console.log('getValues - requesting:', url);

    const response = await api.asApp().requestJira(route`/rest/api/3/project/${projectKey}/properties/${VALUES_PROPERTY_KEY}`, {
      method: 'GET',
    });

    console.log('getValues - response status:', response.status);

    if (response.status === 404) {
      // Property doesn't exist yet - return empty values and flag as new
      return { values: {}, isNew: true };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error getting project properties:', response.status, errorText);
      return { error: `Failed to load values: ${response.status}` };
    }

    const data = await response.json();
    return { values: data.value || {} };
  } catch (err) {
    console.error('Error getting values:', err);
    return { error: err.message || 'Failed to load values' };
  }
});

/**
 * Save field values to Project Properties via Jira REST API
 */
resolver.define('saveValues', async ({ payload, context }) => {
  try {
    const { contextType, contextId, values } = payload || {};

    if (contextType && contextType !== 'project') {
      return { error: `Unsupported context type: ${contextType}` };
    }

    // Get project key from context (resolver context is reliable)
    const projectKey = context?.extension?.project?.key || contextId;
    console.log('saveValues - projectKey:', projectKey);
    console.log('saveValues - values:', JSON.stringify(values));

    if (!projectKey) {
      return { error: 'No project context available in resolver' };
    }

    const url = `/rest/api/3/project/${projectKey}/properties/${VALUES_PROPERTY_KEY}`;
    console.log('saveValues - requesting PUT to:', url);

    const response = await api.asApp().requestJira(route`/rest/api/3/project/${projectKey}/properties/${VALUES_PROPERTY_KEY}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(values),
    });

    console.log('saveValues - response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error saving project properties:', response.status, errorText);
      return { error: `Failed to save values: ${response.status} - ${errorText}` };
    }

    return { values };
  } catch (err) {
    console.error('Error saving values:', err);
    return { error: err.message || 'Failed to save values' };
  }
});

/**
 * Update schema options when custom values are added (for multiselect with allowCustom)
 */
resolver.define('addCustomOption', async ({ payload }) => {
  try {
    const { fieldKey, newOption } = payload;

    const schema = await storage.get(SCHEMA_STORAGE_KEY);
    if (!schema) {
      return { error: 'Schema not found' };
    }

    const fieldIndex = schema.fields.findIndex((f) => f.key === fieldKey);
    if (fieldIndex === -1) {
      return { error: `Field not found: ${fieldKey}` };
    }

    const field = schema.fields[fieldIndex];
    if (!field.allowCustom) {
      return { error: 'Field does not allow custom options' };
    }

    if (!field.options) {
      field.options = [];
    }

    const exists = field.options.some((o) => o.value === newOption.value);
    if (!exists) {
      field.options.push(newOption);
      await storage.set(SCHEMA_STORAGE_KEY, schema);
    }

    return { schema };
  } catch (err) {
    console.error('Error adding custom option:', err);
    return { error: err.message || 'Failed to add custom option' };
  }
});

/**
 * Get sub-task issue types from Jira
 */
resolver.define('getSubtaskTypes', async () => {
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/issuetype`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching issue types:', response.status, errorText);
      return { error: `Failed to fetch issue types: ${response.status}` };
    }

    const issueTypes = await response.json();
    const subtaskTypes = issueTypes
      .filter((t) => t.subtask === true)
      .map((t) => ({ label: t.name, value: t.id, iconUrl: t.iconUrl }));

    return { subtaskTypes };
  } catch (err) {
    console.error('Error fetching subtask types:', err);
    return { error: err.message || 'Failed to fetch subtask types' };
  }
});

export const handler = resolver.getDefinitions();
