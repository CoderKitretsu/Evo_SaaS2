/**
 * Campaign Service
 * 
 * Business logic layer for campaign management.
 * Acts as a facade between UI components and the persistence adapter.
 * Handles validation, data transformation, and business rules.
 */

import campaignAdapter from './CampaignLocalStorageAdapter.js';

/**
 * Generate a UUID v4
 * @returns {string} UUID string
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validate campaign name uniqueness
 * @param {string} name - Campaign name to validate
 * @param {string} excludeId - Campaign ID to exclude from check (for updates)
 * @returns {boolean} True if name is unique
 */
function validateNameUniqueness(name, excludeId = null) {
  const campaigns = campaignAdapter.listCampaigns();
  return !campaigns.some(campaign => 
    campaign.name.toLowerCase() === name.toLowerCase() && 
    campaign.campaignId !== excludeId
  );
}

/**
 * Validate draft has at least one valid contact
 * @param {Object} draftData - Draft data object
 * @returns {boolean} True if draft has valid contacts
 */
function validateHasValidContacts(draftData) {
  return draftData.contacts && 
         draftData.contacts.valid > 0 && 
         draftData.contacts.rows && 
         draftData.contacts.rows.length > 0;
}

/**
 * Create a new campaign draft
 * @param {Object} initialMeta - Initial metadata for the draft
 * @param {string} initialMeta.name - Campaign name
 * @param {string} initialMeta.description - Campaign description
 * @param {string} initialMeta.instanceId - WhatsApp instance ID
 * @returns {Object} Result with draftId or error
 */
