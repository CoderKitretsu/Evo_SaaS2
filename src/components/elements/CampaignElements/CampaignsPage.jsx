import React, { useState, useEffect } from 'react';
import campaignService from './campaignService.js';
import CampaignCard from './CampaignCard.jsx';
import CampaignBuilder from './CampaignBuilder.jsx';
import CampaignDetail from './CampaignDetail.jsx';
import './CampaignsPage.css';

/**
 * CampaignDetailWrapper - Wrapper for CampaignDetail without React Router
 */
const CampaignDetailWrapper = ({ campaignId, onBack, onBackToMessaging }) => {
  return (
    <div className="campaign-detail-wrapper">
      {/* Custom navigation header */}
      <div className="detail-nav-header">
        <button onClick={onBack} className="back-btn">
          ← Back to Campaigns
        </button>
        {onBackToMessaging && (
          <button onClick={onBackToMessaging} className="back-btn secondary">
            ← Back to Messaging
          </button>
        )}
      </div>
      
      {/* Modified CampaignDetail that works without router */}
      <CampaignDetailContent campaignId={campaignId} onNavigate={onBack} />
    </div>
  );
};

/**
 * CampaignDetailContent - Core detail functionality without router dependencies
 */
const CampaignDetailContent = ({ campaignId, onNavigate }) => {
  // State
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Contacts tab state
  const [contactsFilter, setContactsFilter] = useState({
    search: '',
    status: 'all'
  });
  const [filteredContacts, setFilteredContacts] = useState([]);
  
  // Logs state
  const [logs, setLogs] = useState([]);

  // Load campaign on mount
  useEffect(() => {
    loadCampaign();
  }, [campaignId]);

  // Filter contacts when filter changes
  useEffect(() => {
    if (campaign?.perContact) {
      applyContactsFilter();
    }
  }, [campaign, contactsFilter]);

  const loadCampaign = async () => {
    try {
      setLoading(true);
      
      console.log('=== LOADING CAMPAIGN DEBUG ===');
      console.log('Campaign ID to load:', campaignId);
      console.log('Type of campaign ID:', typeof campaignId);
      
      // Debug: Check what keys exist in localStorage
      const campaignKeys = Object.keys(localStorage).filter(key => key.includes('campaign'));
      console.log('Campaign-related keys in localStorage:', campaignKeys);
      
      // First try to load as a published campaign
      console.log('Attempting to load as published campaign...');
      let result = campaignService.getCampaign(campaignId);
      console.log('getCampaign result:', result);
      
      if (result.success) {
        console.log('✅ Found as published campaign:', result);
        setCampaign(result.campaign);
        loadLogs(result.campaign);
      } else {
        // If not found as campaign, try to load as draft
        console.log('❌ Campaign not found, trying as draft...');
        result = campaignService.getDraft(campaignId);
        console.log('getDraft result:', result);
        
        if (result.success) {
          console.log('✅ Found as draft:', result);
          // Convert draft to campaign-like structure for display
          const draftAsCampaign = {
            ...result.draft,
            campaignId: result.draft.draftId,
            status: 'Draft',
            progress: { 
              sent: 0, 
              pending: result.draft.contacts?.valid || 0, 
              failed: 0 
            },
            createdAt: result.draft.createdAt || Date.now(),
            updatedAt: result.draft.updatedAt || Date.now()
          };
          console.log('Converted draft to campaign format:', draftAsCampaign);
          setCampaign(draftAsCampaign);
          loadLogs(draftAsCampaign);
        } else {
          console.error('❌ Neither campaign nor draft found');
          console.error('Final error:', result.error);
          
          // Additional debug: try to find any campaign data
          const allCampaignData = [];
          for (let key of campaignKeys) {
            try {
              const data = JSON.parse(localStorage.getItem(key));
              allCampaignData.push({ key, data });
            } catch (e) {
              console.error('Failed to parse', key);
            }
          }
          console.log('All campaign data found:', allCampaignData);
          
          setError('Campaign not found: ' + result.error);
        }
      }
      console.log('=== END LOADING DEBUG ===');
    } catch (err) {
      console.error('Error loading campaign:', err);
      setError('Failed to load campaign: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = (campaignData) => {
    try {
      const logsKey = `evosaa.campaigns.logs.${campaignId}`;
      const storedLogs = JSON.parse(localStorage.getItem(logsKey) || '[]');
      
      const syntheticLogs = [];
      if (campaignData.createdAt) {
        syntheticLogs.push({
          timestamp: campaignData.createdAt,
          level: 'info',
          message: 'Campaign created',
          details: { status: 'Created' }
        });
      }
      
      if (campaignData.status === 'Running' && campaignData.progress?.sent > 0) {
        syntheticLogs.push({
          timestamp: Date.now(),
          level: 'success',
          message: `Sent ${campaignData.progress.sent} messages`,
          details: { sent: campaignData.progress.sent }
        });
      }
      
      const allLogs = [...storedLogs, ...syntheticLogs].sort((a, b) => b.timestamp - a.timestamp);
      setLogs(allLogs);
    } catch (err) {
      console.error('Failed to load logs:', err);
      setLogs([]);
    }
  };

  const applyContactsFilter = () => {
    if (!campaign?.perContact) return;
    
    const contacts = Object.entries(campaign.perContact).map(([contactId, contactData]) => {
      const contactDetails = campaign.contacts?.rows?.find(row => row.id === contactId) || {};
      return {
        id: contactId,
        phone: contactDetails.phone || 'Unknown',
        name: contactDetails.vars?.name || 'Unknown',
        vars: contactDetails.vars || {},
        status: contactData.status || 'pending',
        attempts: contactData.attempts || 0,
        lastError: contactData.lastError,
        lastAttempt: contactData.lastAttempt
      };
    });

    let filtered = [...contacts];

    if (contactsFilter.search) {
      const searchLower = contactsFilter.search.toLowerCase();
      filtered = filtered.filter(contact =>
        contact.phone.toLowerCase().includes(searchLower) ||
        contact.name.toLowerCase().includes(searchLower)
      );
    }

    if (contactsFilter.status !== 'all') {
      filtered = filtered.filter(contact => contact.status === contactsFilter.status);
    }

    setFilteredContacts(filtered);
  };

  const handleCampaignAction = async (action) => {
    try {
      let result;
      switch (action) {
        case 'start':
          result = campaignService.startCampaign(campaignId);
          break;
        case 'pause':
          result = campaignService.pauseCampaign(campaignId);
          break;
        case 'resume':
          result = campaignService.resumeCampaign(campaignId);
          break;
        case 'cancel':
          if (confirm('Are you sure you want to cancel this campaign? This cannot be undone.')) {
            result = campaignService.cancelCampaign(campaignId);
          }
          break;
        case 'duplicate':
          result = campaignService.duplicateCampaign(campaignId);
          if (result.success) {
            alert('Campaign duplicated successfully! Check your drafts.');
          }
          break;
        case 'delete':
          if (confirm('Are you sure you want to delete this campaign? This cannot be undone.')) {
            result = campaignService.deleteCampaign(campaignId);
            if (result.success) {
              onNavigate(); // Go back to campaigns list
            }
          }
          break;
        default:
          console.error('Unknown action:', action);
          return;
      }

      if (result && result.success) {
        await loadCampaign();
      } else if (result) {
        alert('Action failed: ' + result.error);
      }
    } catch (err) {
      console.error('Campaign action error:', err);
      alert('Action failed: ' + err.message);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Not set';
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status) => {
    const colors = {
      Draft: '#6b7280',
      Scheduled: '#3b82f6',
      Running: '#10b981',
      Paused: '#f59e0b',
      Completed: '#059669',
      Cancelled: '#6b7280',
      Failed: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const getProgressPercentage = () => {
    const { sent = 0, pending = 0, failed = 0 } = campaign?.progress || {};
    const total = sent + pending + failed;
    return total > 0 ? Math.round((sent / total) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="campaign-detail">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="campaign-detail">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Error Loading Campaign</h3>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={onNavigate} className="btn-secondary">
              Back to Campaigns
            </button>
            <button onClick={loadCampaign} className="btn-primary">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="campaign-detail">
        <div className="error-state">
          <div className="error-icon">📭</div>
          <h3>Campaign Not Found</h3>
          <p>The campaign you're looking for doesn't exist or has been deleted.</p>
          <button onClick={onNavigate} className="btn-primary">
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="campaign-detail-content">
      {/* Campaign Header */}
      <div className="detail-header">        
        <div className="header-content">
          <div className="header-info">
            <h1>{campaign.meta?.name || 'Untitled Campaign'}</h1>
            <div 
              className="status-pill large"
              style={{ backgroundColor: getStatusColor(campaign.status) }}
            >
              {campaign.status}
            </div>
          </div>
          
          <div className="header-meta">
            <span className="meta-item">📱 Instance: {campaign.meta?.instanceId}</span>
            <span className="meta-item">👥 {campaign.contacts?.valid || 0} contacts</span>
            <span className="meta-item">📅 Created: {formatDate(campaign.createdAt)}</span>
            {campaign.meta?.dryRun && <span className="dry-run-badge">DRY RUN</span>}
          </div>
        </div>

        <div className="header-actions">
          <div className="action-buttons">
            <button onClick={() => handleCampaignAction('duplicate')} className="btn-secondary">
              📋 Duplicate
            </button>
            
            {['scheduled', 'paused'].includes(campaign.status?.toLowerCase()) && (
              <button onClick={() => handleCampaignAction('start')} className="btn-primary">
                ▶️ Start
              </button>
            )}
            
            {campaign.status?.toLowerCase() === 'running' && (
              <button onClick={() => handleCampaignAction('pause')} className="btn-warning">
                ⏸️ Pause
              </button>
            )}
            
            {campaign.status?.toLowerCase() === 'paused' && (
              <button onClick={() => handleCampaignAction('resume')} className="btn-success">
                ▶️ Resume
              </button>
            )}
            
            {['scheduled', 'running', 'paused'].includes(campaign.status?.toLowerCase()) && (
              <button onClick={() => handleCampaignAction('cancel')} className="btn-danger">
                🛑 Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-header">
          <span>Campaign Progress</span>
          <span>{getProgressPercentage()}% Complete</span>
        </div>
        <div className="progress-bar large">
          <div 
            className="progress-fill"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
        <div className="progress-stats">
          <div className="stat-card sent">
            <div className="stat-value">{campaign.progress?.sent || 0}</div>
            <div className="stat-label">Sent</div>
          </div>
          <div className="stat-card pending">
            <div className="stat-value">{campaign.progress?.pending || 0}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card failed">
            <div className="stat-value">{campaign.progress?.failed || 0}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-section">
        <div className="tabs-nav">
          {['overview', 'contacts', 'logs'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="tab-panel overview">
              <div className="overview-grid">
                <div className="overview-card">
                  <h3>Campaign Details</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Name</label>
                      <span>{campaign.meta?.name || 'Untitled'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Description</label>
                      <span>{campaign.meta?.description || 'No description'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Instance</label>
                      <span>{campaign.meta?.instanceId}</span>
                    </div>
                    <div className="detail-item">
                      <label>Start Time</label>
                      <span>{formatDate(campaign.meta?.startAt)}</span>
                    </div>
                    <div className="detail-item">
                      <label>End Time</label>
                      <span>{formatDate(campaign.meta?.endAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="overview-card">
                  <h3>Message Content</h3>
                  <div className="message-preview">
                    {campaign.message?.text || 'No message content'}
                  </div>
                  {campaign.message?.attachments && campaign.message.attachments.length > 0 && (
                    <div className="attachments-summary">
                      📎 {campaign.message.attachments.length} attachment(s)
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Contacts Tab */}
          {activeTab === 'contacts' && (
            <div className="tab-panel contacts">
              <div className="contacts-controls">
                <div className="contacts-filters">
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={contactsFilter.search}
                    onChange={(e) => setContactsFilter(prev => ({ ...prev, search: e.target.value }))}
                    className="search-input"
                  />
                  <select
                    value={contactsFilter.status}
                    onChange={(e) => setContactsFilter(prev => ({ ...prev, status: e.target.value }))}
                    className="status-filter"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="sent">Sent</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>

              <div className="contacts-table">
                <table>
                  <thead>
                    <tr>
                      <th>Phone</th>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Attempts</th>
                      <th>Variables</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map(contact => (
                      <tr key={contact.id} className={`status-${contact.status}`}>
                        <td>{contact.phone}</td>
                        <td>{contact.name}</td>
                        <td>
                          <span className={`status-badge ${contact.status}`}>
                            {contact.status}
                          </span>
                        </td>
                        <td>{contact.attempts}</td>
                        <td>
                          <div className="variables-cell">
                            {Object.entries(contact.vars).map(([key, value]) => (
                              <span key={key} className="variable-item">
                                {key}: {value}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredContacts.length === 0 && (
                  <div className="no-contacts">
                    No contacts match your filter criteria
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="tab-panel logs">
              <div className="logs-header">
                <h3>Campaign Logs</h3>
                <button onClick={() => loadLogs(campaign)} className="btn-secondary">
                  🔄 Refresh
                </button>
              </div>
              
              <div className="logs-list">
                {logs.map((log, idx) => (
                  <div key={idx} className={`log-entry ${log.level}`}>
                    <div className="log-timestamp">
                      {formatDate(log.timestamp)}
                    </div>
                    <div className="log-level">
                      {log.level.toUpperCase()}
                    </div>
                    <div className="log-message">
                      {log.message}
                    </div>
                    {log.details && (
                      <div className="log-details">
                        {JSON.stringify(log.details)}
                      </div>
                    )}
                  </div>
                ))}
                
                {logs.length === 0 && (
                  <div className="no-logs">
                    No logs available for this campaign
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * CampaignsPage - Main campaigns listing with filters and search
 * Implements left column filters, middle campaign list, right detail panel
 */
const CampaignsPage = ({ onBackToMessaging }) => {
  
  // State
  const [campaigns, setCampaigns] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCampaignBuilder, setShowCampaignBuilder] = useState(false);
  const [showDrafts, setShowDrafts] = useState(true);
  const [detailViewCampaign, setDetailViewCampaign] = useState(null);
  
  // Filters state
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    instance: 'all',
    dateFrom: '',
    dateTo: ''
  });
  
  // Available filter options
  const [instances, setInstances] = useState([]);
  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Scheduled', label: 'Scheduled' },
    { value: 'Running', label: 'Running' },
    { value: 'Paused', label: 'Paused' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Cancelled', label: 'Cancelled' },
    { value: 'Failed', label: 'Failed' }
  ];

  // Load campaigns on mount
  useEffect(() => {
    loadCampaigns();
    loadInstances();
  }, []);

  // Apply filters when items or filters change
  useEffect(() => {
    applyFilters();
  }, [allItems, filters, showDrafts]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading campaigns and drafts...');
      
      // Load both campaigns and drafts
      const campaignResult = campaignService.listCampaigns();
      const draftResult = campaignService.listDrafts();
      
      console.log('Campaign result:', campaignResult);
      console.log('Draft result:', draftResult);
      
      let allCampaigns = [];
      let allDrafts = [];
      
      if (campaignResult.success) {
        allCampaigns = campaignResult.campaigns || [];
        setCampaigns(allCampaigns);
        console.log('Loaded campaigns:', allCampaigns.length);
      } else {
        console.error('Failed to load campaigns:', campaignResult.error);
      }
      
      if (draftResult.success) {
        // Convert drafts to campaign-like format for display
        allDrafts = (draftResult.drafts || []).map(draft => ({
          ...draft,
          campaignId: draft.draftId,
          status: 'Draft',
          progress: { sent: 0, pending: draft.contacts?.valid || 0, failed: 0 },
          createdAt: draft.createdAt || Date.now(),
          updatedAt: draft.updatedAt || Date.now()
        }));
        setDrafts(allDrafts);
        console.log('Loaded drafts:', allDrafts.length);
      } else {
        console.error('Failed to load drafts:', draftResult.error);
      }
      
      // Combine all items for display
      const combined = [...allCampaigns, ...allDrafts];
      setAllItems(combined);
      console.log('Total combined items:', combined.length);
      
      if (!campaignResult.success && !draftResult.success) {
        setError(`Failed to load campaigns and drafts. Campaigns: ${campaignResult.error || 'Unknown error'}. Drafts: ${draftResult.error || 'Unknown error'}`);
      } else if (!campaignResult.success) {
        setError(`Failed to load campaigns: ${campaignResult.error || 'Unknown error'}`);
      } else if (!draftResult.success) {
        setError(`Failed to load drafts: ${draftResult.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Load campaigns error:', err);
      setError('Failed to load campaigns: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadInstances = () => {
    // Load instances from localStorage (from existing instance manager)
    try {
      const instancesData = JSON.parse(localStorage.getItem('whatsappInstances') || '[]');
      const instanceOptions = [
        { value: 'all', label: 'All Instances' },
        ...instancesData.map(inst => ({ 
          value: inst.id, 
          label: `${inst.name} (${inst.id})` 
        }))
      ];
      setInstances(instanceOptions);
    } catch (err) {
      console.error('Failed to load instances:', err);
      setInstances([{ value: 'all', label: 'All Instances' }]);
    }
  };

  const applyFilters = () => {
    let filtered = [...allItems];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(campaign =>
        campaign.meta?.name?.toLowerCase().includes(searchLower) ||
        campaign.meta?.description?.toLowerCase().includes(searchLower) ||
        campaign.campaignId.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(campaign => campaign.status === filters.status);
    }

    // Instance filter
    if (filters.instance !== 'all') {
      filtered = filtered.filter(campaign => campaign.meta?.instanceId === filters.instance);
    }

    // Date range filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom).getTime();
      filtered = filtered.filter(campaign => 
        (campaign.meta?.startAt || campaign.createdAt) >= fromDate
      );
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo).getTime();
      filtered = filtered.filter(campaign => 
        (campaign.meta?.startAt || campaign.createdAt) <= toDate
      );
    }

    setFilteredCampaigns(filtered);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleCreateCampaign = () => {
    setShowCampaignBuilder(true);
  };

  const handleCampaignBuilderComplete = () => {
    setShowCampaignBuilder(false);
    loadCampaigns(); // Refresh the campaigns list
  };

  const handleCampaignBuilderCancel = () => {
    setShowCampaignBuilder(false);
  };

  const handleCampaignSelect = (campaign) => {
    console.log('=== CAMPAIGN SELECTED ===');
    console.log('Selected campaign:', campaign);
    console.log('Campaign ID:', campaign?.campaignId || campaign?.draftId);
    console.log('========================');
    setSelectedCampaign(campaign);
  };

  const handleCampaignAction = async (action, campaignId) => {
    try {
      let result;
      switch (action) {
        case 'start':
          result = campaignService.startCampaign(campaignId);
          break;
        case 'pause':
          result = campaignService.pauseCampaign(campaignId);
          break;
        case 'resume':
          result = campaignService.resumeCampaign(campaignId);
          break;
        case 'cancel':
          if (confirm('Are you sure you want to cancel this campaign? This cannot be undone.')) {
            result = campaignService.cancelCampaign(campaignId);
          }
          break;
        case 'duplicate':
          result = campaignService.duplicateCampaign(campaignId);
          if (result.success) {
            alert('Campaign duplicated successfully!');
          }
          break;
        case 'delete':
          if (confirm('Are you sure you want to delete this campaign? This cannot be undone.')) {
            result = campaignService.deleteCampaign(campaignId);
          }
          break;
        case 'view':
          // Navigate to campaign detail view
          console.log('Viewing campaign details for ID:', campaignId);
          console.log('Selected campaign object:', selectedCampaign);
          
          // Debug: Check what's in localStorage
          console.log('=== DEBUGGING CAMPAIGN STORAGE ===');
          const allKeys = Object.keys(localStorage).filter(key => key.startsWith('evosaa.campaigns'));
          console.log('All campaign keys in localStorage:', allKeys);
          allKeys.forEach(key => {
            try {
              const data = JSON.parse(localStorage.getItem(key));
              console.log(`${key}:`, data);
            } catch (e) {
              console.log(`${key}: [parse error]`, localStorage.getItem(key));
            }
          });
          console.log('=== END DEBUG ===');
          
          setDetailViewCampaign(campaignId);
          break;
        default:
          console.error('Unknown action:', action);
          return;
      }

      if (result && result.success) {
        await loadCampaigns(); // Refresh list
        if (selectedCampaign?.campaignId === campaignId) {
          // Refresh selected campaign detail
          const updatedCampaign = campaignService.getCampaign(campaignId);
          if (updatedCampaign.success) {
            setSelectedCampaign(updatedCampaign.campaign);
          }
        }
      } else if (result) {
        alert('Action failed: ' + result.error);
      }
    } catch (err) {
      console.error('Campaign action error:', err);
      alert('Action failed: ' + err.message);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Not set';
    return new Date(timestamp).toLocaleDateString() + ' ' + new Date(timestamp).toLocaleTimeString();
  };

  const getStatusColor = (status) => {
    const colors = {
      Draft: '#6b7280',
      Scheduled: '#3b82f6',
      Running: '#10b981',
      Paused: '#f59e0b',
      Completed: '#059669',
      Cancelled: '#6b7280',
      Failed: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  if (loading) {
    return (
      <div className="campaigns-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading campaigns...</p>
        </div>
      </div>
    );
  }

  // Show Campaign Builder if in creation mode
  // Show campaign detail view if selected
  if (detailViewCampaign) {
    return (
      <CampaignDetailWrapper 
        campaignId={detailViewCampaign}
        onBack={() => setDetailViewCampaign(null)}
        onBackToMessaging={onBackToMessaging}
      />
    );
  }

  if (showCampaignBuilder) {
    return (
      <CampaignBuilder
        onComplete={handleCampaignBuilderComplete}
        onCancel={handleCampaignBuilderCancel}
      />
    );
  }

  return (
    <div className="campaigns-page">
      {/* Header */}
      <div className="campaigns-header">
        <div className="header-nav">
          {onBackToMessaging && (
            <button onClick={onBackToMessaging} className="back-btn">
              ← Back to Messaging
            </button>
          )}
        </div>
        <div className="header-content">
          <h1>Campaigns</h1>
          <p>Create and manage your multi-send messaging campaigns</p>
        </div>
        <button 
          onClick={handleCreateCampaign}
          className="btn-primary create-campaign-btn"
        >
          + Create Campaign
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      <div className="campaigns-content">
        {/* Left Column - Filters */}
        <div className="filters-column">
          <div className="filters-section">
            <h3>Filters</h3>
            
            {/* Search */}
            <div className="filter-group">
              <label>Search</label>
              <input
                type="text"
                placeholder="Search campaigns..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="filter-input"
              />
            </div>

            {/* Status Filter */}
            <div className="filter-group">
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="filter-select"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Show Drafts Toggle */}
            <div className="filter-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showDrafts}
                  onChange={(e) => setShowDrafts(e.target.checked)}
                />
                <span>Show Drafts</span>
              </label>
            </div>

            {/* Instance Filter */}
            <div className="filter-group">
              <label>Instance</label>
              <select
                value={filters.instance}
                onChange={(e) => handleFilterChange('instance', e.target.value)}
                className="filter-select"
              >
                {instances.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="filter-group">
              <label>Date Range</label>
              <div className="date-range">
                <input
                  type="date"
                  placeholder="From"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="filter-input date-input"
                />
                <input
                  type="date"
                  placeholder="To"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="filter-input date-input"
                />
              </div>
            </div>

            {/* Clear Filters */}
            <button
              onClick={() => setFilters({
                search: '', status: 'all', instance: 'all', dateFrom: '', dateTo: ''
              })}
              className="btn-secondary clear-filters"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Middle Column - Campaign List */}
        <div className="campaigns-list-column">
          <div className="campaigns-list-header">
            <h3>Campaigns & Drafts ({filteredCampaigns.length})</h3>
          </div>
          
          <div className="campaigns-list">
            {filteredCampaigns.length === 0 ? (
              <div className="empty-state">
                {allItems.length === 0 ? (
                  <>
                    <div className="empty-icon">📢</div>
                    <h3>No campaigns yet</h3>
                    <p>Create your first campaign to start sending messages at scale</p>
                    <button onClick={handleCreateCampaign} className="btn-primary">
                      Create First Campaign
                    </button>
                  </>
                ) : (
                  <>
                    <div className="empty-icon">🔍</div>
                    <h3>No campaigns match your filters</h3>
                    <p>Try adjusting your search or filter criteria</p>
                  </>
                )}
              </div>
            ) : (
              filteredCampaigns.map(campaign => (
                <CampaignCard
                  key={campaign.campaignId}
                  campaign={campaign}
                  isSelected={selectedCampaign?.campaignId === campaign.campaignId}
                  onSelect={() => handleCampaignSelect(campaign)}
                  onAction={handleCampaignAction}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Column - Campaign Detail */}
        <div className="campaign-detail-column">
          {selectedCampaign ? (
            <div className="campaign-detail-preview">
              <div className="detail-header">
                <h3>{selectedCampaign.meta?.name || 'Untitled Campaign'}</h3>
                <div 
                  className="status-pill"
                  style={{ backgroundColor: getStatusColor(selectedCampaign.status) }}
                >
                  {selectedCampaign.status}
                </div>
              </div>

              <div className="detail-content">
                <div className="detail-section">
                  <h4>Overview</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Instance</label>
                      <span>{selectedCampaign.meta?.instanceId || 'Not set'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Start Time</label>
                      <span>{formatDate(selectedCampaign.meta?.startAt)}</span>
                    </div>
                    <div className="detail-item">
                      <label>End Time</label>
                      <span>{formatDate(selectedCampaign.meta?.endAt)}</span>
                    </div>
                    <div className="detail-item">
                      <label>Dry Run</label>
                      <span>{selectedCampaign.meta?.dryRun ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Progress</h4>
                  <div className="progress-stats">
                    <div className="stat-item sent">
                      <span className="stat-value">{selectedCampaign.progress?.sent || 0}</span>
                      <span className="stat-label">Sent</span>
                    </div>
                    <div className="stat-item pending">
                      <span className="stat-value">{selectedCampaign.progress?.pending || 0}</span>
                      <span className="stat-label">Pending</span>
                    </div>
                    <div className="stat-item failed">
                      <span className="stat-value">{selectedCampaign.progress?.failed || 0}</span>
                      <span className="stat-label">Failed</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Message Preview</h4>
                  <div className="message-preview">
                    {selectedCampaign.message?.text || 'No message content'}
                  </div>
                </div>
              </div>

              <div className="detail-actions">
                <button
                  onClick={() => {
                    const id = selectedCampaign.campaignId || selectedCampaign.draftId;
                    console.log('View Details clicked - Selected campaign:', selectedCampaign);
                    console.log('Using ID:', id);
                    if (id) {
                      handleCampaignAction('view', id);
                    } else {
                      console.error('No valid ID found in selectedCampaign');
                      alert('Error: Cannot view details - no campaign ID found');
                    }
                  }}
                  className="btn-primary"
                >
                  View Details
                </button>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <div className="no-selection-icon">👈</div>
              <h3>Select a campaign</h3>
              <p>Choose a campaign from the list to see its details here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignsPage;