import React from 'react';
import './CampaignCard.css';

/**
 * CampaignCard - Individual campaign card component
 * Shows campaign summary with quick actions
 */
const CampaignCard = ({ campaign, isSelected, onSelect, onAction }) => {
  
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Not set';
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateShort = (timestamp) => {
    if (!timestamp) return 'Not set';
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return date.getTime() > now.getTime() ? 'Tomorrow' : 'Yesterday';
    } else if (diffDays <= 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
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
    const { sent = 0, pending = 0, failed = 0 } = campaign.progress || {};
    const total = sent + pending + failed;
    return total > 0 ? Math.round((sent / total) * 100) : 0;
  };

  const canStart = () => {
    return ['Draft', 'Scheduled', 'Paused'].includes(campaign.status);
  };

  const canPause = () => {
    return campaign.status === 'Running';
  };

  const canResume = () => {
    return campaign.status === 'Paused';
  };

  const canCancel = () => {
    return ['Scheduled', 'Running', 'Paused'].includes(campaign.status);
  };

  const getInstanceName = () => {
    try {
      const instances = JSON.parse(localStorage.getItem('whatsappInstances') || '[]');
      const instance = instances.find(inst => inst.id === campaign.meta?.instanceId);
      return instance ? instance.name : campaign.meta?.instanceId || 'Unknown';
    } catch {
      return campaign.meta?.instanceId || 'Unknown';
    }
  };

  const handleActionClick = (e, action) => {
    e.stopPropagation();
    onAction(action, campaign.campaignId);
  };

  return (
    <div 
      className={`campaign-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="card-header">
        <div className="card-title-section">
          <h3 className="card-title">{campaign.meta?.name || 'Untitled Campaign'}</h3>
          <div 
            className="status-pill"
            style={{ backgroundColor: getStatusColor(campaign.status) }}
          >
            {campaign.status}
          </div>
        </div>
        
        <div className="card-meta">
          <span className="instance-name">📱 {getInstanceName()}</span>
          <span className="created-date">Created {formatDateShort(campaign.createdAt)}</span>
        </div>
      </div>

      {/* Description */}
      {campaign.meta?.description && (
        <div className="card-description">
          {campaign.meta.description}
        </div>
      )}

      {/* Schedule Info */}
      <div className="card-schedule">
        <div className="schedule-item">
          <span className="schedule-label">Start:</span>
          <span className="schedule-value">{formatDate(campaign.meta?.startAt)}</span>
        </div>
        {campaign.meta?.endAt && (
          <div className="schedule-item">
            <span className="schedule-label">End:</span>
            <span className="schedule-value">{formatDate(campaign.meta?.endAt)}</span>
          </div>
        )}
      </div>

      {/* Progress Summary */}
      <div className="card-progress">
        <div className="progress-header">
          <span className="progress-label">Progress</span>
          <span className="progress-percentage">{getProgressPercentage()}%</span>
        </div>
        
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
        
        <div className="progress-stats">
          <div className="stat-item sent">
            <span className="stat-dot sent"></span>
            <span className="stat-text">{campaign.progress?.sent || 0} sent</span>
          </div>
          <div className="stat-item pending">
            <span className="stat-dot pending"></span>
            <span className="stat-text">{campaign.progress?.pending || 0} pending</span>
          </div>
          <div className="stat-item failed">
            <span className="stat-dot failed"></span>
            <span className="stat-text">{campaign.progress?.failed || 0} failed</span>
          </div>
        </div>
      </div>

      {/* Contact Count */}
      <div className="card-contacts">
        <span className="contacts-icon">👥</span>
        <span className="contacts-text">
          {campaign.contacts?.valid || 0} contacts
          {campaign.meta?.dryRun && <span className="dry-run-badge">DRY RUN</span>}
        </span>
      </div>

      {/* Quick Actions */}
      <div className="card-actions">
        <div className="primary-actions">
          {canStart() && (
            <button
              onClick={(e) => handleActionClick(e, 'start')}
              className="action-btn primary"
              title="Start Campaign"
            >
              ▶️ Start
            </button>
          )}
          
          {canPause() && (
            <button
              onClick={(e) => handleActionClick(e, 'pause')}
              className="action-btn warning"
              title="Pause Campaign"
            >
              ⏸️ Pause
            </button>
          )}
          
          {canResume() && (
            <button
              onClick={(e) => handleActionClick(e, 'resume')}
              className="action-btn success"
              title="Resume Campaign"
            >
              ▶️ Resume
            </button>
          )}
        </div>

        <div className="secondary-actions">
          <div className="action-dropdown">
            <button className="action-btn secondary dropdown-toggle">
              ⋯
            </button>
            <div className="dropdown-menu">
              <button
                onClick={(e) => handleActionClick(e, 'view')}
                className="dropdown-item"
              >
                👁️ View Details
              </button>
              <button
                onClick={(e) => handleActionClick(e, 'duplicate')}
                className="dropdown-item"
              >
                📋 Duplicate
              </button>
              {canCancel() && (
                <button
                  onClick={(e) => handleActionClick(e, 'cancel')}
                  className="dropdown-item danger"
                >
                  🛑 Cancel
                </button>
              )}
              <div className="dropdown-divider"></div>
              <button
                onClick={(e) => handleActionClick(e, 'delete')}
                className="dropdown-item danger"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Schedules Summary */}
      {campaign.schedules && campaign.schedules.length > 0 && (
        <div className="card-schedules">
          <span className="schedules-label">📅 {campaign.schedules.length} schedule(s)</span>
          <div className="schedules-list">
            {campaign.schedules.slice(0, 2).map((schedule, idx) => (
              <div key={schedule.id || idx} className="schedule-item-mini">
                {formatDate(schedule.timestamp)}
              </div>
            ))}
            {campaign.schedules.length > 2 && (
              <div className="schedule-item-mini more">
                +{campaign.schedules.length - 2} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignCard;