import React, { useState, useEffect, useRef } from 'react';
import campaignService from './campaignService.js';
import './Step3_Message.css';

/**
 * Phone number normalization (E.164 format)
 */
const normalizePhone = (phone) => {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 0) return null;
  
  // Handle different formats
  let normalized = digits;
  
  // If starts with country code, keep as is
  if (digits.length >= 10) {
    // If it's 10 digits, assume it needs country code (default to +1 for US)
    if (digits.length === 10) {
      normalized = '1' + digits;
    }
    // Add + prefix
    normalized = '+' + normalized;
  } else {
    return null; // Too short to be valid
  }
  
  return normalized;
};

/**
 * Emoji data for picker
 */
const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎'],
  'Gestures': ['👍', '👎', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
  'Objects': ['📱', '💻', '🖥️', '⌨️', '🖱️', '🖲️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '⏰', '⏲️', '⏱️', '⏳'],
  'Symbols': ['❤️', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️']
};

/**
 * Message templates for save/load functionality
 */
const DEFAULT_TEMPLATES = [
  {
    id: 'welcome',
    name: 'Welcome Message',
    text: 'Hello {name}! Welcome to our service. We\'re excited to have you on board! 😊',
    category: 'Onboarding'
  },
  {
    id: 'promotion',
    name: 'Promotional Offer',
    text: 'Hi {name}! 🎉 Special offer just for you! Get 20% off your next purchase. Use code: SAVE20',
    category: 'Marketing'
  },
  {
    id: 'reminder',
    name: 'Appointment Reminder',
    text: 'Hi {name}, this is a reminder about your appointment scheduled for tomorrow at {time}. See you soon! 📅',
    category: 'Reminders'
  }
];

/**
 * Utility functions
 */
const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

const generateHash = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

const formatDateTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const parseDateTime = (dateTimeString) => {
  if (!dateTimeString) return null;
  const date = new Date(dateTimeString);
  return isNaN(date.getTime()) ? null : date.getTime();
};

/**
 * Step 3: Advanced Message Studio
 * Message composition, placeholders, emoji picker, attachments, templates, preview, scheduling
 */
const Step3_Message = ({ draftId, draftData, contactsData, onBack, onNext, initialData = {} }) => {
  console.log('Step3_Message props:', { draftId, draftData, contactsData: !!contactsData });
  console.log('Draft details structure:', draftData?.details);
  
  // Core message state
  const [messageText, setMessageText] = useState(initialData.message || '');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef(null);
  
  // UI state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('Smileys');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  
  // Attachments state
  const [attachments, setAttachments] = useState(initialData.attachments || []);
  
  // Templates state
  const [savedTemplates, setSavedTemplates] = useState(DEFAULT_TEMPLATES);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('Custom');
  
  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(initialData.scheduleEnabled || false);
  const [scheduleDateTime, setScheduleDateTime] = useState(initialData.scheduleDateTime || '');
  const [scheduleErrors, setScheduleErrors] = useState([]);
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewContacts, setPreviewContacts] = useState([]);
  
  // Test send state
  const [testSendNumber, setTestSendNumber] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Calculate character count and SMS segments
  const characterCount = messageText.length;
  const smsSegments = Math.ceil(characterCount / 160) || 1;
  const showCharacterWarning = characterCount > 160;

  // Save draft whenever data changes
  useEffect(() => {
    if (!draftId || !messageText) return;
    
    const messageData = {
      message: {
        text: messageText,
        attachments,
        scheduleEnabled,
        scheduleDateTime,
        lastModified: Date.now()
      }
    };
    
    const debouncedSave = setTimeout(() => {
      try {
        campaignService.saveDraft(draftId, messageData);
      } catch (error) {
        console.error('Error saving draft:', error);
      }
    }, 500);

    return () => clearTimeout(debouncedSave);
  }, [draftId, messageText, attachments, scheduleEnabled, scheduleDateTime]);

  // Generate preview contacts when contacts data changes
  useEffect(() => {
    if (contactsData?.contacts?.rows && Array.isArray(contactsData.contacts.rows)) {
      // Get contacts from Step 2 data structure
      const validContacts = contactsData.contacts.rows.filter(contact => contact?.isValid);
      const samples = validContacts.slice(0, 3).map(contact => ({
        ...contact,
        previewText: mergePlaceholders(messageText, contact)
      }));
      setPreviewContacts(samples);
    } else if (contactsData?.rows && Array.isArray(contactsData.rows)) {
      // Alternative structure: direct rows array
      const validContacts = contactsData.rows.filter(contact => contact?.isValid);
      const samples = validContacts.slice(0, 3).map(contact => ({
        ...contact,
        previewText: mergePlaceholders(messageText, contact)
      }));
      setPreviewContacts(samples);
    } else {
      // No contacts data available - set empty array
      setPreviewContacts([]);
    }
  }, [contactsData, messageText]);

  // Track cursor position
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.addEventListener('selectionchange', updateCursorPosition);
      return () => {
        if (textareaRef.current) {
          textareaRef.current.removeEventListener('selectionchange', updateCursorPosition);
        }
      };
    }
  }, []);

  const updateCursorPosition = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  const mergePlaceholders = (text, contact) => {
    if (!text || !contact) return text;
    
    let merged = text;
    
    // Handle direct contact properties
    if (contact.phone) {
      merged = merged.replace(/\{phone\}/gi, contact.phone || '[phone]');
    }
    
    // Handle vars object from Step 2 contacts structure
    if (contact.vars) {
      Object.keys(contact.vars).forEach(key => {
        const placeholder = `{${key}}`;
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        merged = merged.replace(regex, contact.vars[key] || `[${key}]`);
      });
    }
    
    // Handle direct properties as fallback
    Object.keys(contact).forEach(key => {
      if (key !== 'vars' && typeof contact[key] === 'string') {
        const placeholder = `{${key}}`;
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        merged = merged.replace(regex, contact[key] || `[${key}]`);
      }
    });
    
    return merged;
  };

  const insertAtCursor = (textToInsert) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = messageText.substring(0, start) + textToInsert + messageText.substring(end);
      
      setMessageText(newText);
      
      // Restore cursor position after text insertion
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
      }, 0);
    }
  };

  const insertPlaceholder = (placeholder) => {
    insertAtCursor(`{${placeholder}}`);
  };

  const insertEmoji = (emoji) => {
    insertAtCursor(emoji);
    setShowEmojiPicker(false);
  };

  const handleFileAttachment = (event) => {
    const files = Array.from(event.target.files);
    const maxFileSize = 5 * 1024 * 1024; // 5MB limit
    
    const validFiles = files.filter(file => {
      if (file.size > maxFileSize) {
        alert(`File ${file.name} is too large. Maximum size is 5MB.`);
        return false;
      }
      return true;
    });
    
    const fileMetadata = validFiles.map(file => ({
      id: generateId(),
      name: file.name,
      size: file.size,
      type: file.type,
      hash: generateHash(file.name + file.size),
      uploadedAt: Date.now()
    }));
    
    setAttachments(prev => [...prev, ...fileMetadata]);
  };

  const removeAttachment = (id) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const saveAsTemplate = () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }
    
    const newTemplate = {
      id: generateId(),
      name: templateName,
      text: messageText,
      category: templateCategory,
      createdAt: Date.now()
    };
    
    setSavedTemplates(prev => [...prev, newTemplate]);
    setTemplateName('');
    setTemplateCategory('Custom');
    setShowSaveTemplate(false);
    alert('Template saved successfully!');
  };

  const loadTemplate = (template) => {
    setMessageText(template.text);
    setShowTemplatePicker(false);
  };

  const validateSchedule = () => {
    const errors = [];
    
    if (scheduleEnabled && scheduleDateTime) {
      const scheduleTime = parseDateTime(scheduleDateTime);
      const now = Date.now();
      
      if (scheduleTime <= now) {
        errors.push('Schedule time must be in the future');
      }
      
      // Check against campaign window from draftData
      const campaignStartAt = draftData?.meta?.startAt;
      const campaignEndAt = draftData?.meta?.endAt;
      
      if (campaignStartAt && campaignEndAt) {
        // campaignStartAt and campaignEndAt are already timestamps from Step1
        const campaignStart = campaignStartAt;
        const campaignEnd = campaignEndAt;
        
        if (scheduleTime < campaignStart) {
          errors.push(`Schedule time must be after campaign start: ${formatDateTime(new Date(campaignStart))}`);
        }
        
        if (scheduleTime > campaignEnd) {
          errors.push(`Schedule time must be before campaign end: ${formatDateTime(new Date(campaignEnd))}`);
        }
      } else {
        errors.push('Campaign window not configured. Please complete Step 1 first.');
      }
    }
    
    setScheduleErrors(errors);
    return errors.length === 0;
  };

  useEffect(() => {
    if (scheduleEnabled) {
      validateSchedule();
    }
  }, [scheduleDateTime, scheduleEnabled, draftData]);

  const handleTestSend = async () => {
    if (!testSendNumber.trim()) {
      alert('Please enter a phone number for test send');
      return;
    }
    
    if (!messageText.trim()) {
      alert('Please enter a message to send');
      return;
    }

    // Normalize the phone number to E.164 format
    const normalizedPhone = normalizePhone(testSendNumber);
    if (!normalizedPhone) {
      alert('Please enter a valid phone number.\n\nExamples:\n• +1234567890 (with country code)\n• 1234567890 (US number)\n• +919876543210 (India number)');
      return;
    }

    // Get API configuration and instance data from campaign context
    const apiUrl = localStorage.getItem('apiUrl') || 'http://localhost:8080';
    const apiKey = localStorage.getItem('apiKey') || '';
    
    if (!apiUrl || !apiKey) {
      alert('API configuration is required. Please configure API settings first.');
      return;
    }

    // Get instance from contactsData (passed from Step 1)
    const instanceId = contactsData?.instanceId || initialData?.instanceId;
    
    if (!instanceId) {
      alert('WhatsApp instance is required. Please select an instance in Step 1.');
      return;
    }

    setIsSendingTest(true);
    
    try {
      // Create test contact for placeholder replacement using normalized phone
      const testContact = { 
        name: 'Test User', 
        phone: normalizedPhone,
        vars: { name: 'Test User', phone: normalizedPhone } 
      };
      const mergedMessage = mergePlaceholders(messageText, testContact);
      
      // Build headers for API request
      const buildHeaders = () => ({
        "Content-Type": "application/json",
        "apikey": apiKey.trim()
      });
      
      const baseUrl = apiUrl.trim().replace(/\/+$/, '');
      
      console.log('TEST SEND: Sending to URL:', `${baseUrl}/message/sendText/${encodeURIComponent(instanceId)}`, {
        instance: instanceId,
        headers: buildHeaders(),
        number: normalizedPhone,
        text: mergedMessage,
        originalInput: testSendNumber
      });
      
      // Send the actual test message via API using normalized phone number
      const response = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instanceId)}`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          number: normalizedPhone,
          text: mergedMessage
        })
      });
      
      console.log('TEST SEND: Response:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (response.ok) {
        const responseData = await response.json().catch(() => ({}));
        alert(`✅ Test message sent successfully!\n\nTo: ${normalizedPhone} (normalized from ${testSendNumber})\nMessage: "${mergedMessage}"\n\nResponse: ${response.status} ${response.statusText}`);
      } else {
        let errorMessage = `Failed to send test message (${response.status} ${response.statusText})`;
        
        if (response.status === 400) {
          errorMessage += '\\n\\nThis usually means invalid phone number format or missing instance.';
        } else if (response.status === 401 || response.status === 403) {
          errorMessage += '\\n\\nAuthentication failed. Please check your API key.';
        } else if (response.status === 404) {
          errorMessage += '\\n\\nInstance not found. Please check the selected WhatsApp instance.';
        }
        
        alert(`❌ ${errorMessage}`);
      }
    } catch (error) {
      console.error('Test send error:', error);
      alert(`❌ Test send failed: ${error.message}\\n\\nPlease check:\\n• API URL and key are correct\\n• WhatsApp instance is connected\\n• Phone number format is valid`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleNext = async () => {
    if (!messageText.trim()) {
      alert('Please enter a message');
      return;
    }
    
    if (scheduleEnabled && !validateSchedule()) {
      alert('Please fix schedule errors before proceeding');
      return;
    }
    
    // Save message data to draft before proceeding
    const messageData = {
      message: {
        text: messageText,
        attachments,
        scheduleEnabled,
        scheduleDateTime,
        characterCount,
        smsSegments,
        templates: savedTemplates.filter(t => t.category === 'Custom')
      }
    };
    
    if (!draftId) {
      alert('Draft ID is not available. Please try refreshing the page.');
      return;
    }
    
    try {
      const result = await campaignService.saveDraft(draftId, messageData);
      if (result.success) {
        onNext(messageData);
      } else {
        alert('Failed to save message data: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving message:', error);
      alert('Error saving message: ' + error.message);
    }
  };

  return (
    <div className="step3-container">
      <div className="step-header">
        <h2>Step 3: Advanced Message Studio</h2>
        <p>Compose your message with advanced features</p>
      </div>

      <div className="message-studio">
        {/* Message Editor with Toolbar */}
        <div className="message-editor-section">
          <div className="editor-toolbar">
            <button 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="toolbar-btn"
              title="Insert Emoji"
            >
              😀 Emoji
            </button>
            <button 
              onClick={() => setShowTemplatePicker(!showTemplatePicker)}
              className="toolbar-btn"
              title="Load Template"
            >
              📋 Templates
            </button>
            <button 
              onClick={() => setShowSaveTemplate(!showSaveTemplate)}
              className="toolbar-btn"
              title="Save as Template"
            >
              💾 Save Template
            </button>
          </div>
          
          <textarea
            ref={textareaRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onSelect={updateCursorPosition}
            onKeyUp={updateCursorPosition}
            onClick={updateCursorPosition}
            placeholder="Type your message here... Use {name}, {phone}, {email} as placeholders"
            className="message-textarea"
            rows={8}
          />
          
          <div className={`character-count ${showCharacterWarning ? 'warning' : ''}`}>
            <span>Characters: {characterCount}</span>
            <span>SMS Segments: {smsSegments}</span>
            {showCharacterWarning && (
              <span className="warning-text">⚠️ Message will be sent as {smsSegments} SMS parts</span>
            )}
          </div>
        </div>

        {/* Placeholder Panel */}
        <div className="placeholders-panel">
          <h3>Insert Placeholders</h3>
          <div className="placeholder-grid">
            {(() => {
              // Extract available headers/variables from contacts data
              const availableHeaders = new Set(['phone']); // Always include phone
              
              if (contactsData?.contacts?.rows?.length > 0) {
                // Get from vars object of first valid contact
                const firstContact = contactsData.contacts.rows.find(c => c.isValid);
                if (firstContact?.vars) {
                  Object.keys(firstContact.vars).forEach(key => availableHeaders.add(key));
                }
              }
              
              const headers = Array.from(availableHeaders);
              
              if (headers.length > 1) {
                return headers.map(header => (
                  <button 
                    key={header}
                    onClick={() => insertPlaceholder(header)}
                    className="placeholder-btn"
                  >
                    {`{${header}}`}
                  </button>
                ));
              } else {
                // Fallback to default placeholders
                return (
                  <>
                    <button onClick={() => insertPlaceholder('name')} className="placeholder-btn">{'{name}'}</button>
                    <button onClick={() => insertPlaceholder('phone')} className="placeholder-btn">{'{phone}'}</button>
                    <button onClick={() => insertPlaceholder('email')} className="placeholder-btn">{'{email}'}</button>
                  </>
                );
              }
            })()}
          </div>
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="emoji-picker">
            <div className="emoji-categories">
              {Object.keys(EMOJI_CATEGORIES).map(category => (
                <button
                  key={category}
                  onClick={() => setActiveEmojiCategory(category)}
                  className={`emoji-category ${activeEmojiCategory === category ? 'active' : ''}`}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="emoji-grid">
              {EMOJI_CATEGORIES[activeEmojiCategory].map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => insertEmoji(emoji)}
                  className="emoji-btn"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Template Picker */}
        {showTemplatePicker && (
          <div className="template-picker">
            <h3>Load Template</h3>
            <div className="template-list">
              {savedTemplates.map(template => (
                <div key={template.id} className="template-item">
                  <div className="template-info">
                    <strong>{template.name}</strong>
                    <span className="template-category">{template.category}</span>
                    <p className="template-preview">{template.text.substring(0, 100)}...</p>
                  </div>
                  <button onClick={() => loadTemplate(template)} className="load-template-btn">
                    Load
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save Template Modal */}
        {showSaveTemplate && (
          <div className="save-template-modal">
            <h3>Save as Template</h3>
            <input
              type="text"
              placeholder="Template name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="template-name-input"
            />
            <select
              value={templateCategory}
              onChange={(e) => setTemplateCategory(e.target.value)}
              className="template-category-select"
            >
              <option value="Custom">Custom</option>
              <option value="Onboarding">Onboarding</option>
              <option value="Marketing">Marketing</option>
              <option value="Reminders">Reminders</option>
              <option value="Support">Support</option>
            </select>
            <div className="template-actions">
              <button onClick={saveAsTemplate} className="save-btn">Save</button>
              <button onClick={() => setShowSaveTemplate(false)} className="cancel-btn">Cancel</button>
            </div>
          </div>
        )}

        {/* Attachments Manager */}
        <div className="attachments-section">
          <h3>Attachments</h3>
          <input
            type="file"
            multiple
            onChange={handleFileAttachment}
            className="file-input"
            accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
          />
          <div className="attachment-list">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="attachment-item">
                <div className="attachment-info">
                  <span className="attachment-name">{attachment.name}</span>
                  <span className="attachment-size">{(attachment.size / 1024).toFixed(1)} KB</span>
                  <span className="attachment-type">{attachment.type}</span>
                </div>
                <button onClick={() => removeAttachment(attachment.id)} className="remove-attachment-btn">
                  ❌
                </button>
              </div>
            ))}
          </div>
          {attachments.length > 0 && (
            <div className="attachment-note">
              💡 Attachments are stored as metadata. Actual file upload occurs during campaign execution.
            </div>
          )}
        </div>

        {/* Schedule Manager */}
        <div className="schedule-section">
          <h3>Schedule Manager</h3>
          
          {/* Campaign Window Info */}
          <div className="campaign-window-info">
            <div className="info-header">📅 Campaign Window (from Step 1):</div>
            <div className="info-content">
              {draftData?.meta?.startAt ? 
                `${formatDateTime(new Date(draftData.meta.startAt))} to ${formatDateTime(new Date(draftData.meta.endAt))}` :
                'Not configured'
              }
            </div>
          </div>

          <label className="schedule-checkbox">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
            />
            Schedule specific send time (within campaign window)
          </label>
          
          {scheduleEnabled && (
            <div className="schedule-controls">
              <div className="schedule-input-label">
                📤 Message Send Time:
              </div>
              <input
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                className="datetime-input"
                min={(() => {
                  const startAt = draftData?.meta?.startAt;
                  if (!startAt) return undefined;
                  const startDate = new Date(startAt).toISOString();
                  return startDate.split('T')[0] + 'T' + startDate.split('T')[1].substring(0, 5);
                })()}
                max={(() => {
                  const endAt = draftData?.meta?.endAt;
                  if (!endAt) return undefined;
                  const endDate = new Date(endAt).toISOString();
                  return endDate.split('T')[0] + 'T' + endDate.split('T')[1].substring(0, 5);
                })()}
              />
              {scheduleErrors.length > 0 && (
                <div className="schedule-errors">
                  {scheduleErrors.map((error, idx) => (
                    <div key={idx} className="error-message">❌ {error}</div>
                  ))}
                </div>
              )}
              {scheduleDateTime && scheduleErrors.length === 0 && (
                <div className="schedule-info">
                  ✅ Messages will send: {formatDateTime(parseDateTime(scheduleDateTime))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview Section */}
        <div className="preview-section">
          <button 
            onClick={() => setShowPreview(!showPreview)}
            className="preview-toggle-btn"
          >
            {showPreview ? 'Hide Preview' : 'Show Message Preview'}
          </button>
          
          {showPreview && (
            <div className="preview-content">
              <h3>Message Preview (Sample Contacts)</h3>
              {previewContacts.length > 0 ? (
                previewContacts.map((contact, idx) => (
                  <div key={idx} className="preview-item">
                    <div className="preview-header">
                      <strong>To: {contact.vars?.name || contact.name || 'Contact'}</strong>
                      <span className="preview-phone">{contact.phone}</span>
                    </div>
                    <div className="preview-message">{contact.previewText}</div>
                    <div className="preview-stats">
                      Characters: {contact.previewText.length} | 
                      SMS Parts: {Math.ceil(contact.previewText.length / 160) || 1}
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-preview">No contacts available for preview</div>
              )}
            </div>
          )}
        </div>

        {/* Test Send */}
        <div className="test-send-section">
          <h3>Test Send</h3>
          <div className="test-send-controls">
            <input
              type="tel"
              placeholder="Enter phone number (e.g., +1234567890)"
              value={testSendNumber}
              onChange={(e) => setTestSendNumber(e.target.value)}
              className="test-phone-input"
            />
            <button 
              onClick={handleTestSend}
              disabled={isSendingTest || !messageText.trim()}
              className="test-send-btn"
            >
              {isSendingTest ? 'Sending...' : '📤 Send Test'}
            </button>
          </div>
          <div className="test-send-note">
            💡 Test sends respect dry run mode and won't actually deliver messages
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="step-navigation">
        <button onClick={onBack} className="nav-btn secondary">
          ← Back to Contacts
        </button>
        <button 
          onClick={handleNext} 
          className="nav-btn primary"
          disabled={!messageText.trim() || (scheduleEnabled && scheduleErrors.length > 0)}
        >
          Next: Review & Launch →
        </button>
      </div>
    </div>
  );
};

export default Step3_Message;