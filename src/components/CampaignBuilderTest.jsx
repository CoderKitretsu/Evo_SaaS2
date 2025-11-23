import React, { useState } from 'react';
import CampaignBuilder from './elements/CampaignElements/CampaignBuilder.jsx';
import campaignService from './elements/CampaignElements/campaignService.js';

const CampaignBuilderTest = () => {
  const [showBuilder, setShowBuilder] = useState(false);
  const [testDraftId, setTestDraftId] = useState(null);
  const [completedCampaigns, setCompletedCampaigns] = useState([]);
  const [logs, setLogs] = useState([]);

  const log = (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, data }]);
    console.log(`[${timestamp}] ${message}`, data);
  };

  const startNewCampaign = () => {
    try {
      const result = campaignService.createDraft({
        name: 'Test Campaign ' + Date.now(),
        description: 'Testing the campaign builder UI',
        instanceId: '',
        dryRun: true
      });

      if (result.success) {
        setTestDraftId(result.draftId);
        setShowBuilder(true);
        log('✅ New campaign draft created', { draftId: result.draftId });
      } else {
        log('❌ Failed to create draft', result.error);
      }
    } catch (error) {
      log('❌ Error creating draft', error.message);
    }
  };

  const loadExistingDraft = () => {
    try {
      // Create a sample draft with some data
      const sampleResult = campaignService.createDraft({
        name: 'Sample Campaign with Data',
        description: 'Pre-filled campaign for testing',
        instanceId: 'instance-1',
        dryRun: true
      });

      if (sampleResult.success) {
        // Add sample contacts
        campaignService.saveDraft(sampleResult.draftId, {
          contacts: {
            total: 3,
            valid: 3,
            invalid: 0,
            duplicates: 0,
            rows: [
              { id: 'c1', phone: '+911234567890', vars: { name: 'Alice Johnson', city: 'Mumbai' } },
              { id: 'c2', phone: '+911234567891', vars: { name: 'Bob Smith', city: 'Delhi' } },
              { id: 'c3', phone: '+911234567892', vars: { name: 'Charlie Brown', city: 'Bangalore' } }
            ]
          }
        });

        // Add sample message
        campaignService.saveDraft(sampleResult.draftId, {
          message: {
            text: 'Hello {name}! Welcome from {city}. This is a test message.',
            templateHash: 'sample-hash',
            attachments: []
          },
          schedules: [
            {
              id: 's1',
              type: 'one-time',
              timestamp: Date.now() + 600000, // 10 minutes from now
              description: 'Immediate send'
            }
          ]
        });

        setTestDraftId(sampleResult.draftId);
        setShowBuilder(true);
        log('✅ Sample campaign loaded', { draftId: sampleResult.draftId });
      }
    } catch (error) {
      log('❌ Error loading sample draft', error.message);
    }
  };

  const handleCampaignComplete = (result) => {
    log('🎉 Campaign builder completed', result);
    setCompletedCampaigns(prev => [...prev, { ...result, timestamp: Date.now() }]);
    setShowBuilder(false);
    setTestDraftId(null);
  };

  const handleBuilderCancel = () => {
    log('🚫 Campaign builder cancelled');
    setShowBuilder(false);
    setTestDraftId(null);
  };

  const testStepNavigation = () => {
    log('🧪 Testing step navigation components...');
    
    // Test service functions
    const drafts = campaignService.listDrafts();
    const campaigns = campaignService.listCampaigns();
    
    log('📊 Current drafts count', drafts.length);
    log('📊 Current campaigns count', campaigns.length);
  };

  const clearTestData = () => {
    try {
      // Clear campaign localStorage data
      const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('evosaa.campaigns'));
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      setLogs([]);
      setCompletedCampaigns([]);
      log('🗑️ All test data cleared');
    } catch (error) {
      log('❌ Error clearing data', error.message);
    }
  };

  const inspectCurrentDraft = () => {
    if (!testDraftId) {
      log('❌ No active draft to inspect');
      return;
    }

    try {
      const draft = campaignService.getDraft(testDraftId);
      log('🔍 Current draft data', draft);
    } catch (error) {
      log('❌ Error inspecting draft', error.message);
    }
  };

  if (showBuilder) {
    return (
      <div>
        {/* Header with controls */}
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          zIndex: 1000, 
          background: '#1f2937', 
          color: 'white', 
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontWeight: 'bold' }}>Campaign Builder Test</span>
            <span style={{ marginLeft: '10px', fontSize: '12px' }}>
              Draft ID: {testDraftId}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={inspectCurrentDraft}
              style={{
                padding: '5px 10px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              🔍 Inspect Draft
            </button>
            <button
              onClick={handleBuilderCancel}
              style={{
                padding: '5px 10px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              ✕ Exit Test
            </button>
          </div>
        </div>
        
        {/* Campaign Builder with top margin */}
        <div style={{ marginTop: '60px' }}>
          <CampaignBuilder
            draftId={testDraftId}
            onComplete={handleCampaignComplete}
            onCancel={handleBuilderCancel}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>Campaign Builder UI Test Suite</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Test the 4-step campaign creation wizard and all skeleton components.
      </p>

      {/* Test Controls */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '15px', 
        marginBottom: '30px' 
      }}>
        <button
          onClick={startNewCampaign}
          style={{
            padding: '15px 20px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🚀 Start New Campaign
        </button>

        <button
          onClick={loadExistingDraft}
          style={{
            padding: '15px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          📂 Load Sample Draft
        </button>

        <button
          onClick={testStepNavigation}
          style={{
            padding: '15px 20px',
            background: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🧪 Test Components
        </button>

        <button
          onClick={clearTestData}
          style={{
            padding: '15px 20px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🗑️ Clear Test Data
        </button>
      </div>

      {/* Test Information */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr 1fr', 
        gap: '20px', 
        marginBottom: '30px' 
      }}>
        {/* What to Test */}
        <div style={{ background: '#f0f9ff', padding: '20px', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#0369a1' }}>🎯 What to Test</h3>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', lineHeight: '1.6' }}>
            <li>Step navigation (Next/Back buttons)</li>
            <li>Draft persistence between steps</li>
            <li>Form validation in each step</li>
            <li>Data flow and state management</li>
            <li>Error handling and user feedback</li>
            <li>Responsive layout and UI components</li>
          </ul>
        </div>

        {/* Expected Behavior */}
        <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#059669' }}>✅ Expected Behavior</h3>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', lineHeight: '1.6' }}>
            <li>Smooth step transitions</li>
            <li>Data persisted when navigating</li>
            <li>Validation prevents invalid progression</li>
            <li>Loading states show properly</li>
            <li>Error messages are clear</li>
            <li>Final step publishes campaign</li>
          </ul>
        </div>

        {/* Known TODOs */}
        <div style={{ background: '#fffbeb', padding: '20px', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#d97706' }}>⚠️ Known TODOs</h3>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', lineHeight: '1.6' }}>
            <li>CSV parsing (placeholder data)</li>
            <li>Column mapping UI (skeleton)</li>
            <li>Full emoji picker</li>
            <li>File attachment handling</li>
            <li>Template system</li>
            <li>Test send functionality</li>
          </ul>
        </div>
      </div>

      {/* Completed Campaigns */}
      {completedCampaigns.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h3>Completed Campaigns ({completedCampaigns.length})</h3>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            {completedCampaigns.map((campaign, index) => (
              <div key={index} style={{ 
                padding: '15px', 
                borderBottom: index < completedCampaigns.length - 1 ? '1px solid #e5e7eb' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>
                    {campaign.type === 'created' && '📝 Campaign Created'}
                    {campaign.type === 'started' && '🚀 Campaign Started'}
                    {campaign.type === 'launched' && '⚡ Campaign Launched'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    ID: {campaign.campaignId} • {new Date(campaign.timestamp).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const campaign = campaignService.getCampaign(campaign.campaignId);
                    console.log('Campaign details:', campaign);
                    log('🔍 Campaign inspected', campaign);
                  }}
                  style={{
                    padding: '5px 10px',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                >
                  Inspect
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Logs */}
      <div>
        <h3>Test Logs ({logs.length})</h3>
        <div style={{ 
          background: '#1f2937', 
          color: '#f9fafb', 
          padding: '15px', 
          borderRadius: '8px', 
          maxHeight: '400px', 
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          {logs.length === 0 ? (
            <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>
              No logs yet. Start testing to see activity...
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} style={{ marginBottom: '8px' }}>
                <span style={{ color: '#60a5fa' }}>[{log.timestamp}]</span>{' '}
                <span>{log.message}</span>
                {log.data && (
                  <div style={{ 
                    marginLeft: '20px', 
                    color: '#d1d5db', 
                    fontSize: '11px',
                    background: '#374151',
                    padding: '5px',
                    borderRadius: '4px',
                    marginTop: '2px'
                  }}>
                    {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div style={{ 
        marginTop: '30px', 
        padding: '20px', 
        background: '#f3f4f6', 
        borderRadius: '8px',
        fontSize: '14px',
        lineHeight: '1.6'
      }}>
        <h4 style={{ margin: '0 0 10px 0' }}>📋 Testing Instructions:</h4>
        <ol style={{ margin: 0, paddingLeft: '20px' }}>
          <li><strong>Start New Campaign:</strong> Creates empty draft, tests Step 1 form validation</li>
          <li><strong>Load Sample Draft:</strong> Pre-filled data, test navigation between all steps</li>
          <li><strong>Test Components:</strong> Verify service functions and data persistence</li>
          <li><strong>Navigate Steps:</strong> Use Next/Back buttons, verify data retention</li>
          <li><strong>Test Validation:</strong> Try submitting incomplete forms</li>
          <li><strong>Complete Flow:</strong> Go through all 4 steps and publish campaign</li>
        </ol>
      </div>
    </div>
  );
};

export default CampaignBuilderTest;