/**
 * CampaignLocalStorageAdapter
 * 
 * Low-level persistence layer for campaign data using localStorage.
 * All data is stored under 'evosaa.campaigns.*' keys.
 * Provides atomic index management and error handling.
 * 
 * Future: Can be swapped with Postgres adapter via switchAdapter()
 */

class CampaignLocalStorageAdapter {
  constructor() {
    this.KEYS = {
      INDEX: 'evosaa.campaigns.index',
      DRAFT_PREFIX: 'evosaa.campaigns.draft.',
      CAMPAIGN_PREFIX: 'evosaa.campaigns.campaign.'
    };
  }

  /**
   * Get the campaign index (list of all campaign IDs)
   * @returns {Array<string>} Array of campaign IDs
   */
  _getIndex() {
    try {
      const indexData = localStorage.getItem(this.KEYS.INDEX);
      return indexData ? JSON.parse(indexData) : [];
    } catch (error) {
      console.error('Failed to parse campaign index:', error);
      return [];
    }
  }

  /**
   * Update the campaign index atomically
   * @param {Array<string>} newIndex - Updated array of campaign IDs
   */
  _setIndex(newIndex) {
    try {
      localStorage.setItem(this.KEYS.INDEX, JSON.stringify(newIndex));
    } catch (error) {
      console.error('Failed to save campaign index:', error);
      throw new Error('Failed to update campaign index');
    }
  }

  /**
   * Add a campaign ID to the index if it doesn't exist
   * @param {string} campaignId - Campaign ID to add
   */
  _addToIndex(campaignId) {
    const index = this._getIndex();
    if (!index.includes(campaignId)) {
      index.push(campaignId);
      this._setIndex(index);
    }
  }

  /**
   * Remove a campaign ID from the index
   * @param {string} campaignId - Campaign ID to remove
   */
  _removeFromIndex(campaignId) {
    const index = this._getIndex();
    const updatedIndex = index.filter(id => id !== campaignId);
    this._setIndex(updatedIndex);
  }

  /**
   * Save a draft to localStorage
   * @param {string} draftId - Unique draft identifier
   * @param {Object} draftData - Draft data object
   * @returns {Object} Result with success/error
   */
  saveDraft(draftId, draftData) {
    try {
      const key = this.KEYS.DRAFT_PREFIX + draftId;
      const serializedData = JSON.stringify({
        ...draftData,
        updatedAt: Date.now()
      });
      localStorage.setItem(key, serializedData);
      return { success: true };
    } catch (error) {
      console.error('Failed to save draft:', error);
      return { success: false, error: 'Failed to save draft to localStorage' };
    }
  }

  /**
   * Get a draft from localStorage
   * @param {string} draftId - Draft identifier
   * @returns {Object|null} Draft data or null if not found
   */
  getDraft(draftId) {
    try {
      const key = this.KEYS.DRAFT_PREFIX + draftId;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get draft:', error);
      return null;
    }
  }

  /**
   * Delete a draft from localStorage
   * @param {string} draftId - Draft identifier
   * @returns {Object} Result with success/error
   */
  deleteDraft(draftId) {
    try {
      const key = this.KEYS.DRAFT_PREFIX + draftId;
      localStorage.removeItem(key);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete draft:', error);
      return { success: false, error: 'Failed to delete draft' };
    }
  }

  /**
   * Save a campaign to localStorage and update index
   * @param {string} campaignId - Unique campaign identifier
   * @param {Object} campaignData - Campaign data object
   * @returns {Object} Result with success/error
   */
  saveCampaign(campaignId, campaignData) {
    try {
      const key = this.KEYS.CAMPAIGN_PREFIX + campaignId;
      const serializedData = JSON.stringify({
        ...campaignData,
        updatedAt: Date.now()
      });
      localStorage.setItem(key, serializedData);
      this._addToIndex(campaignId);
      return { success: true };
    } catch (error) {
      console.error('Failed to save campaign:', error);
      return { success: false, error: 'Failed to save campaign to localStorage' };
    }
  }