export function createDraft(initialMeta = {}) {
  try {
    const draftId = generateUUID();
    const now = Date.now();
    
    const draftData = {
      draftId,
      meta: {
        name: initialMeta.name || '',
        description: initialMeta.description || '',
        instanceId: initialMeta.instanceId || '',
        startAt: initialMeta.startAt || (now + 300000), // Default: 5 minutes from now
        endAt: initialMeta.endAt || null,
        timezone: initialMeta.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        dryRun: initialMeta.dryRun !== undefined ? initialMeta.dryRun : true,
        throttle: initialMeta.throttle || 'safe',
        maxBatchSize: initialMeta.maxBatchSize || 50,
        retryPolicy: initialMeta.retryPolicy || { enabled: true, maxAttempts: 2 },
        saveAsTemplate: initialMeta.saveAsTemplate || false
      },
      contacts: {
        total: 0,
        valid: 0,
        invalid: 0,
        duplicates: 0,
        rows: []
      },
      message: {
        text: '',
        templateHash: '',
        attachments: []
      },
      schedules: [],
      createdAt: now,
      updatedAt: now
    };

    const result = campaignAdapter.saveDraft(draftId, draftData);
    
    if (result.success) {
      return { success: true, draftId, data: draftData };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Failed to create draft:', error);
    return { success: false, error: 'Failed to create campaign draft' };
  }
}

/**
 * Save draft data
 * @param {string} draftId - Draft identifier
 * @param {Object} draftData - Complete or partial draft data
 * @returns {Object} Result with success/error
 */
export function saveDraft(draftId, draftData) {
  try {
    if (!draftId) {
      return { success: false, error: 'Draft ID is required' };
    }

    // Get existing draft to merge with new data
    const existing = campaignAdapter.getDraft(draftId);
    if (!existing) {
      return { success: false, error: 'Draft not found' };
    }

    const updatedData = {
      ...existing,
      ...draftData,
      draftId, // Ensure ID is preserved
      updatedAt: Date.now()
    };

    const result = campaignAdapter.saveDraft(draftId, updatedData);
    
    if (result.success) {
      return { success: true, data: updatedData };
    } else {
      return result;
    }
  } catch (error) {
    console.error('Failed to save draft:', error);
    return { success: false, error: 'Failed to save draft' };
  }
}

/**
 * Get draft by ID
 * @param {string} draftId - Draft identifier
 * @returns {Object|null} Draft data or null if not found
 */
export function getDraft(draftId) {
  try {
    return campaignAdapter.getDraft(draftId);
  } catch (error) {
    console.error('Failed to get draft:', error);
    return null;
  }
}

/**
 * List all drafts
 * @returns {Object} Success object with drafts array
 */
export function listDrafts() {
  try {
    const draftList = campaignAdapter.listDrafts();
    const fullDrafts = draftList.map(draftMeta => {
      try {
        const fullDraft = campaignAdapter.getDraft(draftMeta.draftId);
        return fullDraft ? {
          ...fullDraft,
          draftId: draftMeta.draftId,
          name: fullDraft.meta?.name || draftMeta.name || 'Untitled Draft'
        } : null;
      } catch (error) {
        console.error(`Failed to load draft ${draftMeta.draftId}:`, error);
        return null;
      }
    }).filter(Boolean);
    
    return {
      success: true,
      drafts: fullDrafts
    };
  } catch (error) {
    console.error('Failed to list drafts:', error);
    return {
      success: false,
      error: error.message,
      drafts: []
    };
  }
}

/**
 * Publish a draft as a campaign
 * Validates name uniqueness and contact requirements
 * @param {string} draftId - Draft identifier
 * @returns {Object} Result with campaignId or validation errors
 */
export function publishDraftAsCampaign(draftId) {
  try {
    // Get the draft
    const draft = campaignAdapter.getDraft(draftId);
    if (!draft) {
      return { success: false, error: 'Draft not found' };
    }

    // Validate campaign name uniqueness
    if (!draft.meta.name || draft.meta.name.trim() === '') {
      return { success: false, error: 'Campaign name is required' };
    }

    if (!validateNameUniqueness(draft.meta.name)) {
      return { success: false, error: 'Campaign name already exists' };
    }

    // Validate has valid contacts
    if (!validateHasValidContacts(draft)) {
      return { success: false, error: 'Campaign must have at least one valid contact' };
    }

    // Validate required fields
    if (!draft.meta.instanceId) {
      return { success: false, error: 'WhatsApp instance is required' };
    }

    if (!draft.meta.startAt) {
      return { success: false, error: 'Start time is required' };
    }

    // Generate campaign ID and create campaign data
    const campaignId = generateUUID();
    const now = Date.now();

    // Initialize per-contact tracking
    const perContact = {};
    draft.contacts.rows.forEach(contact => {
      if (contact.phone && contact.id) {
        perContact[contact.id] = {
          status: 'pending',
          attempts: 0,
          idempotencyKey: '', // Will be generated by runner
          lastAttempt: null,
          lastError: null
        };
      }
    });

    const campaignData = {
      campaignId,
      draftRef: draftId,
      meta: { ...draft.meta },
      contacts: { ...draft.contacts },
      message: { ...draft.message },
      schedules: [...(draft.schedules || [])],
      status: 'Draft', // Initial status
      progress: {
        sent: 0,
        failed: 0,
        pending: draft.contacts.valid
      },
      perContact,
      logs: [],
      createdAt: now,
      updatedAt: now
    };

    // Save the campaign
    const result = campaignAdapter.saveCampaign(campaignId, campaignData);
    
    if (result.success) {
      return { success: true, campaignId, data: campaignData };
    } else {
      return result;
    }
  } catch (error) {
    console.error('Failed to publish campaign:', error);
    return { success: false, error: 'Failed to publish campaign' };
  }
}

/**
 * List all campaigns
 * @returns {Array<Object>} Array of campaign metadata
 */
export function listCampaigns() {
  try {
    const campaigns = campaignAdapter.listCampaigns();
    return {
      success: true,
      campaigns: campaigns || []
    };
  } catch (error) {
    console.error('Failed to list campaigns:', error);
    return {
      success: false,
      error: error.message,
      campaigns: []
    };
  }
}

/**
 * Get campaign by ID
 * @param {string} campaignId - Campaign identifier
 * @returns {Object|null} Campaign data or null if not found
 */
export function getCampaign(campaignId) {
  try {
    return campaignAdapter.getCampaign(campaignId);
  } catch (error) {
    console.error('Failed to get campaign:', error);
    return null;
  }
}

/**
 * Update campaign with partial data
 * @param {string} campaignId - Campaign identifier
 * @param {Object} patch - Partial update data
 * @returns {Object} Result with success/error and updated data
 */
export function updateCampaign(campaignId, patch) {
  try {
    const result = campaignAdapter.updateCampaign(campaignId, patch);
    return result;
  } catch (error) {
    console.error('Failed to update campaign:', error);
    return { success: false, error: 'Failed to update campaign' };
  }
}

/**
 * Start a campaign (change status to Scheduled)
 * @param {string} campaignId - Campaign identifier
 * @returns {Object} Result with success/error
 */
export function startCampaign(campaignId) {
  try {
    const campaign = campaignAdapter.getCampaign(campaignId);
    if (!campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    if (campaign.status === 'Running' || campaign.status === 'Scheduled') {
      return { success: false, error: 'Campaign is already started' };
    }

    if (campaign.status === 'Completed' || campaign.status === 'Cancelled') {
      return { success: false, error: 'Cannot start completed or cancelled campaign' };
    }

    const result = campaignAdapter.updateCampaign(campaignId, {
      status: 'Scheduled',
      logs: [
        ...(campaign.logs || []),
        {
          timestamp: Date.now(),
          level: 'info',
          message: 'Campaign started by user'
        }
      ]
    });

    return result;
  } catch (error) {
    console.error('Failed to start campaign:', error);
    return { success: false, error: 'Failed to start campaign' };
  }
}

/**
 * Pause a running campaign
 * @param {string} campaignId - Campaign identifier
 * @returns {Object} Result with success/error
 */
export function pauseCampaign(campaignId) {
  try {
    const campaign = campaignAdapter.getCampaign(campaignId);
    if (!campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    if (campaign.status !== 'Running' && campaign.status !== 'Scheduled') {
      return { success: false, error: 'Only running or scheduled campaigns can be paused' };
    }

    const result = campaignAdapter.updateCampaign(campaignId, {
      status: 'Paused',
      logs: [
        ...(campaign.logs || []),
        {
          timestamp: Date.now(),
          level: 'info',
          message: 'Campaign paused by user'
        }
      ]
    });

    return result;
  } catch (error) {
    console.error('Failed to pause campaign:', error);
    return { success: false, error: 'Failed to pause campaign' };
  }
}

/**
 * Resume a paused campaign
 * @param {string} campaignId - Campaign identifier
 * @returns {Object} Result with success/error
 */
export function resumeCampaign(campaignId) {
  try {
    const campaign = campaignAdapter.getCampaign(campaignId);
    if (!campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    if (campaign.status !== 'Paused') {
      return { success: false, error: 'Only paused campaigns can be resumed' };
    }

    const result = campaignAdapter.updateCampaign(campaignId, {
      status: 'Running',
      logs: [
        ...(campaign.logs || []),
        {
          timestamp: Date.now(),
          level: 'info',
          message: 'Campaign resumed by user'
        }
      ]
    });

    return result;
  } catch (error) {
    console.error('Failed to resume campaign:', error);
    return { success: false, error: 'Failed to resume campaign' };
  }
}

/**
 * Cancel a campaign
 * @param {string} campaignId - Campaign identifier
 * @returns {Object} Result with success/error
 */
export function cancelCampaign(campaignId) {
  try {
    const campaign = campaignAdapter.getCampaign(campaignId);
    if (!campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    if (campaign.status === 'Completed' || campaign.status === 'Cancelled') {
      return { success: false, error: 'Campaign is already completed or cancelled' };
    }

    const result = campaignAdapter.updateCampaign(campaignId, {
      status: 'Cancelled',
      logs: [
        ...(campaign.logs || []),
        {
          timestamp: Date.now(),
          level: 'warning',
          message: 'Campaign cancelled by user'
        }
      ]
    });

    return result;
  } catch (error) {
    console.error('Failed to cancel campaign:', error);
    return { success: false, error: 'Failed to cancel campaign' };
  }
}

/**
 * Duplicate a campaign (create new draft from existing campaign)
 * @param {string} campaignId - Campaign identifier to duplicate
 * @returns {Object} Result with new draftId or error
 */
export function duplicateCampaign(campaignId) {
  try {
    const campaign = campaignAdapter.getCampaign(campaignId);
    if (!campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    // Generate new name with "Copy of" prefix
    const originalName = campaign.meta.name;
    let newName = `Copy of ${originalName}`;
    let counter = 1;

    // Ensure unique name
    while (!validateNameUniqueness(newName)) {
      counter++;
      newName = `Copy of ${originalName} (${counter})`;
    }

    // Create new draft with campaign data
    const newMeta = {
      ...campaign.meta,
      name: newName,
      startAt: Date.now() + 300000, // 5 minutes from now
      endAt: campaign.meta.endAt ? (Date.now() + (campaign.meta.endAt - campaign.meta.startAt)) : null
    };

    const result = createDraft(newMeta);
    
    if (result.success) {
      // Update the draft with full campaign data
      const updateResult = saveDraft(result.draftId, {
        contacts: { ...campaign.contacts },
        message: { ...campaign.message },
        schedules: [...(campaign.schedules || [])]
      });

      if (updateResult.success) {
        return { success: true, draftId: result.draftId, name: newName };
      } else {
        // Cleanup failed draft
        campaignAdapter.deleteDraft(result.draftId);
        return updateResult;
      }
    }

    return result;
  } catch (error) {
    console.error('Failed to duplicate campaign:', error);
    return { success: false, error: 'Failed to duplicate campaign' };
  }
}

// Export all functions as a service object
export const campaignService = {
  createDraft,
  saveDraft,
  getDraft,
  listDrafts,
  publishDraftAsCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  duplicateCampaign
};

// Export as default for convenience
export default campaignService;