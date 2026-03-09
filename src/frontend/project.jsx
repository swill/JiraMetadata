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
  DatePicker,
  UserPicker,
  Label,
  HelperMessage,
  RequiredAsterisk,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';

function FieldRenderer({ field, value, onChange, error, onAddCustomOption, subtaskTypes }) {
  const [customInput, setCustomInput] = useState('');

  const handleChange = (newValue) => {
    onChange(field.key, newValue);
  };

  const handleAddCustom = async () => {
    if (!customInput.trim()) return;

    // Use the entered text as both label and value (no transformation)
    const tagValue = customInput.trim();

    // Add to schema via resolver
    if (onAddCustomOption) {
      await onAddCustomOption(field.key, { label: tagValue, value: tagValue });
    }

    // Add to current values
    const currentValues = Array.isArray(value) ? value : [];
    if (!currentValues.includes(tagValue)) {
      handleChange([...currentValues, tagValue]);
    }

    setCustomInput('');
  };

  const renderField = () => {
    switch (field.type) {
      case 'text':
        return (
          <Textfield
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
          />
        );

      case 'textarea':
        return (
          <TextArea
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
          />
        );

      case 'number':
        return (
          <Textfield
            type="number"
            value={value !== null && value !== undefined ? String(value) : ''}
            onChange={(e) => {
              const val = e.target.value;
              handleChange(val === '' ? null : Number(val));
            }}
            placeholder={field.placeholder}
          />
        );

      case 'boolean':
        return (
          <Checkbox
            isChecked={Boolean(value)}
            onChange={(e) => handleChange(e.target.checked)}
            label={field.checkboxLabel || 'Yes'}
          />
        );

      case 'select':
        return (
          <Select
            value={value ? { label: getLabelForValue(field.options, value), value } : null}
            onChange={(selected) => handleChange(selected ? selected.value : '')}
            options={field.options?.map((opt) => ({
              label: opt.label,
              value: opt.value,
            })) || []}
            isClearable
            placeholder={field.placeholder || 'Select...'}
          />
        );

      case 'multiselect':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <Stack space="space.100">
            <Select
              value={selectedValues.map((v) => ({
                label: getLabelForValue(field.options, v) || v,
                value: v,
              }))}
              onChange={(selected) => {
                const newValues = selected ? selected.map((s) => s.value) : [];
                handleChange(newValues);
              }}
              options={field.options?.map((opt) => ({
                label: opt.label,
                value: opt.value,
              })) || []}
              isMulti
              isClearable
              placeholder={field.placeholder || 'Select...'}
            />
            {field.allowCustom && (
              <Inline space="space.100" alignBlock="center">
                <Textfield
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Add custom value..."
                />
                <Button
                  appearance="subtle"
                  onClick={handleAddCustom}
                  isDisabled={!customInput.trim()}
                >
                  Add
                </Button>
              </Inline>
            )}
          </Stack>
        );

      case 'date':
        return (
          <DatePicker
            value={value || ''}
            onChange={(date) => handleChange(date)}
            placeholder={field.placeholder || 'Select date...'}
          />
        );

      case 'url':
        return (
          <Textfield
            type="url"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder || 'https://...'}
          />
        );

      case 'user':
        // UserPicker uses defaultValue (uncontrolled) - use key to force re-render when value changes
        return (
          <UserPicker
            key={`user-${field.key}-${value || 'empty'}`}
            label=""
            name={field.key}
            defaultValue={value || undefined}
            onChange={(user) => {
              // UserPicker returns a user object with id property
              handleChange(user ? user.id : null);
            }}
            placeholder={field.placeholder || 'Select user...'}
          />
        );

      case 'subtasktype': {
        const selectedIds = Array.isArray(value) ? value : [];
        const exclusions = Array.isArray(field.exclusions) ? field.exclusions.filter(Boolean) : [];
        const filteredTypes = (subtaskTypes || []).filter(
          (t) => !exclusions.some((ex) => t.label.includes(ex))
        );
        return (
          <Select
            value={selectedIds
              .map((id) => filteredTypes.find((t) => t.value === id))
              .filter(Boolean)}
            onChange={(selected) => {
              handleChange(selected ? selected.map((s) => s.value) : []);
            }}
            options={filteredTypes}
            isMulti
            isClearable
            placeholder={field.placeholder || 'Select sub-task types...'}
          />
        );
      }

      default:
        return (
          <Textfield
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
          />
        );
    }
  };

  return (
    <Stack space="space.050">
      <Label labelFor={field.key}>
        {field.label}
        {field.required && <RequiredAsterisk />}
      </Label>
      {renderField()}
      {field.description && !error && (
        <HelperMessage>{field.description}</HelperMessage>
      )}
      {error && <Text color="color.text.danger">{error}</Text>}
    </Stack>
  );
}

function getLabelForValue(options, value) {
  if (!options || !value) return value;
  const option = options.find((o) => o.value === value);
  return option ? option.label : value;
}