  /**
   * Get a campaign from localStorage
   * @param {string} campaignId - Campaign identifier
   * @returns {Object|null} Campaign data or null if not found
   */
  getCampaign(campaignId) {
    try {
      const key = this.KEYS.CAMPAIGN_PREFIX + campaignId;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get campaign:', error);
      return null;
    }
  }

  /**
   * List all drafts
   * @returns {Array<Object>} Array of draft objects with basic metadata
   */
  listDrafts() {
    try {
      const drafts = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.KEYS.DRAFT_PREFIX)) {
          const data = localStorage.getItem(key);
          if (data) {
            const draftData = JSON.parse(data);
            drafts.push({
              draftId: key.replace(this.KEYS.DRAFT_PREFIX, ''),
              name: draftData.meta?.name || 'Untitled Draft',
              updatedAt: draftData.updatedAt,
              createdAt: draftData.createdAt
            });
          }
        }
      }
      return drafts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (error) {
      console.error('Failed to list drafts:', error);
      return [];
    }
  }

  /**
   * List all campaigns using the index
   * @returns {Array<Object>} Array of campaign objects with basic metadata
   */
  listCampaigns() {
    try {
      const index = this._getIndex();
      const campaigns = [];
      
      for (const campaignId of index) {
        const campaignData = this.getCampaign(campaignId);
        if (campaignData) {
          campaigns.push({
            campaignId,
            name: campaignData.meta?.name || 'Untitled Campaign',
            status: campaignData.status || 'Draft',
            createdAt: campaignData.createdAt,
            updatedAt: campaignData.updatedAt,
            instanceId: campaignData.meta?.instanceId,
            startAt: campaignData.meta?.startAt,
            endAt: campaignData.meta?.endAt,
            progress: campaignData.progress || { sent: 0, failed: 0, pending: 0 }
          });
        } else {
          // Clean up orphaned index entries
          this._removeFromIndex(campaignId);
        }
      }
      
      return campaigns.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (error) {
      console.error('Failed to list campaigns:', error);
      return [];
    }
  }

  /**
   * Update a campaign with partial data
   * @param {string} campaignId - Campaign identifier
   * @param {Object} patch - Partial update object
   * @returns {Object} Result with success/error and updated data
   */
  updateCampaign(campaignId, patch) {
    try {
      const existing = this.getCampaign(campaignId);
      if (!existing) {
        return { success: false, error: 'Campaign not found' };
      }

      const updated = {
        ...existing,
        ...patch,
        updatedAt: Date.now()
      };

      const result = this.saveCampaign(campaignId, updated);
      if (result.success) {
        return { success: true, data: updated };
      } else {
        return result;
      }
    } catch (error) {
      console.error('Failed to update campaign:', error);
      return { success: false, error: 'Failed to update campaign' };
    }
  }

  /**
   * Delete a campaign from localStorage and update index
   * @param {string} campaignId - Campaign identifier
   * @returns {Object} Result with success/error
   */
  deleteCampaign(campaignId) {
    try {
      const key = this.KEYS.CAMPAIGN_PREFIX + campaignId;
      localStorage.removeItem(key);
      this._removeFromIndex(campaignId);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      return { success: false, error: 'Failed to delete campaign' };
    }
  }
}

// Global adapter instance
const campaignLocalStorageAdapter = new CampaignLocalStorageAdapter();

/**
 * Switch to a different adapter implementation
 * @param {Object} newAdapter - New adapter instance (e.g., PostgresAdapter)
 * TODO: Implement adapter switching for server-side persistence
 */
export function switchAdapter(newAdapter) {
  // TODO: Implement adapter switching logic
  // This will be used when migrating to Postgres or other persistence layers
  console.warn('switchAdapter not yet implemented - staying with localStorage');
  return campaignLocalStorageAdapter;
}

// Export the adapter instance and individual methods
export default campaignLocalStorageAdapter;

export const {
  saveDraft,
  getDraft,
  deleteDraft,
  saveCampaign,
  getCampaign,
  listDrafts,
  listCampaigns,
  updateCampaign,
  deleteCampaign
} = campaignLocalStorageAdapter;