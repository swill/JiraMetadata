import React, { useState, useEffect } from 'react';
import ForgeReconciler, {
  Text,
  Box,
  Stack,
  Heading,
  Spinner,
  Button,
  Inline,
  SectionMessage,
  Textfield,
  Select,
  TextArea,
  Checkbox,
  Label,
  HelperMessage,
  ErrorMessage,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const FIELD_TYPES = [
  { label: 'Text', value: 'text' },
  { label: 'Text Area', value: 'textarea' },
  { label: 'Number', value: 'number' },
  { label: 'Checkbox', value: 'boolean' },
  { label: 'Select', value: 'select' },
  { label: 'Multi-Select', value: 'multiselect' },
  { label: 'Date', value: 'date' },
  { label: 'User', value: 'user' },
  { label: 'URL', value: 'url' },
];

function generateKey(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 32);
}

function OptionsEditor({ options, onChange }) {
  const handleAddOption = () => {
    const newOptions = [...(options || []), { label: '', value: '' }];
    onChange(newOptions);
  };

  const handleRemoveOption = (index) => {
    const newOptions = options.filter((_, i) => i !== index);
    onChange(newOptions);
  };

  const handleOptionChange = (index, key, value) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [key]: value };
    // Auto-generate value from label if value is empty (use label as-is, no transformation)
    if (key === 'label' && !newOptions[index].value) {
      newOptions[index].value = value;
    }
    onChange(newOptions);
  };

  return (
    <Stack space="space.100">
      <Label>Options</Label>
      {(options || []).map((opt, index) => (
        <Inline key={index} space="space.100" alignBlock="center">
          <Textfield
            value={opt.label || ''}
            onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
            placeholder="Label"
          />
          <Textfield
            value={opt.value || ''}
            onChange={(e) => handleOptionChange(index, 'value', e.target.value)}
            placeholder="Value"
          />
          <Button
            appearance="subtle"
            onClick={() => handleRemoveOption(index)}
          >
            Remove
          </Button>
        </Inline>
      ))}
      <Button appearance="subtle" onClick={handleAddOption}>
        + Add Option
      </Button>
    </Stack>
  );
}

function FieldEditor({ field, onSave, onCancel, isNew, existingKeys }) {
  const [editedField, setEditedField] = useState({ ...field });
  const [errors, setErrors] = useState([]);

  const handleChange = (key, value) => {
    setEditedField((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === 'label' && isNew) {
        updated.key = generateKey(value);
      }
      // Clear options when changing away from select types
      if (key === 'type' && value !== 'select' && value !== 'multiselect') {
        delete updated.options;
        delete updated.allowCustom;
      }
      return updated;
    });
  };

  const handleOptionsChange = (options) => {
    setEditedField((prev) => ({ ...prev, options }));
  };

  const handleSave = () => {
    const errs = [];
    if (!editedField.label) errs.push('Label is required');
    if (!editedField.key) errs.push('Key is required');
    if (isNew && existingKeys.includes(editedField.key)) {
      errs.push('Key must be unique');
    }
    // Validate options for select types
    if ((editedField.type === 'select' || editedField.type === 'multiselect') &&
        (!editedField.options || editedField.options.length === 0) &&
        !editedField.allowCustom) {
      errs.push('Select fields require at least one option (or enable "Allow custom values")');
    }
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    // Clean up empty options
    if (editedField.options) {
      editedField.options = editedField.options.filter(
        (opt) => opt.label && opt.value
      );
    }
    onSave(editedField);
  };

  const isSelectType = editedField.type === 'select' || editedField.type === 'multiselect';

  return (
    <Box padding="space.200" backgroundColor="color.background.neutral.subtle">
      <Stack space="space.200">
        <Heading as="h3">{isNew ? 'Add New Field' : 'Edit Field'}</Heading>

        {errors.length > 0 && (
          <SectionMessage appearance="error">
            {errors.map((err, i) => (
              <Text key={i}>{err}</Text>
            ))}
          </SectionMessage>
        )}

        <Stack space="space.050">
          <Label labelFor="field-label">Label</Label>
          <Textfield
            id="field-label"
            value={editedField.label || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="e.g., Billing Rate"
          />
        </Stack>

        <Stack space="space.050">
          <Label labelFor="field-key">Key</Label>
          <Textfield
            id="field-key"
            value={editedField.key || ''}
            onChange={(e) => handleChange('key', e.target.value)}
            isDisabled={!isNew}
            placeholder="e.g., billing_rate"
          />
          <HelperMessage>Unique identifier (cannot be changed after creation)</HelperMessage>
        </Stack>

        <Stack space="space.050">
          <Label labelFor="field-type">Type</Label>
          <Select
            inputId="field-type"
            value={FIELD_TYPES.find((t) => t.value === editedField.type)}
            onChange={(selected) => handleChange('type', selected.value)}
            options={FIELD_TYPES}
          />
        </Stack>

        <Stack space="space.050">
          <Label labelFor="field-description">Description (optional)</Label>
          <TextArea
            id="field-description"
            value={editedField.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Help text shown to users"
          />
        </Stack>

        <Stack space="space.050">
          <Label labelFor="field-placeholder">Placeholder (optional)</Label>
          <Textfield
            id="field-placeholder"
            value={editedField.placeholder || ''}
            onChange={(e) => handleChange('placeholder', e.target.value)}
            placeholder="Placeholder text for input fields"
          />
        </Stack>

        <Checkbox
          isChecked={editedField.required || false}
          onChange={(e) => handleChange('required', e.target.checked)}
          label="Required field"
        />

        {isSelectType && (
          <Box padding="space.100" backgroundColor="color.background.neutral">
            <Stack space="space.150">
              <OptionsEditor
                options={editedField.options || []}
                onChange={handleOptionsChange}
              />
              {editedField.type === 'multiselect' && (
                <Checkbox
                  isChecked={editedField.allowCustom || false}
                  onChange={(e) => handleChange('allowCustom', e.target.checked)}
                  label="Allow custom values (users can add new options)"
                />
              )}
            </Stack>
          </Box>
        )}

        {editedField.type === 'boolean' && (
          <Stack space="space.050">
            <Label labelFor="field-checkboxLabel">Checkbox Label (optional)</Label>
            <Textfield
              id="field-checkboxLabel"
              value={editedField.checkboxLabel || ''}
              onChange={(e) => handleChange('checkboxLabel', e.target.value)}
              placeholder="Yes (default)"
            />
            <HelperMessage>Text shown next to the checkbox</HelperMessage>
          </Stack>
        )}

        {/* Default value field - type aware */}
        <Stack space="space.050">
          <Label labelFor="field-default">Default Value (optional)</Label>
          {editedField.type === 'boolean' ? (
            <Checkbox
              isChecked={editedField.default || false}
              onChange={(e) => handleChange('default', e.target.checked)}
              label="Default to checked"
            />
          ) : editedField.type === 'select' && editedField.options?.length > 0 ? (
            <Select
              inputId="field-default"
              value={editedField.default ? editedField.options.find((o) => o.value === editedField.default) : null}
              onChange={(selected) => handleChange('default', selected ? selected.value : null)}
              options={editedField.options}
              isClearable
              placeholder="No default"
            />
          ) : editedField.type === 'number' ? (
            <Textfield
              id="field-default"
              type="number"
              value={editedField.default !== undefined && editedField.default !== null ? String(editedField.default) : ''}
              onChange={(e) => handleChange('default', e.target.value === '' ? null : Number(e.target.value))}
              placeholder="Default number value"
            />
          ) : editedField.type !== 'multiselect' && editedField.type !== 'date' ? (
            <Textfield
              id="field-default"
              value={editedField.default || ''}
              onChange={(e) => handleChange('default', e.target.value || null)}
              placeholder="Default value"
            />
          ) : (
            <HelperMessage>Default values not supported for this field type</HelperMessage>
          )}
        </Stack>

        <Inline space="space.100">
          <Button appearance="primary" onClick={handleSave}>
            {isNew ? 'Add Field' : 'Save'}
          </Button>
          <Button appearance="subtle" onClick={onCancel}>
            Cancel
          </Button>
        </Inline>
      </Stack>
    </Box>
  );
}

function AdminPage() {
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [schemaVersion, setSchemaVersion] = useState(0);

  const loadSchema = async () => {
    try {
      const result = await invoke('getSchema');
      if (result.error) {
        setError(result.error);
      } else {
        setSchema(result.schema);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchema();
  }, []);

  const saveSchema = async (newSchema) => {
    setSaving(true);
    setError(null);
    try {
      const result = await invoke('saveSchema', { schema: newSchema });
      if (result.error) {
        setError(result.error);
        return false;
      }
      // Force reload from storage to ensure we have authoritative state
      const freshResult = await invoke('getSchema');
      if (!freshResult.error) {
        setSchema(freshResult.schema);
        // Increment version to force React to re-render list items
        setSchemaVersion((v) => v + 1);
      }
      return true;
    } catch (err) {
      setError(`Error: ${err.message}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAddField = () => {
    setIsAdding(true);
    setEditingIndex(null);
  };

  const handleEditField = (index) => {
    setEditingIndex(index);
    setIsAdding(false);
  };

  const handleDeleteField = async (index) => {
    const field = schema.fields[index];
    if (field.system) {
      setError('System fields cannot be deleted');
      return;
    }
    const newFields = schema.fields.filter((_, i) => i !== index);
    await saveSchema({ ...schema, fields: newFields });
  };

  const handleMoveField = async (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= schema.fields.length) return;

    const newFields = [...schema.fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    await saveSchema({ ...schema, fields: newFields });
  };

  const handleSaveNew = async (field) => {
    const success = await saveSchema({
      ...schema,
      fields: [...schema.fields, field],
    });
    if (success) {
      setIsAdding(false);
    }
  };

  const handleSaveEdit = async (field) => {
    const newFields = [...schema.fields];
    newFields[editingIndex] = field;
    const success = await saveSchema({ ...schema, fields: newFields });
    if (success) {
      setEditingIndex(null);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingIndex(null);
  };

  if (loading) {
    return (
      <Box padding="space.200">
        <Inline alignBlock="center" space="space.100">
          <Spinner size="medium" />
          <Text>Loading...</Text>
        </Inline>
      </Box>
    );
  }

  const existingKeys = schema?.fields?.map((f) => f.key) || [];

  return (
    <Box padding="space.200">
      <Stack space="space.300">
        {error && (
          <SectionMessage appearance="error" title="Error">
            <Text>{error}</Text>
          </SectionMessage>
        )}

        <Inline spread="space-between" alignBlock="center">
          <Text color="color.text.subtlest">
            Define custom metadata fields for your projects.
          </Text>
          <Button
            appearance="primary"
            onClick={handleAddField}
            isDisabled={isAdding || editingIndex !== null || saving}
          >
            Add Field
          </Button>
        </Inline>

        {isAdding && (
          <FieldEditor
            field={{ key: '', label: '', type: 'text', description: '', required: false }}
            onSave={handleSaveNew}
            onCancel={handleCancel}
            isNew={true}
            existingKeys={existingKeys}
          />
        )}

        {schema && schema.fields && schema.fields.length > 0 ? (
          <Stack space="space.100">
            {schema.fields.map((field, index) => (
              <React.Fragment key={`${schemaVersion}-${index}`}>
                <Box padding="space.150" backgroundColor="color.background.neutral">
                  <Inline spread="space-between" alignBlock="center">
                    <Stack space="space.050">
                      <Text weight="bold">{field.label}</Text>
                      <Text size="small" color="color.text.subtlest">
                        Key: {field.key} | Type: {field.type}
                        {field.required && ' | Required'}
                        {field.options && field.options.length > 0 && ` | ${field.options.length} options`}
                        {field.allowCustom && ' | Custom allowed'}
                        {field.system && ' | System'}
                      </Text>
                      {field.description && (
                        <Text size="small" color="color.text.subtlest">
                          {field.description}
                        </Text>
                      )}
                    </Stack>
                    <Inline space="space.050">
                      <Button
                        appearance="subtle"
                        onClick={() => handleMoveField(index, 'up')}
                        isDisabled={saving || editingIndex !== null || isAdding || index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        appearance="subtle"
                        onClick={() => handleMoveField(index, 'down')}
                        isDisabled={saving || editingIndex !== null || isAdding || index === schema.fields.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        appearance="subtle"
                        onClick={() => handleEditField(index)}
                        isDisabled={saving || editingIndex !== null || isAdding}
                      >
                        Edit
                      </Button>
                      <Button
                        appearance="subtle"
                        onClick={() => handleDeleteField(index)}
                        isDisabled={saving || editingIndex !== null || isAdding || field.system}
                      >
                        Delete
                      </Button>
                    </Inline>
                  </Inline>
                </Box>
                {editingIndex === index && (
                  <FieldEditor
                    field={field}
                    onSave={handleSaveEdit}
                    onCancel={handleCancel}
                    isNew={false}
                    existingKeys={existingKeys.filter((k) => k !== field.key)}
                  />
                )}
              </React.Fragment>
            ))}
          </Stack>
        ) : (
          <SectionMessage appearance="information" title="No fields defined">
            <Text>Click "Add Field" to create your first metadata field.</Text>
          </SectionMessage>
        )}

        {saving && (
          <Inline alignBlock="center" space="space.100">
            <Spinner size="small" />
            <Text>Saving...</Text>
          </Inline>
        )}
      </Stack>
    </Box>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <AdminPage />
  </React.StrictMode>
);
