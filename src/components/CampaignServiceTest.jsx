import React, { useState } from 'react';
import campaignService from './elements/CampaignElements/campaignService.js';

const CampaignServiceTest = () => {
  const [results, setResults] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [testDraftId, setTestDraftId] = useState(null);
  const [testCampaignId, setTestCampaignId] = useState(null);

  const log = (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setResults(prev => [...prev, { timestamp, message, data, status: 'info' }]);
    console.log(`[${timestamp}] ${message}`, data);
  };

  const logError = (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setResults(prev => [...prev, { timestamp, message, data, status: 'error' }]);
    console.error(`[${timestamp}] ${message}`, data);
  };

  const logSuccess = (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setResults(prev => [...prev, { timestamp, message, data, status: 'success' }]);
    console.log(`[${timestamp}] ✅ ${message}`, data);
  };

  const runServiceTests = async () => {
    setResults([]);
    log('🧪 Starting Campaign Service Tests');

    try {
      // Test 1: Create Draft
      log('📝 Test 1: Create Draft');
      const draftResult = campaignService.createDraft({
        name: 'Test Campaign Service Draft',
        description: 'Testing the service layer',
        instanceId: 'test-instance-123',
        dryRun: true
      });

      if (draftResult.success) {
        logSuccess('Draft created successfully', { draftId: draftResult.draftId });
        setTestDraftId(draftResult.draftId);
      } else {
        logError('Draft creation failed', draftResult.error);
        return;
      }

      // Test 2: Add Contacts to Draft
      log('👥 Test 2: Add Contacts to Draft');
      const contactsData = {
        contacts: {
          total: 5,
          valid: 5,
          invalid: 0,
          duplicates: 0,
          rows: [
            { id: 'c1', phone: '+911234567890', vars: { name: 'Alice Johnson', city: 'Mumbai' } },
            { id: 'c2', phone: '+911234567891', vars: { name: 'Bob Smith', city: 'Delhi' } },
            { id: 'c3', phone: '+911234567892', vars: { name: 'Charlie Brown', city: 'Bangalore' } },
            { id: 'c4', phone: '+911234567893', vars: { name: 'Diana Prince', city: 'Chennai' } },
            { id: 'c5', phone: '+911234567894', vars: { name: 'Eve Wilson', city: 'Kolkata' } }
          ]
        }
      };

      const contactsSaveResult = campaignService.saveDraft(draftResult.draftId, contactsData);
      if (contactsSaveResult.success) {
        logSuccess('Contacts added to draft');
      } else {
        logError('Failed to add contacts', contactsSaveResult.error);
      }

      // Test 3: Add Message to Draft
      log('💬 Test 3: Add Message to Draft');
      const messageData = {
        message: {
          text: 'Hello {name}! Welcome to our service in {city}. This is a test message.',
          templateHash: 'hash-' + Date.now(),
          attachments: [
            { id: 'att1', type: 'image', name: 'welcome.jpg', size: 1024 }
          ]
        },
        schedules: [
          { 
            id: 's1', 
            type: 'one-time', 
            timestamp: Date.now() + 600000, // 10 minutes from now
            description: 'Immediate send'
          }
        ]
      };

      const messageSaveResult = campaignService.saveDraft(draftResult.draftId, messageData);
      if (messageSaveResult.success) {
        logSuccess('Message and schedules added to draft');
      } else {
        logError('Failed to add message', messageSaveResult.error);
      }

      // Test 4: Validate Draft Data
      log('🔍 Test 4: Validate Draft Data');
      const retrievedDraft = campaignService.getDraft(draftResult.draftId);
      if (retrievedDraft) {
        logSuccess('Draft retrieved and validated', {
          hasContacts: retrievedDraft.contacts.valid > 0,
          hasMessage: !!retrievedDraft.message.text,
          hasSchedules: retrievedDraft.schedules.length > 0
        });
      } else {
        logError('Failed to retrieve draft');
      }

      // Test 5: Publish Draft as Campaign
      log('🚀 Test 5: Publish Draft as Campaign');
      const publishResult = campaignService.publishDraftAsCampaign(draftResult.draftId);
      if (publishResult.success) {
        logSuccess('Campaign published successfully', { campaignId: publishResult.campaignId });
        setTestCampaignId(publishResult.campaignId);
      } else {
        logError('Campaign publishing failed', publishResult.error);
        return;
      }

      // Test 6: Campaign Lifecycle Operations
      log('⚡ Test 6: Campaign Lifecycle Operations');
      
      // Start Campaign
      const startResult = campaignService.startCampaign(publishResult.campaignId);
      if (startResult.success) {
        logSuccess('Campaign started (status: Scheduled)');
      } else {
        logError('Failed to start campaign', startResult.error);
      }

      // Pause Campaign
      setTimeout(() => {
        const pauseResult = campaignService.pauseCampaign(publishResult.campaignId);
        if (pauseResult.success) {
          logSuccess('Campaign paused');
        } else {
          logError('Failed to pause campaign', pauseResult.error);
        }

        // Resume Campaign
        setTimeout(() => {
          const resumeResult = campaignService.resumeCampaign(publishResult.campaignId);
          if (resumeResult.success) {
            logSuccess('Campaign resumed');
          } else {
            logError('Failed to resume campaign', resumeResult.error);
          }
        }, 1000);
      }, 1000);

      // Test 7: Duplicate Campaign
      log('📋 Test 7: Duplicate Campaign');
      const duplicateResult = campaignService.duplicateCampaign(publishResult.campaignId);
      if (duplicateResult.success) {
        logSuccess('Campaign duplicated', { 
          newDraftId: duplicateResult.draftId, 
          newName: duplicateResult.name 
        });
      } else {
        logError('Failed to duplicate campaign', duplicateResult.error);
      }

      // Test 8: Validation Tests
      log('✋ Test 8: Validation Tests');
      
      // Try to publish empty draft
      const emptyDraftResult = campaignService.createDraft({ name: 'Empty Test' });
      if (emptyDraftResult.success) {
        const publishEmptyResult = campaignService.publishDraftAsCampaign(emptyDraftResult.draftId);
        if (!publishEmptyResult.success) {
          logSuccess('Validation working: Empty draft rejected', publishEmptyResult.error);
        } else {
          logError('Validation failed: Empty draft was published');
        }
      }

      // Try duplicate name
      const dupNameResult = campaignService.createDraft({ 
        name: 'Test Campaign Service Draft' // Same name as first draft
      });
      if (dupNameResult.success) {
        const publishDupResult = campaignService.publishDraftAsCampaign(dupNameResult.draftId);
        if (!publishDupResult.success) {
          logSuccess('Validation working: Duplicate name rejected', publishDupResult.error);
        } else {
          logError('Validation failed: Duplicate name was allowed');
        }
      }

      // Refresh lists
      refreshLists();
      
      logSuccess('🎉 All Campaign Service tests completed!');

    } catch (error) {
      logError('Test suite failed with exception', error.message);
    }
  };

  const testSpecificFunction = (functionName, ...args) => {
    try {
      log(`🔧 Testing ${functionName}`);
      const result = campaignService[functionName](...args);
      logSuccess(`${functionName} result:`, result);
      return result;
    } catch (error) {
      logError(`${functionName} failed:`, error.message);
    }
  };

  const refreshLists = () => {
    const allDrafts = campaignService.listDrafts();
    const allCampaigns = campaignService.listCampaigns();
    setDrafts(allDrafts);
    setCampaigns(allCampaigns);
    log('📊 Lists refreshed', { drafts: allDrafts.length, campaigns: allCampaigns.length });
  };

  const clearAllData = () => {
    // Clear campaign data by calling adapter directly through service
    const campaigns = campaignService.listCampaigns();
    const drafts = campaignService.listDrafts();
    
    // Note: We'd need to expose delete methods in service for this to work properly
    // For now, just clear localStorage directly for testing
    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('evosaa.campaigns'));
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    setResults([]);
    setDrafts([]);
    setCampaigns([]);
    setTestDraftId(null);
    setTestCampaignId(null);
    log('🗑️ All campaign data cleared');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>Campaign Service Test Suite</h2>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={runServiceTests} style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white' }}>
          🧪 Run Full Test Suite
        </button>
        <button onClick={refreshLists} style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white' }}>
          🔄 Refresh Lists
        </button>
        <button onClick={clearAllData} style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white' }}>
          🗑️ Clear All Data
        </button>
        
        {/* Quick Function Tests */}
        {testDraftId && (
          <button onClick={() => testSpecificFunction('getDraft', testDraftId)} 
                  style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', fontSize: '12px' }}>
            Get Draft
          </button>
        )}
        {testCampaignId && (
          <button onClick={() => testSpecificFunction('getCampaign', testCampaignId)}
                  style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', fontSize: '12px' }}>
            Get Campaign
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '20px' }}>
        {/* Test Results */}
        <div>
          <h3>Test Results ({results.length})</h3>
          <div style={{ maxHeight: '500px', overflow: 'auto', border: '1px solid #ccc', padding: '10px' }}>
            {results.map((result, index) => (
              <div key={index} style={{ 
                marginBottom: '10px', 
                fontSize: '12px',
                padding: '8px',
                backgroundColor: result.status === 'error' ? '#ffebee' : 
                              result.status === 'success' ? '#e8f5e8' : '#f5f5f5',
                borderLeft: `4px solid ${result.status === 'error' ? '#f44336' : 
                                        result.status === 'success' ? '#4caf50' : '#2196f3'}`
              }}>
                <div style={{ fontWeight: 'bold' }}>
                  [{result.timestamp}] {result.message}
                </div>
                {result.data && (
                  <pre style={{ 
                    background: '#f8f9fa', 
                    padding: '5px', 
                    fontSize: '10px', 
                    overflow: 'auto',
                    marginTop: '5px'
                  }}>
                    {typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Drafts */}
        <div>
          <h3>Drafts ({drafts.length})</h3>
          <div style={{ maxHeight: '500px', overflow: 'auto', border: '1px solid #ccc', padding: '10px' }}>
            {drafts.map((draft, index) => (
              <div key={index} style={{ 
                marginBottom: '10px', 
                padding: '8px', 
                background: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '4px'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{draft.name}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>ID: {draft.draftId}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  Updated: {new Date(draft.updatedAt).toLocaleString()}
                </div>
                <button onClick={() => testSpecificFunction('getDraft', draft.draftId)}
                        style={{ fontSize: '10px', padding: '2px 6px', marginTop: '4px' }}>
                  Inspect
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Campaigns */}
        <div>
          <h3>Campaigns ({campaigns.length})</h3>
          <div style={{ maxHeight: '500px', overflow: 'auto', border: '1px solid #ccc', padding: '10px' }}>
            {campaigns.map((campaign, index) => (
              <div key={index} style={{ 
                marginBottom: '10px', 
                padding: '8px', 
                background: '#d4edda',
                border: '1px solid #c3e6cb',
                borderRadius: '4px'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{campaign.name}</div>
                <div style={{ fontSize: '11px', color: '#155724' }}>Status: {campaign.status}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>ID: {campaign.campaignId}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  Progress: {campaign.progress.sent}S / {campaign.progress.failed}F / {campaign.progress.pending}P
                </div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  <button onClick={() => testSpecificFunction('getCampaign', campaign.campaignId)}
                          style={{ fontSize: '9px', padding: '2px 4px' }}>
                    Inspect
                  </button>
                  <button onClick={() => testSpecificFunction('duplicateCampaign', campaign.campaignId)}
                          style={{ fontSize: '9px', padding: '2px 4px' }}>
                    Duplicate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f8f9fa' }}>
        <h4>Test Status</h4>
        <div style={{ fontSize: '12px' }}>
          <div>Current Draft ID: {testDraftId || 'None'}</div>
          <div>Current Campaign ID: {testCampaignId || 'None'}</div>
          <div>Total LocalStorage Keys: {Object.keys(localStorage).filter(k => k.startsWith('evosaa.campaigns')).length}</div>
        </div>
      </div>
    </div>
  );
};

export default CampaignServiceTest;