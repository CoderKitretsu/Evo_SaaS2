import React, { useState, useEffect, useRef } from 'react';
import campaignService from './campaignService.js';
import './CampaignDetail.css';

/**
 * CampaignDetail - Detailed campaign view with live updates
 * Implements Overview/Contacts/Logs/Settings tabs with real-time progress
 */
const CampaignDetail = ({ campaignId, onNavigate }) => {
  
  // State
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshInterval, setRefreshInterval] = useState(null);
  
  // Contacts tab state
  const [contactsFilter, setContactsFilter] = useState({
    search: '',
    status: 'all'
  });
  const [filteredContacts, setFilteredContacts] = useState([]);
  
  // Logs state
  const [logs, setLogs] = useState([]);
  
  // Subscription cleanup
  const updateSubscription = useRef(null);

  // Load campaign on mount
  useEffect(() => {
    loadCampaign();
    setupLiveUpdates();
    
    return () => {
      if (updateSubscription.current) {
        updateSubscription.current();
      }
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
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
      const result = campaignService.getCampaign(campaignId);
      if (result.success) {
        setCampaign(result.campaign);
        loadLogs(result.campaign);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load campaign: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const setupLiveUpdates = () => {
    // Subscribe to campaign updates (if runner is available)
    if (window.campaignRunner && typeof window.campaignRunner.onCampaignUpdate === 'function') {
      updateSubscription.current = window.campaignRunner.onCampaignUpdate(campaignId, (updatedCampaign) => {
        setCampaign(updatedCampaign);
        loadLogs(updatedCampaign);
      });
    } else {
      // Fallback to periodic refresh for active campaigns
      const interval = setInterval(() => {
        if (campaign && ['Running', 'Scheduled'].includes(campaign.status)) {
          loadCampaign();
        }
      }, 5000);
      setRefreshInterval(interval);
    }
  };

  const loadLogs = (campaignData) => {
    // Load logs from localStorage or campaign runner
    try {
      const logsKey = `evosaa.campaigns.logs.${campaignId}`;
      const storedLogs = JSON.parse(localStorage.getItem(logsKey) || '[]');
      
      // Add synthetic logs based on campaign state
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
      // Find contact details from campaign.contacts.rows
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

    // Search filter
    if (contactsFilter.search) {
      const searchLower = contactsFilter.search.toLowerCase();
      filtered = filtered.filter(contact =>
        contact.phone.toLowerCase().includes(searchLower) ||
        contact.name.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
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
              onNavigate();
            }
          }
          break;
        default:
          console.error('Unknown action:', action);
          return;
      }

      if (result && result.success) {
        await loadCampaign(); // Refresh campaign data
      } else if (result) {
        alert('Action failed: ' + result.error);
      }
    } catch (err) {
      console.error('Campaign action error:', err);
      alert('Action failed: ' + err.message);
    }
  };

  const exportContacts = (status = 'all') => {
    const contactsToExport = status === 'all' ? filteredContacts : 
      filteredContacts.filter(c => c.status === status);
    
    const csvContent = [
      ['Phone', 'Name', 'Status', 'Attempts', 'Last Error', 'Variables'].join(','),
      ...contactsToExport.map(contact => [
        contact.phone,
        contact.name,
        contact.status,
        contact.attempts,
        contact.lastError || '',
        JSON.stringify(contact.vars)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-${campaignId}-contacts-${status}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const canStart = () => campaign && ['Draft', 'Scheduled', 'Paused'].includes(campaign.status);
  const canPause = () => campaign && campaign.status === 'Running';
  const canResume = () => campaign && campaign.status === 'Paused';
  const canCancel = () => campaign && ['Scheduled', 'Running', 'Paused'].includes(campaign.status);

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
    <div className="campaign-detail">
      {/* Header */}
      <div className="detail-header">
        <div className="header-nav">
          <button onClick={onNavigate} className="back-btn">
            ← Back to Campaigns
          </button>
        </div>
        
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
          {canStart() && (
            <button onClick={() => handleCampaignAction('start')} className="action-btn primary">
              ▶️ Start
            </button>
          )}
          {canPause() && (
            <button onClick={() => handleCampaignAction('pause')} className="action-btn warning">
              ⏸️ Pause
            </button>
          )}
          {canResume() && (
            <button onClick={() => handleCampaignAction('resume')} className="action-btn success">
              ▶️ Resume
            </button>
          )}
          
          <div className="action-dropdown">
            <button className="action-btn secondary dropdown-toggle">More ⋯</button>
            <div className="dropdown-menu">
              <button onClick={() => handleCampaignAction('duplicate')} className="dropdown-item">
                📋 Duplicate
              </button>
              {canCancel() && (
                <button onClick={() => handleCampaignAction('cancel')} className="dropdown-item danger">
                  🛑 Cancel
                </button>
              )}
              <div className="dropdown-divider"></div>
              <button onClick={() => handleCampaignAction('delete')} className="dropdown-item danger">
                🗑️ Delete
              </button>
            </div>
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
          {['overview', 'contacts', 'logs', 'settings'].map(tab => (
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
                    <div className="detail-item">
                      <label>Throttle</label>
                      <span>{campaign.meta?.throttle || 'safe'}</span>
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

                <div className="overview-card">
                  <h3>Schedules</h3>
                  <div className="schedules-list">
                    {campaign.schedules && campaign.schedules.length > 0 ? (
                      campaign.schedules.map((schedule, idx) => (
                        <div key={schedule.id || idx} className="schedule-item">
                          <span className="schedule-type">{schedule.type}</span>
                          <span className="schedule-time">{formatDate(schedule.timestamp)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="no-schedules">No schedules configured</div>
                    )}
                  </div>
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
                
                <div className="contacts-actions">
                  <button onClick={() => exportContacts('all')} className="btn-secondary">
                    📥 Export All
                  </button>
                  <button onClick={() => exportContacts('failed')} className="btn-secondary">
                    📥 Export Failed
                  </button>
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
                      <th>Last Error</th>
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
                        <td className="error-cell">
                          {contact.lastError && (
                            <span title={contact.lastError}>
                              {contact.lastError.substring(0, 50)}...
                            </span>
                          )}
                        </td>
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

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="tab-panel settings">
              <div className="settings-section">
                <h3>Campaign Settings</h3>
                <div className="settings-grid">
                  <div className="setting-item">
                    <label>Campaign ID</label>
                    <input type="text" value={campaign.campaignId} readOnly className="readonly-input" />
                  </div>
                  <div className="setting-item">
                    <label>Created At</label>
                    <input type="text" value={formatDate(campaign.createdAt)} readOnly className="readonly-input" />
                  </div>
                  <div className="setting-item">
                    <label>Updated At</label>
                    <input type="text" value={formatDate(campaign.updatedAt)} readOnly className="readonly-input" />
                  </div>
                  <div className="setting-item">
                    <label>Draft Reference</label>
                    <input type="text" value={campaign.draftRef || 'N/A'} readOnly className="readonly-input" />
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3>Danger Zone</h3>
                <div className="danger-actions">
                  <button onClick={() => handleCampaignAction('duplicate')} className="btn-secondary">
                    📋 Duplicate Campaign
                  </button>
                  {canCancel() && (
                    <button onClick={() => handleCampaignAction('cancel')} className="btn-warning">
                      🛑 Cancel Campaign
                    </button>
                  )}
                  <button onClick={() => handleCampaignAction('delete')} className="btn-danger">
                    🗑️ Delete Campaign
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignDetail;