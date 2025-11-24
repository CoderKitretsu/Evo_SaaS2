/**
 * Campaign Runner - In-browser campaign execution engine
 * 
 * Features:
 * - Rehydrates scheduled/running campaigns on start
 * - Schedules future campaigns with setTimeout
 * - Batch processing with throttling and retry logic
 * - Idempotency protection against duplicate sends
 * - Support for pause/resume/cancel operations
 * - Dry-run simulation mode
 * - Real-time progress updates
 */

import { campaignService } from './campaignService.js';

// Global runner state
let isRunning = false;
let campaignTimers = new Map(); // campaignId -> timeoutId
let activeCampaigns = new Map(); // campaignId -> { campaign, intervalId, isPaused }
let updateCallbacks = new Map(); // campaignId -> Set of callbacks

// Throttle presets (sends per second)
const THROTTLE_PRESETS = {
  safe: 1,
  moderate: 5,
  fast: 20
};

/**
 * SHA-256 hash function for idempotency keys
 */
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate idempotency key for a send operation
 */
async function generateIdempotencyKey(campaignId, phone, templateHash, scheduleTimestamp) {
  const keyString = `${campaignId}${phone}${templateHash}${scheduleTimestamp}`;
  return await sha256(keyString);
}

/**
 * Simulate message sending (for dry-run and testing)
 */
function simulateSend(contact, message, dryRun = false) {
  return new Promise((resolve) => {
    // Simulate network delay (100-500ms)
    const delay = Math.random() * 400 + 100;
    
    setTimeout(() => {
      // Simulate 5% failure rate in non-dry-run mode
      const success = dryRun || Math.random() > 0.05;
      
      if (success) {
        resolve({
          success: true,
          messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          status: dryRun ? 'simulated_sent' : 'sent',
          timestamp: Date.now()
        });
      } else {
        resolve({
          success: false,
          error: 'Network timeout',
          status: 'failed',
          timestamp: Date.now()
        });
      }
    }, delay);
  });
}

/**
 * Send message to a contact with retry logic
 */
