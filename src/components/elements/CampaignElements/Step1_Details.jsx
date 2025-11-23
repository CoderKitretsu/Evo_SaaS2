import React, { useState, useEffect } from 'react';
import campaignService from './campaignService.js';
import { useInstanceManager } from '../../../hooks/useInstanceManager.js';

// Common timezone options
const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (UTC+05:30)' },
  { value: 'America/New_York', label: 'America/New_York (UTC-05:00)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-08:00)' },
  { value: 'Europe/London', label: 'Europe/London (UTC+00:00)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (UTC+01:00)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+09:00)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+08:00)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (UTC+11:00)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (UTC+13:00)' },
  { value: 'America/Chicago', label: 'America/Chicago (UTC-06:00)' },
  { value: 'America/Denver', label: 'America/Denver (UTC-07:00)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (UTC+01:00)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC+04:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+08:00)' },
  { value: 'UTC', label: 'UTC (UTC+00:00)' }
];

/**
 * Step 1: Campaign Details
 * Complete implementation with all required fields, validation, and accessibility
 */
const Step1_Details = ({ draftId, draftData, onDataChange, onNext, onBack, isFirst, isLast }) => {
  // Get API configuration from localStorage
  const apiUrl = localStorage.getItem('apiUrl') || 'http://localhost:8080';
  const apiKey = localStorage.getItem('apiKey') || '';
  
  const buildHeaders = () => ({
    "Content-Type": "application/json",
    "apikey": apiKey.trim()
  });

  // Use the instance manager hook
  const {
    availableInstances,
    fetchInstances
  } = useInstanceManager(apiUrl, apiKey, buildHeaders);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    instanceId: '',
    startAt: '',
    endAt: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dryRun: true,
    throttle: 'safe',
    maxBatchSize: 50,
    retryPolicy: {
      enabled: true,
      maxAttempts: 2
    },
    saveAsTemplate: false
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Load draft data and available instances on mount
  useEffect(() => {
    if (draftId) {
      loadDraftData();
    }
    // Fetch real instances from API
    if (apiUrl && apiKey) {
      fetchInstances();
    }
    setDefaultStartTime();
  }, [draftId, apiUrl, apiKey]);

  const loadDraftData = () => {
    try {
      const draft = campaignService.getDraft(draftId);
      if (draft && draft.meta) {
        setFormData(prev => ({
          ...prev,
          ...draft.meta,
          startAt: draft.meta.startAt ? formatDateTimeLocal(new Date(draft.meta.startAt)) : getDefaultStartTime(),
          endAt: draft.meta.endAt ? formatDateTimeLocal(new Date(draft.meta.endAt)) : '',
          retryPolicy: {
            enabled: draft.meta.retryPolicy?.enabled !== undefined ? draft.meta.retryPolicy.enabled : true,
            maxAttempts: draft.meta.retryPolicy?.maxAttempts || 2
          }
        }));
      }
    } catch (error) {
      console.error('Failed to load draft data:', error);
    }
  };

  // Helper function to get instance display name and status
  const getInstanceData = (instance) => {
    const name = instance.name || instance.instance?.instanceName || instance.instanceName || 'Unknown Instance';
    const rawStatus = instance.instance?.connectionStatus || 
                     instance.connectionStatus || 
                     instance.instance?.state ||
                     instance.state ||
                     'unknown';
    const status = String(rawStatus).toLowerCase();
    return { name, status };
  };

  // Refresh instances function
  const refreshInstances = async () => {
    if (apiUrl && apiKey) {
      try {
        await fetchInstances();
      } catch (error) {
        console.error('Failed to refresh instances:', error);
      }
    }
  };

  const getDefaultStartTime = () => {
    const defaultStart = new Date(Date.now() + 300000); // 5 minutes from now
    return formatDateTimeLocal(defaultStart);
  };

  const setDefaultStartTime = () => {
    if (!formData.startAt) {
      setFormData(prev => ({
        ...prev,
        startAt: getDefaultStartTime()
      }));
    }
  };

  const formatDateTimeLocal = (date) => {
    return date.toISOString().slice(0, 16);
  };

  const validateNameUniqueness = async (name) => {
    if (!name || name.trim() === '') return true;
    
    setIsValidating(true);
    try {
      const campaigns = campaignService.listCampaigns();
      const nameExists = campaigns.some(campaign => 
        campaign.name.toLowerCase().trim() === name.toLowerCase().trim() &&
        campaign.campaignId !== draftData?.campaignId // Allow current campaign
      );
      return !nameExists;
    } catch (error) {
      console.error('Error validating name uniqueness:', error);
      return true; // Allow on error to prevent blocking
    } finally {
      setIsValidating(false);
    }
  };

  const validateForm = async () => {
    const newErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Campaign name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Campaign name must be at least 3 characters';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Campaign name must be less than 100 characters';
    } else {
      const isUnique = await validateNameUniqueness(formData.name);
      if (!isUnique) {
        newErrors.name = 'Campaign name already exists. Please choose a different name.';
      }
    }

    // Description validation (optional but limited)
    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    // Instance validation
    if (!formData.instanceId) {
      newErrors.instanceId = 'WhatsApp instance selection is required';
    }

    // Start date validation
    if (!formData.startAt) {
      newErrors.startAt = 'Start date and time is required';
    } else {
      const startTime = new Date(formData.startAt).getTime();
      const now = Date.now();
      const minStart = now + 60000; // At least 1 minute in the future
      
      if (startTime < minStart) {
        newErrors.startAt = 'Start time must be at least 1 minute in the future';
      }

      // Check if start time is too far in the future (1 year)
      const maxStart = now + (365 * 24 * 60 * 60 * 1000);
      if (startTime > maxStart) {
        newErrors.startAt = 'Start time cannot be more than 1 year in the future';
      }
    }

    // End date validation (optional but must be after start)
    if (formData.endAt) {
      const startTime = new Date(formData.startAt).getTime();
      const endTime = new Date(formData.endAt).getTime();
      
      if (endTime <= startTime) {
        newErrors.endAt = 'End time must be after start time';
      }

      // Minimum campaign duration (5 minutes)
      if (endTime - startTime < 300000) {
        newErrors.endAt = 'Campaign duration must be at least 5 minutes';
      }
    }

    // Batch size validation
    if (!formData.maxBatchSize || formData.maxBatchSize < 1) {
      newErrors.maxBatchSize = 'Batch size must be at least 1';
    } else if (formData.maxBatchSize > 1000) {
      newErrors.maxBatchSize = 'Batch size cannot exceed 1000';
    }

    // Retry attempts validation
    if (formData.retryPolicy.enabled) {
      if (!formData.retryPolicy.maxAttempts || formData.retryPolicy.maxAttempts < 1) {
        newErrors.retryAttempts = 'Retry attempts must be at least 1';
      } else if (formData.retryPolicy.maxAttempts > 5) {
        newErrors.retryAttempts = 'Retry attempts cannot exceed 5';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleRetryPolicyChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      retryPolicy: {
        ...prev.retryPolicy,
        [field]: value
      }
    }));

    // Clear retry-related errors
    if (errors.retryAttempts) {
      setErrors(prev => ({
        ...prev,
        retryAttempts: undefined
      }));
    }
  };

  const handleNext = async () => {
    const isValid = await validateForm();
    if (!isValid) {
      return;
    }

    setLoading(true);
    try {
      // Convert dates back to timestamps for storage
      const metaData = {
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim(),
        startAt: new Date(formData.startAt).getTime(),
        endAt: formData.endAt ? new Date(formData.endAt).getTime() : null
      };

      // Save to draft
      const result = campaignService.saveDraft(draftId, { meta: metaData });
      
      if (result.success) {
        onDataChange({ meta: metaData });
        onNext();
      } else {
        setErrors({ submit: result.error });
      }
    } catch (error) {
      setErrors({ submit: 'Failed to save campaign details. Please try again.' });
      console.error('Save details error:', error);
    } finally {
      setLoading(false);
    }
  };



  const getThrottleDescription = (throttle) => {
    const descriptions = {
      safe: '1 message per second - Recommended for most campaigns',
      moderate: '5 messages per second - For established accounts',
      fast: '20 messages per second - Use with caution, risk of restrictions'
    };
    return descriptions[throttle] || '';
  };

  const getInstanceStatusBadge = (status) => {
    const statusMap = {
      connected: 'bg-green-100 text-green-800',
      disconnected: 'bg-red-100 text-red-800',
      unknown: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusMap[status] || statusMap.unknown}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Campaign Details</h2>
        <p className="text-gray-600">
          Configure the basic settings and schedule for your campaign. All fields marked with * are required.
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
        {/* Campaign Name */}
        <div>
          <label htmlFor="campaign-name" className="block text-sm font-medium text-gray-700 mb-2">
            Campaign Name *
          </label>
          <div className="relative">
            <input
              id="campaign-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter a unique campaign name"
              aria-describedby="name-error name-help"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={100}
            />
            {isValidating && (
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              </div>
            )}
          </div>
          <p id="name-help" className="mt-1 text-sm text-gray-500">
            Choose a unique, descriptive name for your campaign
          </p>
          {errors.name && (
            <p id="name-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="campaign-description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="campaign-description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Optional campaign description"
            rows={3}
            maxLength={500}
            aria-describedby="description-help"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p id="description-help" className="mt-1 text-sm text-gray-500">
            Briefly describe the purpose of this campaign ({formData.description.length}/500 characters)
          </p>
          {errors.description && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {errors.description}
            </p>
          )}
        </div>

        {/* WhatsApp Instance */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="whatsapp-instance" className="block text-sm font-medium text-gray-700">
              WhatsApp Instance *
            </label>
            <button
              type="button"
              onClick={refreshInstances}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
          <select
            id="whatsapp-instance"
            value={formData.instanceId}
            onChange={(e) => handleInputChange('instanceId', e.target.value)}
            aria-describedby="instance-error instance-help"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.instanceId ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select a WhatsApp instance</option>
            {availableInstances.length > 0 ? (
              availableInstances.map((instance, index) => {
                const { name, status } = getInstanceData(instance);
                return (
                  <option key={name || index} value={name}>
                    {name} ({status === 'connected' || status === 'open' || status === 'ready' ? 'Connected' : 
                           status === 'connecting' || status === 'opening' ? 'Connecting' : 
                           status.charAt(0).toUpperCase() + status.slice(1)})
                  </option>
                );
              })
            ) : (
              <option value="" disabled>No instances found - Check API configuration</option>
            )}
          </select>
          <p id="instance-help" className="mt-1 text-sm text-gray-500">
            Choose the WhatsApp Business account to send from
          </p>
          {formData.instanceId && availableInstances.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-600">Status:</span>
              {(() => {
                const instance = availableInstances.find(inst => {
                  const { name } = getInstanceData(inst);
                  return name === formData.instanceId;
                });
                if (instance) {
                  const { status } = getInstanceData(instance);
                  return getInstanceStatusBadge(status);
                }
                return getInstanceStatusBadge('unknown');
              })()}
            </div>
          )}
          {!apiUrl || !apiKey ? (
            <p className="mt-1 text-sm text-yellow-600">
              ⚠️ API configuration required to load instances
            </p>
          ) : availableInstances.length === 0 ? (
            <p className="mt-1 text-sm text-orange-600">
              No instances found. Please check your API configuration or create an instance.
            </p>
          ) : null}
          {errors.instanceId && (
            <p id="instance-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.instanceId}
            </p>
          )}
        </div>

        {/* Scheduling */}
        <fieldset>
          <legend className="text-lg font-medium text-gray-900 mb-4">Campaign Schedule</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-time" className="block text-sm font-medium text-gray-700 mb-2">
                Start Date & Time *
              </label>
              <input
                id="start-time"
                type="datetime-local"
                value={formData.startAt}
                onChange={(e) => handleInputChange('startAt', e.target.value)}
                aria-describedby="start-error start-help"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.startAt ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <p id="start-help" className="mt-1 text-sm text-gray-500">
                When to begin sending messages
              </p>
              {errors.startAt && (
                <p id="start-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.startAt}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="end-time" className="block text-sm font-medium text-gray-700 mb-2">
                End Date & Time
              </label>
              <input
                id="end-time"
                type="datetime-local"
                value={formData.endAt}
                onChange={(e) => handleInputChange('endAt', e.target.value)}
                aria-describedby="end-help"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.endAt ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <p id="end-help" className="mt-1 text-sm text-gray-500">
                Optional deadline for the campaign
              </p>
              {errors.endAt && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {errors.endAt}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        {/* Timezone */}
        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
            Timezone
          </label>
          <select
            id="timezone"
            value={formData.timezone}
            onChange={(e) => handleInputChange('timezone', e.target.value)}
            aria-describedby="timezone-help"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
          <p id="timezone-help" className="mt-1 text-sm text-gray-500">
            Selected timezone: {formData.timezone}. All campaign times will be converted to UTC for storage.
          </p>
        </div>

        {/* Campaign Settings */}
        <fieldset className="space-y-4 border-t pt-6">
          <legend className="text-lg font-medium text-gray-900">Campaign Settings</legend>
          
          {/* Dry Run */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="dry-run"
                type="checkbox"
                checked={formData.dryRun}
                onChange={(e) => handleInputChange('dryRun', e.target.checked)}
                aria-describedby="dry-run-help"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="dry-run" className="text-sm font-medium text-gray-700">
                Dry Run Mode (Recommended for Testing)
              </label>
              <p id="dry-run-help" className="text-sm text-gray-500">
                Simulate the campaign without actually sending messages. Perfect for testing.
              </p>
            </div>
          </div>

          {/* Throttle Preset */}
          <div>
            <label htmlFor="throttle" className="block text-sm font-medium text-gray-700 mb-2">
              Sending Speed
            </label>
            <select
              id="throttle"
              value={formData.throttle}
              onChange={(e) => handleInputChange('throttle', e.target.value)}
              aria-describedby="throttle-help"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="safe">Safe - 1 message/second</option>
              <option value="moderate">Moderate - 5 messages/second</option>
              <option value="fast">Fast - 20 messages/second</option>
            </select>
            <p id="throttle-help" className="mt-1 text-sm text-gray-500">
              {getThrottleDescription(formData.throttle)}
            </p>
          </div>

          {/* Max Batch Size */}
          <div>
            <label htmlFor="batch-size" className="block text-sm font-medium text-gray-700 mb-2">
              Max Batch Size
            </label>
            <input
              id="batch-size"
              type="number"
              min="1"
              max="1000"
              value={formData.maxBatchSize}
              onChange={(e) => handleInputChange('maxBatchSize', parseInt(e.target.value) || 1)}
              aria-describedby="batch-size-help"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.maxBatchSize ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            <p id="batch-size-help" className="mt-1 text-sm text-gray-500">
              Number of messages to process simultaneously (1-1000)
            </p>
            {errors.maxBatchSize && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.maxBatchSize}
              </p>
            )}
          </div>

          {/* Retry Policy */}
          <div className="space-y-3">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="retry-enabled"
                  type="checkbox"
                  checked={formData.retryPolicy.enabled}
                  onChange={(e) => handleRetryPolicyChange('enabled', e.target.checked)}
                  aria-describedby="retry-help"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="retry-enabled" className="text-sm font-medium text-gray-700">
                  Enable automatic retry on failure
                </label>
                <p id="retry-help" className="text-sm text-gray-500">
                  Automatically retry failed messages with exponential backoff
                </p>
              </div>
            </div>
            
            {formData.retryPolicy.enabled && (
              <div className="ml-7">
                <label htmlFor="retry-attempts" className="block text-sm text-gray-700 mb-1">
                  Maximum retry attempts
                </label>
                <input
                  id="retry-attempts"
                  type="number"
                  min="1"
                  max="5"
                  value={formData.retryPolicy.maxAttempts}
                  onChange={(e) => handleRetryPolicyChange('maxAttempts', parseInt(e.target.value) || 1)}
                  aria-describedby="retry-attempts-help"
                  className={`w-32 px-3 py-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.retryAttempts ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <p id="retry-attempts-help" className="mt-1 text-sm text-gray-500">
                  How many times to retry failed messages (1-5)
                </p>
                {errors.retryAttempts && (
                  <p className="mt-1 text-sm text-red-600" role="alert">
                    {errors.retryAttempts}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Save as Template */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="save-template"
                type="checkbox"
                checked={formData.saveAsTemplate}
                onChange={(e) => handleInputChange('saveAsTemplate', e.target.checked)}
                aria-describedby="template-help"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="save-template" className="text-sm font-medium text-gray-700">
                Save configuration as template
              </label>
              <p id="template-help" className="text-sm text-gray-500">
                Save these settings for future campaigns
              </p>
            </div>
          </div>
        </fieldset>

        {errors.submit && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
            {errors.submit}
          </div>
        )}

        {/* Step Actions */}
        <div className="pt-6 border-t">
          <div className="flex justify-between items-center">
            <div>
              {!isFirst && (
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 rounded"
                >
                  ← Back
                </button>
              )}
            </div>
            <div>
              <button
                type="submit"
                disabled={loading || isValidating}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  'Next: Add Contacts →'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Step1_Details;