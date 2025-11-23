import React, { useState, useEffect } from 'react';
import campaignService from './campaignService.js';

/**
 * Step 4: Review & Confirm
 * Features: Campaign summary, validation, publish options, confirmation modal for large campaigns
 */
const Step4_Review = ({ draftId, draftData, onDataChange, onNext, onBack, isFirst, isLast, onComplete }) => {
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [userConfirmation, setUserConfirmation] = useState(false);

  // Load complete draft data for review
  useEffect(() => {
    if (draftId) {
      loadDraftForReview();
    }
  }, [draftId]);

  const loadDraftForReview = () => {
    try {
      const draftData = campaignService.getDraft(draftId);
      setDraft(draftData);
      calculateEstimatedDuration(draftData);
    } catch (error) {
      setError('Failed to load campaign data for review');
      console.error('Load draft error:', error);
    }
  };

  const calculateEstimatedDuration = (draftData) => {
    if (!draftData || !draftData.contacts || !draftData.meta) return;

    const totalContacts = draftData.contacts.valid || 0;
    const throttleRates = { safe: 1, moderate: 5, fast: 20 }; // messages per second
    const rate = throttleRates[draftData.meta.throttle] || 1;
    
    const totalSeconds = Math.ceil(totalContacts / rate);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      setEstimatedDuration(`${hours}h ${minutes}m`);
    } else if (minutes > 0) {
      setEstimatedDuration(`${minutes} minutes`);
    } else {
      setEstimatedDuration('< 1 minute');
    }
  };

  const validateDraft = () => {
    const errors = [];

    if (!draft) {
      errors.push('Draft data not loaded');
      return errors;
    }

    // Validate metadata
    if (!draft.meta) {
      errors.push('Campaign details are missing');
    } else {
      if (!draft.meta.name?.trim()) errors.push('Campaign name is required');
      if (!draft.meta.instanceId) errors.push('WhatsApp instance is required');
      if (!draft.meta.startAt) errors.push('Start time is required');
      if (draft.meta.startAt < Date.now()) errors.push('Start time must be in the future');
    }

    // Validate contacts
    if (!draft.contacts || draft.contacts.valid === 0) {
      errors.push('At least one valid contact is required');
    }

    // Validate message
    if (!draft.message || !draft.message.text?.trim()) {
      errors.push('Message text is required');
    }

    // Validate schedules
    if (!draft.schedules || draft.schedules.length === 0) {
      errors.push('At least one schedule is required');
    } else {
      // Check schedules are within campaign window
      if (draft.meta.startAt && draft.meta.endAt) {
        const invalidSchedules = draft.schedules.filter(
          schedule => schedule.timestamp < draft.meta.startAt || schedule.timestamp > draft.meta.endAt
        );
        if (invalidSchedules.length > 0) {
          errors.push('Some schedules are outside the campaign time window');
        }
      }
    }

    return errors;
  };

  const handleActionClick = (action) => {
    const validationErrors = validateDraft();
    if (validationErrors.length > 0) {
      setError('Please fix the following issues: ' + validationErrors.join(', '));
      return;
    }

    // Show confirmation for large campaigns or immediate actions
    const needsConfirmation = draft.contacts.valid > 1000 || 
                             action === 'launch-now' || 
                             action === 'create-and-start';
    
    if (needsConfirmation) {
      setConfirmAction(action);
      setShowConfirmModal(true);
      setUserConfirmation(false);
    } else {
      executeAction(action);
    }
  };

  const executeAction = async (action) => {
    setLoading(true);
    setError(null);

    try {
      switch (action) {
        case 'save-draft':
          // Draft is already saved, just show success
          setError(null);
          break;

        case 'create-campaign':
          const createResult = campaignService.publishDraftAsCampaign(draftId);
          if (createResult.success) {
            if (onComplete) {
              onComplete({ type: 'created', campaignId: createResult.campaignId });
            }
          } else {
            setError(createResult.error);
          }
          break;

        case 'create-and-start':
          const publishResult = campaignService.publishDraftAsCampaign(draftId);
          if (publishResult.success) {
            const startResult = campaignService.startCampaign(publishResult.campaignId);
            if (startResult.success) {
              if (onComplete) {
                onComplete({ type: 'started', campaignId: publishResult.campaignId });
              }
            } else {
              setError('Campaign created but failed to start: ' + startResult.error);
            }
          } else {
            setError(publishResult.error);
          }
          break;

        case 'launch-now':
          // Update start time to now and launch
          const updateResult = campaignService.saveDraft(draftId, {
            meta: { ...draft.meta, startAt: Date.now() },
            schedules: draft.schedules.map(schedule => ({
              ...schedule,
              timestamp: Date.now() + (schedule.timestamp - draft.meta.startAt)
            }))
          });
          
          if (updateResult.success) {
            const publishNowResult = campaignService.publishDraftAsCampaign(draftId);
            if (publishNowResult.success) {
              const startNowResult = campaignService.startCampaign(publishNowResult.campaignId);
              if (startNowResult.success) {
                if (onComplete) {
                  onComplete({ type: 'launched', campaignId: publishNowResult.campaignId });
                }
              } else {
                setError('Failed to launch campaign: ' + startNowResult.error);
              }
            } else {
              setError(publishNowResult.error);
            }
          } else {
            setError('Failed to update campaign timing: ' + updateResult.error);
          }
          break;

        default:
          setError('Unknown action: ' + action);
      }
    } catch (error) {
      setError('Action failed: ' + error.message);
      console.error('Action execution error:', error);
    } finally {
      setLoading(false);
      setShowConfirmModal(false);
      setConfirmAction(null);
    }
  };

  const previewMessage = () => {
    if (!draft?.message?.text || !draft?.contacts?.rows?.length) return '';
    
    const firstContact = draft.contacts.rows[0];
    let preview = draft.message.text;
    
    if (firstContact.vars) {
      Object.entries(firstContact.vars).forEach(([key, value]) => {
        preview = preview.replace(new RegExp(`{${key}}`, 'g'), value || `{${key}}`);
      });
    }
    
    return preview;
  };

  const getActionLabel = (action) => {
    const labels = {
      'save-draft': 'Save Draft',
      'create-campaign': 'Create Campaign',
      'create-and-start': 'Create & Start',
      'launch-now': 'Launch Now'
    };
    return labels[action] || action;
  };

  const getActionDescription = (action) => {
    const descriptions = {
      'save-draft': 'Save current progress without publishing',
      'create-campaign': 'Create campaign record (ready to start manually)',
      'create-and-start': 'Create campaign and schedule for automatic start',
      'launch-now': 'Override timing and start sending immediately'
    };
    return descriptions[action] || '';
  };

  if (!draft) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading campaign data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Review & Confirm</h2>
        <p className="text-gray-600">Review your campaign details before publishing.</p>
      </div>

      {/* Campaign Summary */}
      <div className="space-y-6">
        {/* Basic Details */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Campaign Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <div className="mt-1 text-sm text-gray-900">{draft.meta?.name || 'Untitled Campaign'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <div className="mt-1 text-sm text-gray-900">{draft.meta?.description || 'No description'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">WhatsApp Instance</label>
              <div className="mt-1 text-sm text-gray-900">{draft.meta?.instanceId || 'Not selected'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mode</label>
              <div className="mt-1">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  draft.meta?.dryRun ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                }`}>
                  {draft.meta?.dryRun ? 'Dry Run (Test Mode)' : 'Live Mode'}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Time</label>
              <div className="mt-1 text-sm text-gray-900">
                {draft.meta?.startAt ? new Date(draft.meta.startAt).toLocaleString() : 'Not set'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Time</label>
              <div className="mt-1 text-sm text-gray-900">
                {draft.meta?.endAt ? new Date(draft.meta.endAt).toLocaleString() : 'No end time'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Sending Speed</label>
              <div className="mt-1 text-sm text-gray-900 capitalize">{draft.meta?.throttle || 'safe'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Estimated Duration</label>
              <div className="mt-1 text-sm text-gray-900">{estimatedDuration}</div>
            </div>
          </div>
        </div>

        {/* Contact Statistics */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{draft.contacts?.total || 0}</div>
              <div className="text-sm text-gray-600">Total Contacts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{draft.contacts?.valid || 0}</div>
              <div className="text-sm text-gray-600">Valid</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{draft.contacts?.invalid || 0}</div>
              <div className="text-sm text-gray-600">Invalid</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{draft.contacts?.duplicates || 0}</div>
              <div className="text-sm text-gray-600">Duplicates</div>
            </div>
          </div>
        </div>

        {/* Message Preview */}
        <div className="bg-green-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Message Preview</h3>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-900 whitespace-pre-wrap mb-3">
              {previewMessage() || 'No message text'}
            </div>
            {draft.message?.attachments?.length > 0 && (
              <div className="pt-3 border-t">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">📎 Attachments:</span>
                  {draft.message.attachments.map((att, index) => (
                    <span key={index} className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {att.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Schedule Summary */}
        <div className="bg-purple-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Send Schedule</h3>
          {draft.schedules?.length > 0 ? (
            <div className="space-y-2">
              {draft.schedules
                .sort((a, b) => a.timestamp - b.timestamp)
                .map((schedule, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white rounded border">
                    <div>
                      <div className="font-medium">{schedule.description || `Schedule ${index + 1}`}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(schedule.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 capitalize">{schedule.type}</div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No schedules configured</div>
          )}
        </div>
      </div>

      {/* Validation Errors */}
      {error && (
        <div className="mt-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-8 pt-6 border-t">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            ← Back to Message Studio
          </button>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleActionClick('save-draft')}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
            >
              💾 Save Draft
            </button>
            <button
              onClick={() => handleActionClick('create-campaign')}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              📝 Create Campaign
            </button>
            <button
              onClick={() => handleActionClick('create-and-start')}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              🚀 Create & Start
            </button>
            <button
              onClick={() => handleActionClick('launch-now')}
              disabled={loading}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
            >
              ⚡ Launch Now
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirm {getActionLabel(confirmAction)}
            </h3>
            
            <div className="space-y-3 mb-6">
              <p className="text-sm text-gray-600">
                {getActionDescription(confirmAction)}
              </p>
              
              {draft.contacts?.valid > 1000 && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded text-sm">
                  ⚠️ Large campaign: {draft.contacts.valid} contacts
                </div>
              )}

              {confirmAction === 'launch-now' && (
                <div className="bg-orange-100 border border-orange-400 text-orange-700 px-3 py-2 rounded text-sm">
                  ⚡ This will start sending immediately
                </div>
              )}

              <div className="bg-gray-100 p-3 rounded text-sm">
                <div><strong>Estimated duration:</strong> {estimatedDuration}</div>
                <div><strong>Mode:</strong> {draft.meta?.dryRun ? 'Dry Run' : 'Live Mode'}</div>
                <div><strong>Valid contacts:</strong> {draft.contacts?.valid || 0}</div>
              </div>

              {(draft.contacts?.valid > 1000 || confirmAction === 'launch-now') && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="user-confirmation"
                    checked={userConfirmation}
                    onChange={(e) => setUserConfirmation(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="user-confirmation" className="ml-2 text-sm text-gray-700">
                    I understand and want to proceed with this action
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => executeAction(confirmAction)}
                disabled={loading || ((draft.contacts?.valid > 1000 || confirmAction === 'launch-now') && !userConfirmation)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step4_Review;