function ProjectPage() {
  const context = useProductContext();
  // Context is undefined/null while loading, then populates with extension data
  const projectKey = context?.extension?.project?.key;
  const projectName = context?.extension?.project?.name;

  const [schema, setSchema] = useState(null);
  const [values, setValues] = useState({});
  const [subtaskTypes, setSubtaskTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [contextLoaded, setContextLoaded] = useState(false);

  // Track when context finishes loading
  useEffect(() => {
    // Context can be undefined, null, or an empty object while loading
    // Once it has extension data, it's loaded
    if (context && context.extension) {
      setContextLoaded(true);
    }
  }, [context]);

  useEffect(() => {
    // Don't load data until context is ready
    if (!contextLoaded) {
      return;
    }

    const loadData = async () => {
      try {
        // Load schema first
        const schemaResult = await invoke('getSchema');
        if (schemaResult.error) {
          setError(schemaResult.error);
          setLoading(false);
          return;
        }
        setSchema(schemaResult.schema);

        // Fetch subtask types if any field needs them
        const hasSubtaskField = schemaResult.schema?.fields?.some((f) => f.type === 'subtasktype');
        if (hasSubtaskField) {
          const subtaskTypesResult = await invoke('getSubtaskTypes');
          if (!subtaskTypesResult.error) {
            setSubtaskTypes(subtaskTypesResult.subtaskTypes || []);
          }
        }

        // Load values - the resolver will get projectKey from its own context
        const valuesResult = await invoke('getValues', {
          contextType: 'project',
          contextId: projectKey,
        });
        if (valuesResult.error) {
          setError(valuesResult.error);
        } else {
          // Compute defaults from schema
          const defaultValues = {};
          schemaResult.schema?.fields?.forEach((field) => {
            if (field.default !== undefined) {
              defaultValues[field.key] = field.default;
            }
          });
          const mergedValues = { ...defaultValues, ...valuesResult.values };
          setValues(mergedValues);

          // Auto-save defaults to project properties when this is a new project
          if (valuesResult.isNew && Object.keys(defaultValues).length > 0) {
            invoke('saveValues', {
              contextType: 'project',
              contextId: projectKey,
              values: mergedValues,
            }).catch((err) => {
              console.error('Failed to auto-save defaults:', err);
            });
          }
        }
      } catch (err) {
        setError(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    // Always try to load data - the resolver has its own context and may have the project key
    // even if the frontend context doesn't
    setError(null);
    loadData();
  }, [contextLoaded]);

  const handleChange = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const handleAddCustomOption = async (fieldKey, newOption) => {
    try {
      const result = await invoke('addCustomOption', { fieldKey, newOption });
      if (result.error) {
        console.error('Failed to add custom option:', result.error);
      } else if (result.schema) {
        // Update local schema with new options
        setSchema(result.schema);
      }
    } catch (err) {
      console.error('Error adding custom option:', err);
    }
  };

  const validateValues = () => {
    const errors = {};
    schema?.fields?.forEach((field) => {
      const value = values[field.key];
      if (field.required) {
        if (value === undefined || value === null || value === '') {
          errors[field.key] = `${field.label} is required`;
        } else if (Array.isArray(value) && value.length === 0) {
          errors[field.key] = `${field.label} is required`;
        }
      }
      if (field.type === 'url' && value) {
        try {
          new URL(value);
        } catch {
          errors[field.key] = `${field.label} must be a valid URL`;
        }
      }
    });
    return errors;
  };

  const handleSave = async () => {
    const errors = validateValues();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSaving(true);
    setError(null);
    setValidationErrors({});

    try {
      const result = await invoke('saveValues', {
        contextType: 'project',
        contextId: projectKey,
        values,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
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

  if (error && !schema) {
    return (
      <Box padding="space.200">
        <SectionMessage appearance="error" title="Error">
          <Text>{error}</Text>
        </SectionMessage>
      </Box>
    );
  }

  if (!schema || !schema.fields || schema.fields.length === 0) {
    return (
      <Box padding="space.200">
        <SectionMessage appearance="information" title="No fields configured">
          <Text>
            No metadata fields have been configured yet. Ask a Jira administrator
            to configure fields in Jira Settings → Apps → JiraMetadata Config.
          </Text>
        </SectionMessage>
      </Box>
    );
  }

  return (
    <Box padding="space.200">
      <Stack space="space.300">
        {projectName && (
          <Text color="color.text.subtlest">{projectName}</Text>
        )}

        {error && (
          <SectionMessage appearance="error" title="Error">
            <Text>{error}</Text>
          </SectionMessage>
        )}

        {saveSuccess && (
          <SectionMessage appearance="success" title="Saved">
            <Text>Metadata saved successfully.</Text>
          </SectionMessage>
        )}

        <Stack space="space.200">
          {schema.fields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={handleChange}
              error={validationErrors[field.key]}
              onAddCustomOption={handleAddCustomOption}
              subtaskTypes={subtaskTypes}
            />
          ))}
        </Stack>

        <Inline space="space.100">
          <Button
            appearance="primary"
            onClick={handleSave}
            isDisabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Inline>
      </Stack>
    </Box>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <ProjectPage />
  </React.StrictMode>
);
