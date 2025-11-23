import React, { useState, useEffect } from 'react';
import campaignService from './campaignService.js';

/**
 * Step 1: Campaign Details
 * Fields: name, description, instance, startAt, endAt, timezone, dryRun, throttle, maxBatchSize, retryPolicy
 */
const Step1_Details = ({ draftId, draftData, onDataChange, onNext, onBack, isFirst, isLast }) => {
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
  const [availableInstances, setAvailableInstances] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load draft data on mount
  useEffect(() => {
    if (draftId) {
      loadDraftData();
    }
    loadAvailableInstances();
  }, [draftId]);

  const loadDraftData = () => {
    try {
      const draft = campaignService.getDraft(draftId);
      if (draft && draft.meta) {
        setFormData(prev => ({
          ...prev,
          ...draft.meta,
          startAt: draft.meta.startAt ? new Date(draft.meta.startAt).toISOString().slice(0, 16) : '',
          endAt: draft.meta.endAt ? new Date(draft.meta.endAt).toISOString().slice(0, 16) : ''
        }));
      }
    } catch (error) {
      console.error('Failed to load draft data:', error);
    }
  };

  const loadAvailableInstances = () => {
    // TODO: Load available WhatsApp instances from existing instance manager
    // For now, use placeholder data
    setAvailableInstances([
      { id: 'instance-1', name: 'Primary WhatsApp', status: 'connected' },
      { id: 'instance-2', name: 'Secondary WhatsApp', status: 'disconnected' },
      { id: 'instance-3', name: 'Test Instance', status: 'connected' }
    ]);
  };

  const validateForm = () => {
    const newErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Campaign name is required';
    } else {
      // Check name uniqueness
      const campaigns = campaignService.listCampaigns();
      const nameExists = campaigns.some(campaign => 
        campaign.name.toLowerCase() === formData.name.toLowerCase()
      );
      if (nameExists) {
        newErrors.name = 'Campaign name already exists';
      }
    }

    // Instance validation
    if (!formData.instanceId) {
      newErrors.instanceId = 'WhatsApp instance is required';
    }

    // Start date validation
    if (!formData.startAt) {
      newErrors.startAt = 'Start date and time is required';
    } else {
      const startTime = new Date(formData.startAt).getTime();
      const now = Date.now();
      if (startTime < now) {
        newErrors.startAt = 'Start time must be in the future';
      }
    }

    // End date validation (optional but must be after start)
    if (formData.endAt) {
      const startTime = new Date(formData.startAt).getTime();
      const endTime = new Date(formData.endAt).getTime();
      if (endTime <= startTime) {
        newErrors.endAt = 'End time must be after start time';
      }
    }

    // Batch size validation
    if (formData.maxBatchSize < 1 || formData.maxBatchSize > 1000) {
      newErrors.maxBatchSize = 'Batch size must be between 1 and 1000';
    }

    // Retry attempts validation
    if (formData.retryPolicy.enabled && (formData.retryPolicy.maxAttempts < 1 || formData.retryPolicy.maxAttempts > 5)) {
      newErrors.retryAttempts = 'Retry attempts must be between 1 and 5';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
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
  };

  const handleNext = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Convert dates back to timestamps
      const metaData = {
        ...formData,
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
      setErrors({ submit: 'Failed to save campaign details' });
      console.error('Save details error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultStartTime = () => {
    const defaultStart = new Date(Date.now() + 300000); // 5 minutes from now
    return defaultStart.toISOString().slice(0, 16);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Campaign Details</h2>
        <p className="text-gray-600">Configure the basic settings for your campaign.</p>
      </div>

      <div className="space-y-6">
        {/* Campaign Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Campaign Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Enter a unique campaign name"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Optional campaign description"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* WhatsApp Instance */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            WhatsApp Instance *
          </label>
          <select
            value={formData.instanceId}
            onChange={(e) => handleInputChange('instanceId', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.instanceId ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select an instance</option>
            {availableInstances.map(instance => (
              <option key={instance.id} value={instance.id}>
                {instance.name} ({instance.status})
              </option>
            ))}
          </select>
          {errors.instanceId && <p className="mt-1 text-sm text-red-600">{errors.instanceId}</p>}
        </div>

        {/* Scheduling */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date & Time *
            </label>
            <input
              type="datetime-local"
              value={formData.startAt || getDefaultStartTime()}
              onChange={(e) => handleInputChange('startAt', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.startAt ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.startAt && <p className="mt-1 text-sm text-red-600">{errors.startAt}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date & Time
            </label>
            <input
              type="datetime-local"
              value={formData.endAt}
              onChange={(e) => handleInputChange('endAt', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.endAt ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.endAt && <p className="mt-1 text-sm text-red-600">{errors.endAt}</p>}
            <p className="mt-1 text-xs text-gray-500">Optional campaign end time</p>
          </div>
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Timezone
          </label>
          <input
            type="text"
            value={formData.timezone}
            onChange={(e) => handleInputChange('timezone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Auto-detected timezone"
          />
        </div>

        {/* Campaign Settings */}
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-medium text-gray-900">Campaign Settings</h3>
          
          {/* Dry Run */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="dryRun"
              checked={formData.dryRun}
              onChange={(e) => handleInputChange('dryRun', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="dryRun" className="ml-2 text-sm text-gray-700">
              Dry Run (simulate sending without actual messages)
            </label>
          </div>

          {/* Throttle Preset */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sending Speed
            </label>
            <select
              value={formData.throttle}
              onChange={(e) => handleInputChange('throttle', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="safe">Safe (1 message/second)</option>
              <option value="moderate">Moderate (5 messages/second)</option>
              <option value="fast">Fast (20 messages/second)</option>
            </select>
          </div>

          {/* Max Batch Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Batch Size
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={formData.maxBatchSize}
              onChange={(e) => handleInputChange('maxBatchSize', parseInt(e.target.value))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.maxBatchSize ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.maxBatchSize && <p className="mt-1 text-sm text-red-600">{errors.maxBatchSize}</p>}
          </div>

          {/* Retry Policy */}
          <div>
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="retryEnabled"
                checked={formData.retryPolicy.enabled}
                onChange={(e) => handleRetryPolicyChange('enabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="retryEnabled" className="ml-2 text-sm font-medium text-gray-700">
                Enable retry on failure
              </label>
            </div>
            
            {formData.retryPolicy.enabled && (
              <div className="ml-6">
                <label className="block text-sm text-gray-600 mb-1">
                  Max Retry Attempts
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={formData.retryPolicy.maxAttempts}
                  onChange={(e) => handleRetryPolicyChange('maxAttempts', parseInt(e.target.value))}
                  className={`w-32 px-3 py-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.retryAttempts ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.retryAttempts && <p className="mt-1 text-sm text-red-600">{errors.retryAttempts}</p>}
              </div>
            )}
          </div>

          {/* Save as Template */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="saveAsTemplate"
              checked={formData.saveAsTemplate}
              onChange={(e) => handleInputChange('saveAsTemplate', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="saveAsTemplate" className="ml-2 text-sm text-gray-700">
              Save as template for future campaigns
            </label>
          </div>
        </div>

        {errors.submit && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {errors.submit}
          </div>
        )}
      </div>

      {/* Step Actions */}
      <div className="mt-8 pt-6 border-t">
        <div className="flex justify-between">
          <div>
            {!isFirst && (
              <button
                onClick={onBack}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                ← Back
              </button>
            )}
          </div>
          <div>
            <button
              onClick={handleNext}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Saving...' : 'Next: Add Contacts →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step1_Details;