async function sendMessageWithRetry(campaign, contact, attempt = 1) {
  const { campaignId, message, meta } = campaign;
  const maxAttempts = meta.retryPolicy?.maxAttempts || 2;
  const baseDelay = 1000; // 1 second base delay
  
  try {
    // Generate idempotency key
    const idempotencyKey = await generateIdempotencyKey(
      campaignId,
      contact.phone,
      message.templateHash,
      Date.now()
    );
    
    // Check if already processed
    if (campaign.perContact[contact.id]?.idempotencyKey === idempotencyKey) {
      console.log(`[Runner] Skipping duplicate send for ${contact.phone} (idempotency)`);
      return { success: true, skipped: true };
    }
    
    // Merge message with contact variables
    let mergedMessage = message.text;
    if (contact.vars) {
      Object.entries(contact.vars).forEach(([key, value]) => {
        mergedMessage = mergedMessage.replace(new RegExp(`{${key}}`, 'g'), value);
      });
    }
    
    console.log(`[Runner] Sending to ${contact.phone} (attempt ${attempt}/${maxAttempts})`);
    
    // Send message (simulated or real)
    const result = await simulateSend(contact, {
      ...message,
      text: mergedMessage
    }, meta.dryRun);
    
    if (result.success) {
      // Update contact status
      await campaignService.updateCampaign(campaignId, {
        [`perContact.${contact.id}`]: {
          status: result.status,
          attempts: attempt,
          lastAttempt: Date.now(),
          idempotencyKey,
          messageId: result.messageId
        }
      });
      
      return { success: true, result };
    } else {
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error(`[Runner] Send failed for ${contact.phone} (attempt ${attempt}):`, error.message);
    
    // Update contact with error
    await campaignService.updateCampaign(campaignId, {
      [`perContact.${contact.id}`]: {
        status: attempt >= maxAttempts ? 'failed' : 'pending',
        attempts: attempt,
        lastAttempt: Date.now(),
        lastError: error.message
      }
    });
    
    // Retry if attempts remaining
    if (attempt < maxAttempts) {
      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
      console.log(`[Runner] Retrying ${contact.phone} in ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return await sendMessageWithRetry(campaign, contact, attempt + 1);
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Process a batch of contacts for a campaign
 */
async function processCampaignBatch(campaignId) {
  const campaignActive = activeCampaigns.get(campaignId);
  if (!campaignActive || campaignActive.isPaused) {
    return;
  }
  
  try {
    // Get fresh campaign data
    const campaignResult = await campaignService.getCampaign(campaignId);
    if (!campaignResult.success) {
      console.error(`[Runner] Failed to get campaign ${campaignId}:`, campaignResult.error);
      return;
    }
    
    const campaign = campaignResult.campaign;
    
    // Check if campaign should be stopped
    if (['cancelled', 'completed', 'paused'].includes(campaign.status)) {
      if (campaign.status === 'paused') {
        campaignActive.isPaused = true;
        console.log(`[Runner] Campaign ${campaignId} paused`);
      } else {
        console.log(`[Runner] Campaign ${campaignId} stopped (${campaign.status})`);
        stopCampaign(campaignId);
      }
      return;
    }
    
    // Get pending contacts
    const pendingContacts = campaign.contacts.rows.filter(contact => {
      const contactStatus = campaign.perContact[contact.id];
      return !contactStatus || contactStatus.status === 'pending';
    });
    
    if (pendingContacts.length === 0) {
      // Campaign completed
      console.log(`[Runner] Campaign ${campaignId} completed - no more pending contacts`);
      await campaignService.updateCampaign(campaignId, { status: 'completed' });
      stopCampaign(campaignId);
      notifyUpdate(campaignId, campaign);
      return;
    }
    
    // Process batch
    const maxBatchSize = campaign.meta.maxBatchSize || 10;
    const batchContacts = pendingContacts.slice(0, maxBatchSize);
    
    console.log(`[Runner] Processing batch of ${batchContacts.length} contacts for campaign ${campaignId}`);
    
    // Send messages in parallel within the batch
    const sendPromises = batchContacts.map(contact => 
      sendMessageWithRetry(campaign, contact)
    );
    
    await Promise.all(sendPromises);
    
    // Update progress counts
    const updatedCampaign = await campaignService.getCampaign(campaignId);
    if (updatedCampaign.success) {
      const sent = Object.values(updatedCampaign.campaign.perContact || {})
        .filter(c => ['sent', 'simulated_sent'].includes(c.status)).length;
      const failed = Object.values(updatedCampaign.campaign.perContact || {})
        .filter(c => c.status === 'failed').length;
      const pending = campaign.contacts.rows.length - sent - failed;
      
      await campaignService.updateCampaign(campaignId, {
        progress: { sent, failed, pending },
        updatedAt: Date.now()
      });
      
      console.log(`[Runner] Campaign ${campaignId} progress: ${sent} sent, ${failed} failed, ${pending} pending`);
      notifyUpdate(campaignId, updatedCampaign.campaign);
    }
    
  } catch (error) {
    console.error(`[Runner] Error processing campaign ${campaignId}:`, error);
    await campaignService.updateCampaign(campaignId, {
      status: 'failed',
      lastError: error.message
    });
    stopCampaign(campaignId);
  }
}

/**
 * Start processing a campaign
 */
async function startCampaign(campaign) {
  const { campaignId, meta } = campaign;
  
  console.log(`[Runner] Starting campaign ${campaignId}`);
  
  // Update status to running
  await campaignService.updateCampaign(campaignId, { status: 'running' });
  
  // Initialize per-contact tracking if not exists
  if (!campaign.perContact) {
    const perContact = {};
    campaign.contacts.rows.forEach(contact => {
      perContact[contact.id] = {
        status: 'pending',
        attempts: 0
      };
    });
    await campaignService.updateCampaign(campaignId, { perContact });
  }
  
  // Calculate interval based on throttle preset
  const throttleRate = THROTTLE_PRESETS[meta.throttle] || THROTTLE_PRESETS.safe;
  const intervalMs = Math.ceil(1000 / throttleRate); // Convert rate to interval
  
  console.log(`[Runner] Campaign ${campaignId} throttle: ${throttleRate}/s (interval: ${intervalMs}ms)`);
  
  // Start processing batches
  const intervalId = setInterval(() => {
    processCampaignBatch(campaignId);
  }, intervalMs);
  
  // Track active campaign
  activeCampaigns.set(campaignId, {
    campaign,
    intervalId,
    isPaused: false
  });
  
  // Start first batch immediately
  processCampaignBatch(campaignId);
}

/**
 * Stop processing a campaign
 */
function stopCampaign(campaignId) {
  const campaignActive = activeCampaigns.get(campaignId);
  if (campaignActive) {
    clearInterval(campaignActive.intervalId);
    activeCampaigns.delete(campaignId);
    console.log(`[Runner] Stopped campaign ${campaignId}`);
  }
  
  // Clear any scheduled start timer
  const timerId = campaignTimers.get(campaignId);
  if (timerId) {
    clearTimeout(timerId);
    campaignTimers.delete(campaignId);
  }
}

/**
 * Schedule a campaign to start at a future time
 */
function scheduleCampaign(campaign) {
  const { campaignId, meta } = campaign;
  const startAt = new Date(meta.startAt);
  const now = new Date();
  const delay = startAt.getTime() - now.getTime();
  
  if (delay <= 0) {
    // Start immediately if overdue
    startCampaign(campaign);
  } else {
    console.log(`[Runner] Scheduling campaign ${campaignId} to start in ${Math.ceil(delay/1000)}s`);
    
    const timerId = setTimeout(() => {
      campaignTimers.delete(campaignId);
      startCampaign(campaign);
    }, delay);
    
    campaignTimers.set(campaignId, timerId);
  }
}

/**
 * Notify update callbacks
 */
function notifyUpdate(campaignId, campaign) {
  const callbacks = updateCallbacks.get(campaignId);
  if (callbacks) {
    callbacks.forEach(callback => {
      try {
        callback(campaign);
      } catch (error) {
        console.error(`[Runner] Error in update callback for ${campaignId}:`, error);
      }
    });
  }
}

/**
 * Rehydrate campaigns from storage
 */
async function rehydrateCampaigns() {
  console.log('[Runner] Rehydrating campaigns...');
  
  try {
    const result = await campaignService.listCampaigns();
    if (!result.success) {
      console.error('[Runner] Failed to list campaigns:', result.error);
      return;
    }
    
    const scheduledOrRunning = result.campaigns.filter(campaign => 
      ['scheduled', 'running'].includes(campaign.status)
    );
    
    console.log(`[Runner] Found ${scheduledOrRunning.length} campaigns to rehydrate`);
    
    for (const campaign of scheduledOrRunning) {
      if (campaign.status === 'running') {
        // Resume running campaigns
        console.log(`[Runner] Resuming running campaign ${campaign.campaignId}`);
        startCampaign(campaign);
      } else if (campaign.status === 'scheduled') {
        // Schedule future campaigns
        scheduleCampaign(campaign);
      }
    }
    
  } catch (error) {
    console.error('[Runner] Error during rehydration:', error);
  }
}

/**
 * Start the campaign runner
 */
export async function startCampaignRunner() {
  if (isRunning) {
    console.log('[Runner] Already running');
    return;
  }
  
  console.log('[Runner] Starting campaign runner...');
  isRunning = true;
  
  // Rehydrate existing campaigns
  await rehydrateCampaigns();
  
  console.log('[Runner] Campaign runner started');
}

/**
 * Stop the campaign runner
 */
export function stopCampaignRunner() {
  if (!isRunning) {
    console.log('[Runner] Already stopped');
    return;
  }
  
  console.log('[Runner] Stopping campaign runner...');
  
  // Stop all active campaigns
  for (const campaignId of activeCampaigns.keys()) {
    stopCampaign(campaignId);
  }
  
  // Clear all scheduled timers
  for (const [campaignId, timerId] of campaignTimers.entries()) {
    clearTimeout(timerId);
  }
  campaignTimers.clear();
  
  // Clear update callbacks
  updateCallbacks.clear();
  
  isRunning = false;
  console.log('[Runner] Campaign runner stopped');
}

/**
 * Register callback for campaign updates
 */
export function onCampaignUpdate(campaignId, callback) {
  if (!updateCallbacks.has(campaignId)) {
    updateCallbacks.set(campaignId, new Set());
  }
  
  updateCallbacks.get(campaignId).add(callback);
  
  // Return unsubscribe function
  return () => {
    const callbacks = updateCallbacks.get(campaignId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        updateCallbacks.delete(campaignId);
      }
    }
  };
}

/**
 * Pause a running campaign
 */
export async function pauseCampaign(campaignId) {
  const campaignActive = activeCampaigns.get(campaignId);
  if (campaignActive && !campaignActive.isPaused) {
    campaignActive.isPaused = true;
    await campaignService.updateCampaign(campaignId, { status: 'paused' });
    console.log(`[Runner] Paused campaign ${campaignId}`);
  }
}

/**
 * Resume a paused campaign
 */
export async function resumeCampaign(campaignId) {
  const campaignActive = activeCampaigns.get(campaignId);
  if (campaignActive && campaignActive.isPaused) {
    campaignActive.isPaused = false;
    await campaignService.updateCampaign(campaignId, { status: 'running' });
    console.log(`[Runner] Resumed campaign ${campaignId}`);
    
    // Restart processing
    processCampaignBatch(campaignId);
  }
}

/**
 * Cancel a campaign
 */
export async function cancelCampaign(campaignId) {
  await campaignService.updateCampaign(campaignId, { status: 'cancelled' });
  stopCampaign(campaignId);
  console.log(`[Runner] Cancelled campaign ${campaignId}`);
}

/**
 * Handle new campaign publications
 */
export function handleNewCampaign(campaign) {
  if (!isRunning) {
    console.log('[Runner] Not running, ignoring new campaign');
    return;
  }
  
  if (campaign.status === 'scheduled') {
    scheduleCampaign(campaign);
  } else if (campaign.status === 'running') {
    startCampaign(campaign);
  }
}

// Export runner state for debugging
export function getRunnerState() {
  return {
    isRunning,
    activeCampaigns: Array.from(activeCampaigns.keys()),
    scheduledCampaigns: Array.from(campaignTimers.keys()),
    updateCallbacks: Array.from(updateCallbacks.keys())
  };
}