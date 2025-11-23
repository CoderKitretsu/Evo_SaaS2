import React, { useState, useEffect } from 'react';
import campaignService from './campaignService.js';
import CampaignCard from './CampaignCard.jsx';
import CampaignBuilder from './CampaignBuilder.jsx';
import './CampaignsPage.css';

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
          alert('Campaign Detail view coming soon!');
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
                  onClick={() => handleCampaignAction('view', selectedCampaign.campaignId)}
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