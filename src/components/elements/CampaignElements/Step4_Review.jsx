import React, { useState, useEffect } from 'react';
import campaignService from './campaignService.js';

/**
 * Phone number normalization (E.164 format) - shared utility
 */
const normalizePhone = (phone) => {
  if (!phone) return null;
  
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 0) return null;
  
  let normalized = digits;
  
  if (digits.length >= 10) {
    if (digits.length === 10) {
      normalized = '1' + digits;
    }
    normalized = '+' + normalized;
  } else {
    return null;
  }
  
  return normalized;
};

/**
 * Merge placeholders with contact data
 */
const mergePlaceholders = (text, contact) => {
  if (!text || !contact) return text;
  
  let merged = text;
  
  // Handle direct contact properties
  if (contact.phone) {
    merged = merged.replace(/\{phone\}/gi, contact.phone || '[phone]');
  }
  
  // Handle vars object from Step 2 contacts structure
  if (contact.vars) {
    Object.keys(contact.vars).forEach(key => {
      const placeholder = `{${key}}`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      merged = merged.replace(regex, contact.vars[key] || `[${key}]`);
    });
  }
  
  // Handle direct properties as fallback
  Object.keys(contact).forEach(key => {
    if (key !== 'vars' && typeof contact[key] === 'string') {
      const placeholder = `{${key}}`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      merged = merged.replace(regex, contact[key] || `[${key}]`);
    }
  });
  
  return merged;
};

/**
 * Format timestamp to readable date/time
 */
const formatDateTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

/**
 * Calculate estimated duration based on contact count and throttle
 */
const calculateEstimatedDuration = (contactCount, throttle) => {
  const throttleRates = {
    safe: 1, // 1 message per second
    moderate: 5, // 5 messages per second
    fast: 20 // 20 messages per second
  };
  
  const rate = throttleRates[throttle] || 1;
  const totalSeconds = Math.ceil(contactCount / rate);
  
  if (totalSeconds < 60) {
    return `${totalSeconds} seconds`;
  } else if (totalSeconds < 3600) {
    const minutes = Math.ceil(totalSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    const hours = Math.ceil(totalSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
};

/**
 * Step 4: Review & Confirm
 * Display full summary: meta, contacts stats, message preview, schedule list
 * Show first 3 merged message previews
 * Actions: Save Draft, Create Campaign → publishDraftAsCampaign, Create & Start → publish + mark Scheduled, Launch Now → override timestamps to now
 * Add confirmation modal if contacts > 1000 with estimated duration
 * DO NOT start sends here → only persist; runner handles execution
 */
const Step4_Review = ({ draftId, draftData, onDataChange, onNext, onBack, isFirst, isLast, onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [previewContacts, setPreviewContacts] = useState([]);
  const [errors, setErrors] = useState({});
  const [userConfirmation, setUserConfirmation] = useState(false);

  // Load draft data and generate preview
  useEffect(() => {
    console.log('Step4_Review: Received draftData:', draftData);
    if (draftData && draftData.contacts && draftData.message) {
      generateMessagePreviews();
    }
  }, [draftData]);

  const generateMessagePreviews = () => {
    try {
      console.log('Generating previews with message:', draftData.message);
      if (!draftData.contacts?.rows || !draftData.message?.text) {
        console.log('Missing data - contacts rows:', !!draftData.contacts?.rows, 'message text:', !!draftData.message?.text);
        setPreviewContacts([]);
        return;
      }

      const validContacts = draftData.contacts.rows.filter(contact => contact.isValid);
      const sampleContacts = validContacts.slice(0, 3);
      
      const previews = sampleContacts.map(contact => ({
        ...contact,
        previewText: mergePlaceholders(draftData.message.text, contact)
      }));
      
      setPreviewContacts(previews);
    } catch (error) {
      console.error('Error generating message previews:', error);
      setPreviewContacts([]);
    }
  };

  const validateCampaign = () => {
    const newErrors = {};

    if (!draftData.meta?.name?.trim()) {
      newErrors.meta = 'Campaign name is required';
    }

    if (!draftData.meta?.instanceId) {
      newErrors.meta = 'WhatsApp instance is required';
    }

    if (!draftData.meta?.startAt) {
      newErrors.meta = 'Start date and time is required';
    }

    if (!draftData.contacts?.valid || draftData.contacts.valid === 0) {
      newErrors.contacts = 'At least one valid contact is required';
    }

    if (!draftData.message?.text?.trim()) {
      newErrors.message = 'Message text is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      const result = await campaignService.saveDraft(draftId, draftData);
      if (result.success) {
        alert('✅ Draft saved successfully!');
      } else {
        alert(`❌ Failed to save draft: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Error saving draft: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!validateCampaign()) {
      alert('Please fix the validation errors before creating campaign.');
      return;
    }

    // Check if contact count requires confirmation
    if (draftData.contacts.valid > 1000) {
      setPendingAction('create');
      setShowConfirmModal(true);
      return;
    }

    await executeCreateCampaign();
  };

  const handleCreateAndStart = async () => {
    if (!validateCampaign()) {
      alert('Please fix the validation errors before starting campaign.');
      return;
    }

    // Check if contact count requires confirmation
    if (draftData.contacts.valid > 1000) {
      setPendingAction('createAndStart');
      setShowConfirmModal(true);
      return;
    }

    await executeCreateAndStart();
  };

  const handleLaunchNow = async () => {
    if (!validateCampaign()) {
      alert('Please fix the validation errors before launching campaign.');
      return;
    }

    // Check if contact count requires confirmation
    if (draftData.contacts.valid > 1000) {
      setPendingAction('launchNow');
      setShowConfirmModal(true);
      return;
    }

    await executeLaunchNow();
  };

  const executeCreateCampaign = async () => {
    setLoading(true);
    try {
      const result = await campaignService.publishDraftAsCampaign(draftId);
      if (result.success) {
        alert(`✅ Campaign "${draftData.meta.name}" created successfully!\n\nCampaign ID: ${result.campaignId}\nStatus: Draft\n\nYou can start it later from the campaigns list.`);
        if (onComplete) {
          onComplete(result.campaignId);
        }
      } else {
        alert(`❌ Failed to create campaign: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Error creating campaign: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const executeCreateAndStart = async () => {
    setLoading(true);
    try {
      // First publish the campaign
      const publishResult = await campaignService.publishDraftAsCampaign(draftId);
      if (!publishResult.success) {
        alert(`❌ Failed to create campaign: ${publishResult.error}`);
        return;
      }

      // Then start the campaign
      const startResult = await campaignService.startCampaign(publishResult.campaignId);
      if (startResult.success) {
        alert(`✅ Campaign "${draftData.meta.name}" created and scheduled!\n\nCampaign ID: ${publishResult.campaignId}\nStatus: Scheduled\nStart Time: ${formatDateTime(draftData.meta.startAt)}\n\nThe campaign runner will pick it up automatically.`);
        if (onComplete) {
          onComplete(publishResult.campaignId);
        }
      } else {
        alert(`⚠️ Campaign created but failed to start: ${startResult.error}\n\nYou can start it manually from the campaigns list.`);
      }
    } catch (error) {
      alert(`❌ Error creating and starting campaign: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const executeLaunchNow = async () => {
    setLoading(true);
    try {
      // Update draft with current timestamp
      const now = Date.now();
      const updatedDraft = {
        ...draftData,
        meta: {
          ...draftData.meta,
          startAt: now,
          endAt: draftData.meta.endAt ? now + (draftData.meta.endAt - draftData.meta.startAt) : null
        }
      };

      // Save updated draft
      await campaignService.saveDraft(draftId, updatedDraft);

      // Publish as campaign
      const publishResult = await campaignService.publishDraftAsCampaign(draftId);
      if (!publishResult.success) {
        alert(`❌ Failed to create campaign: ${publishResult.error}`);
        return;
      }

      // Start immediately
      const startResult = await campaignService.startCampaign(publishResult.campaignId);
      if (startResult.success) {
        alert(`🚀 Campaign "${updatedDraft.meta.name}" launched now!\n\nCampaign ID: ${publishResult.campaignId}\nStatus: Scheduled\nStart Time: Immediately\n\nThe campaign is now running.`);
        if (onComplete) {
          onComplete(publishResult.campaignId);
        }
      } else {
        alert(`⚠️ Campaign created but failed to start: ${startResult.error}`);
      }
    } catch (error) {
      alert(`❌ Error launching campaign: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = () => {
    setShowConfirmModal(false);
    
    switch (pendingAction) {
      case 'create':
        executeCreateCampaign();
        break;
      case 'createAndStart':
        executeCreateAndStart();
        break;
      case 'launchNow':
        executeLaunchNow();
        break;
      default:
        break;
    }
    
    setPendingAction(null);
  };

  const handleCancelAction = () => {
    setShowConfirmModal(false);
    setPendingAction(null);
  };

  const getThrottleDescription = (throttle) => {
    const descriptions = {
      safe: '1 message/second (Safe)',
      moderate: '5 messages/second (Moderate)', 
      fast: '20 messages/second (Fast)'
    };
    return descriptions[throttle] || throttle;
  };

  // Don't render if no draft data
  if (!draftData) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Loading campaign data...</p>
        </div>
      </div>
    );
  };

  const estimatedDuration = calculateEstimatedDuration(
    draftData.contacts?.valid || 0, 
    draftData.meta?.throttle || 'safe'
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Review & Confirm Campaign</h2>
        <p className="text-gray-600">
          Review all campaign details before publishing. Once published, some settings cannot be changed.
        </p>
      </div>

      {/* Validation Errors */}
      {Object.keys(errors).length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-800 mb-2">Please fix the following issues:</h3>
          <ul className="text-sm text-red-700 space-y-1">
            {Object.values(errors).map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaign Details */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Campaign Details</h3>
          
          <div className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Campaign Name</dt>
              <dd className="text-sm text-gray-900">{draftData.meta?.name || 'Untitled Campaign'}</dd>
            </div>
            
            {draftData.meta?.description && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Description</dt>
                <dd className="text-sm text-gray-900">{draftData.meta.description}</dd>
              </div>
            )}
            
            <div>
              <dt className="text-sm font-medium text-gray-500">WhatsApp Instance</dt>
              <dd className="text-sm text-gray-900">{draftData.meta?.instanceId || 'Not selected'}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Schedule</dt>
              <dd className="text-sm text-gray-900">
                <div>Start: {formatDateTime(draftData.meta?.startAt) || 'Not set'}</div>
                {draftData.meta?.endAt && (
                  <div>End: {formatDateTime(draftData.meta.endAt)}</div>
                )}
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Timezone</dt>
              <dd className="text-sm text-gray-900">{draftData.meta?.timezone || 'Not set'}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Mode</dt>
              <dd className="text-sm text-gray-900">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  draftData.meta?.dryRun 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {draftData.meta?.dryRun ? '🧪 Dry Run' : '🚀 Live Mode'}
                </span>
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Sending Speed</dt>
              <dd className="text-sm text-gray-900">{getThrottleDescription(draftData.meta?.throttle)}</dd>
            </div>
          </div>
        </div>

        {/* Contact Statistics */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Summary</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{draftData.contacts?.total || 0}</div>
              <div className="text-sm text-blue-600">Total Contacts</div>
            </div>
            
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{draftData.contacts?.valid || 0}</div>
              <div className="text-sm text-green-600">Valid Contacts</div>
            </div>
            
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{draftData.contacts?.invalid || 0}</div>
              <div className="text-sm text-red-600">Invalid Contacts</div>
            </div>
            
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{draftData.contacts?.duplicates || 0}</div>
              <div className="text-sm text-yellow-600">Duplicates</div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium text-gray-700">Estimated Duration</div>
            <div className="text-lg font-semibold text-gray-900">{estimatedDuration}</div>
            <div className="text-xs text-gray-500">Based on {getThrottleDescription(draftData.meta?.throttle)}</div>
          </div>
        </div>

        {/* Message Preview */}
        <div className="lg:col-span-2 bg-white border rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Message Preview</h3>
          
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Template Message</div>
            <div className="p-3 bg-gray-50 rounded-md border">
              <div className="text-sm text-gray-900 whitespace-pre-wrap">
                {draftData.message?.text || 'No message content'}
              </div>
            </div>
          </div>

          {/* Merged Message Samples */}
          {previewContacts.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">
                Sample Messages (First 3 Contacts)
              </div>
              <div className="space-y-3">
                {previewContacts.map((contact, index) => (
                  <div key={contact.id || index} className="p-3 bg-blue-50 rounded-md border">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs font-medium text-blue-600">
                        To: {contact.vars?.name || 'Contact'} ({normalizePhone(contact.phone) || contact.phone})
                      </div>
                      <div className="text-xs text-blue-500">
                        {contact.previewText?.length || 0} chars
                      </div>
                    </div>
                    <div className="text-sm text-blue-900 whitespace-pre-wrap">
                      {contact.previewText || 'Preview not available'}
                    </div>
                    <div className="text-xs text-blue-500 mt-2">
                      Characters: {contact.previewText?.length || 0} | 
                      SMS Parts: {Math.ceil((contact.previewText?.length || 0) / 160) || 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {draftData.message?.attachments?.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Attachments</div>
              <div className="space-y-2">
                {draftData.message.attachments.map((attachment, index) => (
                  <div key={attachment.id || index} className="flex items-center p-2 bg-gray-50 rounded border">
                    <div className="text-sm text-gray-900">
                      📎 {attachment.name} ({attachment.type})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 border-t pt-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleSaveDraft}
            disabled={loading}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Saving...' : '💾 Save Draft'}
          </button>
          
          <div className="flex-1"></div>
          
          <button
            onClick={handleCreateCampaign}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Creating...' : '📋 Create Campaign'}
          </button>
          
          <button
            onClick={handleCreateAndStart}
            disabled={loading}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Creating...' : '⏰ Create & Schedule'}
          </button>
          
          <button
            onClick={handleLaunchNow}
            disabled={loading}
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Launching...' : '🚀 Launch Now'}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-8 pt-6 border-t">
        <div className="flex justify-between items-center">
          <div>
            {!isFirst && (
              <button
                type="button"
                onClick={onBack}
                disabled={loading}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 rounded disabled:opacity-50"
              >
                ← Back to Message Studio
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              ⚠️ Large Campaign Confirmation
            </h3>
            
            <div className="mb-6 space-y-3">
              <p className="text-sm text-gray-700">
                This campaign will send messages to <strong>{draftData.contacts?.valid || 0} contacts</strong>.
              </p>
              
              <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                <div className="text-sm font-medium text-yellow-800">Estimated Duration</div>
                <div className="text-lg font-semibold text-yellow-900">{estimatedDuration}</div>
                <div className="text-xs text-yellow-700">At {getThrottleDescription(draftData.meta?.throttle)}</div>
              </div>
              
              <p className="text-sm text-gray-700">
                Large campaigns consume significant resources and may take considerable time to complete. 
                Please confirm you want to proceed.
              </p>
              
              <label className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  checked={userConfirmation}
                  onChange={(e) => setUserConfirmation(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  required
                />
                <span className="text-sm text-gray-700">
                  I understand this is a large campaign and want to proceed with {pendingAction === 'launchNow' ? 'launching immediately' : pendingAction === 'createAndStart' ? 'creating and scheduling' : 'creating'} this campaign.
                </span>
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelAction}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={!userConfirmation}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pendingAction === 'launchNow' ? 'Launch Now' : pendingAction === 'createAndStart' ? 'Create & Schedule' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step4_Review;