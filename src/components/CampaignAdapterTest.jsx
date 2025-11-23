import React, { useState } from 'react';
import campaignAdapter from './elements/CampaignElements/CampaignLocalStorageAdapter.js';

const CampaignAdapterTest = () => {
  const [results, setResults] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);

  const log = (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setResults(prev => [...prev, { timestamp, message, data }]);
    console.log(`[${timestamp}] ${message}`, data);
  };

  const runTests = async () => {
    setResults([]);
    log('🧪 Starting CampaignLocalStorageAdapter Tests');

    try {
      // Test 1: Save Draft
      log('📝 Test 1: Save Draft');
      const testDraft = {
        draftId: 'test-draft-' + Date.now(),
        meta: { 
          name: 'Test Campaign Draft',
          description: 'Testing the adapter',
          instanceId: 'inst-1',
          dryRun: true,
          startAt: Date.now() + 300000, // 5 minutes from now
          timezone: 'Asia/Kolkata'
        },
        contacts: { 
          total: 3, 
          valid: 3, 
          invalid: 0, 
          rows: [
            { id: 'r1', phone: '+911234567890', vars: { name: 'Alice' } },
            { id: 'r2', phone: '+911234567891', vars: { name: 'Bob' } },
            { id: 'r3', phone: '+911234567892', vars: { name: 'Charlie' } }
          ]
        },
        message: { 
          text: 'Hello {name}, this is a test message!',
          templateHash: 'test-hash-123'
        },
        schedules: [
          { id: 's1', type: 'one-time', timestamp: Date.now() + 600000 }
        ],
        createdAt: Date.now()
      };

      const saveResult = campaignAdapter.saveDraft(testDraft.draftId, testDraft);
      log('✅ Draft save result:', saveResult);

      // Test 2: Get Draft
      log('📖 Test 2: Get Draft');
      const retrievedDraft = campaignAdapter.getDraft(testDraft.draftId);
      log('✅ Retrieved draft:', retrievedDraft);

      // Test 3: List Drafts
      log('📋 Test 3: List Drafts');
      const allDrafts = campaignAdapter.listDrafts();
      log('✅ All drafts:', allDrafts);
      setDrafts(allDrafts);

      // Test 4: Create Campaign from Draft
      log('🚀 Test 4: Create Campaign');
      const campaignId = 'campaign-' + Date.now();
      const campaignData = {
        ...testDraft,
        campaignId,
        draftRef: testDraft.draftId,
        status: 'Draft',
        progress: { sent: 0, failed: 0, pending: 3 },
        perContact: {
          'r1': { status: 'pending', attempts: 0 },
          'r2': { status: 'pending', attempts: 0 },
          'r3': { status: 'pending', attempts: 0 }
        }
      };

      const campaignSaveResult = campaignAdapter.saveCampaign(campaignId, campaignData);
      log('✅ Campaign save result:', campaignSaveResult);

      // Test 5: Get Campaign
      log('📖 Test 5: Get Campaign');
      const retrievedCampaign = campaignAdapter.getCampaign(campaignId);
      log('✅ Retrieved campaign:', retrievedCampaign);

      // Test 6: Update Campaign
      log('🔄 Test 6: Update Campaign');
      const updateResult = campaignAdapter.updateCampaign(campaignId, {
        status: 'Running',
        progress: { sent: 1, failed: 0, pending: 2 },
        perContact: {
          ...campaignData.perContact,
          'r1': { status: 'sent', attempts: 1, sentAt: Date.now() }
        }
      });
      log('✅ Update result:', updateResult);

      // Test 7: List Campaigns
      log('📋 Test 7: List Campaigns');
      const allCampaigns = campaignAdapter.listCampaigns();
      log('✅ All campaigns:', allCampaigns);
      setCampaigns(allCampaigns);

      // Test 8: Index integrity check
      log('🔍 Test 8: Check LocalStorage Keys');
      const campaignKeys = Object.keys(localStorage).filter(k => k.startsWith('evosaa.campaigns'));
      log('✅ Campaign keys in localStorage:', campaignKeys);

      log('🎉 All tests completed successfully!');

    } catch (error) {
      log('❌ Test failed:', error.message);
      console.error('Test error:', error);
    }
  };

  const clearStorage = () => {
    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('evosaa.campaigns'));
    keysToRemove.forEach(key => localStorage.removeItem(key));
    setResults([]);
    setDrafts([]);
    setCampaigns([]);
    log('🗑️ Cleared all campaign data from localStorage');
  };

  const refreshLists = () => {
    setDrafts(campaignAdapter.listDrafts());
    setCampaigns(campaignAdapter.listCampaigns());
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>Campaign LocalStorage Adapter Test</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={runTests} style={{ marginRight: '10px', padding: '10px 20px' }}>
          🧪 Run All Tests
        </button>
        <button onClick={refreshLists} style={{ marginRight: '10px', padding: '10px 20px' }}>
          🔄 Refresh Lists
        </button>
        <button onClick={clearStorage} style={{ padding: '10px 20px', backgroundColor: '#ff6b6b' }}>
          🗑️ Clear Storage
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
        {/* Test Results */}
        <div>
          <h3>Test Results</h3>
          <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #ccc', padding: '10px' }}>
            {results.map((result, index) => (
              <div key={index} style={{ marginBottom: '10px', fontSize: '12px' }}>
                <div style={{ fontWeight: 'bold' }}>[{result.timestamp}] {result.message}</div>
                {result.data && (
                  <pre style={{ background: '#f5f5f5', padding: '5px', fontSize: '10px', overflow: 'auto' }}>
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Drafts */}
        <div>
          <h3>Drafts ({drafts.length})</h3>
          <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #ccc', padding: '10px' }}>
            {drafts.map((draft, index) => (
              <div key={index} style={{ marginBottom: '10px', padding: '8px', background: '#f9f9f9' }}>
                <div><strong>{draft.name}</strong></div>
                <div style={{ fontSize: '12px' }}>ID: {draft.draftId}</div>
                <div style={{ fontSize: '12px' }}>
                  Updated: {new Date(draft.updatedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Campaigns */}
        <div>
          <h3>Campaigns ({campaigns.length})</h3>
          <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #ccc', padding: '10px' }}>
            {campaigns.map((campaign, index) => (
              <div key={index} style={{ marginBottom: '10px', padding: '8px', background: '#f0f8ff' }}>
                <div><strong>{campaign.name}</strong></div>
                <div style={{ fontSize: '12px' }}>Status: {campaign.status}</div>
                <div style={{ fontSize: '12px' }}>ID: {campaign.campaignId}</div>
                <div style={{ fontSize: '12px' }}>
                  Progress: {campaign.progress.sent}S / {campaign.progress.failed}F / {campaign.progress.pending}P
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Storage Inspector */}
      <div style={{ marginTop: '20px' }}>
        <h3>LocalStorage Inspector</h3>
        <button onClick={() => {
          const keys = Object.keys(localStorage).filter(k => k.startsWith('evosaa.campaigns'));
          console.log('Campaign keys:', keys);
          keys.forEach(key => {
            console.log(`${key}:`, JSON.parse(localStorage.getItem(key)));
          });
        }}>
          🔍 Inspect Storage (Check Console)
        </button>
      </div>
    </div>
  );
};

export default CampaignAdapterTest;