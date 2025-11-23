import React, { useState, useEffect } from 'react';
import campaignService from './campaignService.js';

/**
 * Step 3: Advanced Message Studio
 * Features: Message editor, placeholder insertion, emoji picker, attachments, 
 * template save/load, preview, character counter, test send, schedule manager
 */
const Step3_Message = ({ draftId, draftData, onDataChange, onNext, onBack, isFirst, isLast }) => {
  const [messageText, setMessageText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [availableVariables, setAvailableVariables] = useState([]);
  const [previewContacts, setPreviewContacts] = useState([]);
  const [characterCount, setCharacterCount] = useState(0);
  const [messageSegments, setMessageSegments] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [templates, setTemplates] = useState([]);

  // Load existing message and schedule data
  useEffect(() => {
    if (draftId) {
      loadExistingData();
    }
  }, [draftId]);

  // Update character count and segments when message changes
  useEffect(() => {
    setCharacterCount(messageText.length);
    // SMS segments: 160 chars for single, 153 for multi-part
    const segmentSize = messageText.length <= 160 ? 160 : 153;
    setMessageSegments(Math.ceil(messageText.length / segmentSize) || 1);
  }, [messageText]);

  const loadExistingData = () => {
    try {
      const draft = campaignService.getDraft(draftId);
      if (draft) {
        // Load message data
        if (draft.message) {
          setMessageText(draft.message.text || '');
          setAttachments(draft.message.attachments || []);
        }
        
        // Load schedules
        if (draft.schedules) {
          setSchedules(draft.schedules);
        }

        // Extract available variables from contacts
        if (draft.contacts && draft.contacts.rows) {
          const variables = new Set(['name']); // Always include name
          draft.contacts.rows.forEach(contact => {
            if (contact.vars) {
              Object.keys(contact.vars).forEach(key => variables.add(key));
            }
          });
          setAvailableVariables(Array.from(variables));
          
          // Set preview contacts (first 3)
          setPreviewContacts(draft.contacts.rows.slice(0, 3));
        }
      }
    } catch (error) {
      console.error('Failed to load message data:', error);
    }
  };

  const insertPlaceholder = (variable) => {
    const placeholder = `{${variable}}`;
    const textarea = document.getElementById('message-textarea');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const newText = messageText.substring(0, start) + placeholder + messageText.substring(end);
    setMessageText(newText);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
    
    setShowPlaceholders(false);
  };

  const insertEmoji = (emoji) => {
    const textarea = document.getElementById('message-textarea');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const newText = messageText.substring(0, start) + emoji + messageText.substring(end);
    setMessageText(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
    
    setShowEmojiPicker(false);
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    
    files.forEach(file => {
      // TODO: Implement proper file handling - store metadata only, not blobs
      const attachment = {
        id: 'att-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        type: file.type.startsWith('image/') ? 'image' : 'document',
        name: file.name,
        size: file.size,
        meta: {
          lastModified: file.lastModified,
          // TODO: Generate object URL for preview (temporary)
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
        }
      };
      
      setAttachments(prev => [...prev, attachment]);
    });
  };

  const removeAttachment = (attachmentId) => {
    setAttachments(prev => {
      const updated = prev.filter(att => att.id !== attachmentId);
      // TODO: Revoke object URLs to prevent memory leaks
      const removed = prev.find(att => att.id === attachmentId);
      if (removed && removed.meta.previewUrl) {
        URL.revokeObjectURL(removed.meta.previewUrl);
      }
      return updated;
    });
  };

  const addSchedule = () => {
    const newSchedule = {
      id: 'schedule-' + Date.now(),
      type: 'one-time',
      timestamp: Date.now() + 3600000, // 1 hour from now
      description: 'New send time'
    };
    
    setSchedules(prev => [...prev, newSchedule]);
  };

  const updateSchedule = (scheduleId, field, value) => {
    setSchedules(prev => 
      prev.map(schedule => 
        schedule.id === scheduleId 
          ? { ...schedule, [field]: value }
          : schedule
      )
    );
  };

  const removeSchedule = (scheduleId) => {
    setSchedules(prev => prev.filter(schedule => schedule.id !== scheduleId));
  };

  const previewMessage = (contact) => {
    let preview = messageText;
    
    // Replace placeholders with actual values
    if (contact.vars) {
      Object.entries(contact.vars).forEach(([key, value]) => {
        const placeholder = `{${key}}`;
        preview = preview.replace(new RegExp(placeholder, 'g'), value || `{${key}}`);
      });
    }
    
    return preview;
  };

  const handleTestSend = async () => {
    // TODO: Implement test send functionality
    // Should respect dryRun setting and send to configured test number
    console.log('TODO: Implement test send');
    setError('Test send functionality coming soon');
  };

  const saveAsTemplate = () => {
    // TODO: Implement template saving
    const template = {
      id: 'template-' + Date.now(),
      name: `Template ${new Date().toLocaleDateString()}`,
      message: {
        text: messageText,
        attachments: attachments.map(att => ({ ...att, meta: { ...att.meta, previewUrl: null } })) // Remove URLs
      },
      createdAt: Date.now()
    };
    
    setTemplates(prev => [...prev, template]);
    console.log('Template saved:', template);
  };

  const loadTemplate = (template) => {
    setMessageText(template.message.text);
    setAttachments(template.message.attachments || []);
    setShowTemplates(false);
  };

  const validateSchedulesInCampaignWindow = () => {
    if (!draftData || !draftData.meta) return true;
    
    const { startAt, endAt } = draftData.meta;
    if (!startAt) return true;

    const errors = [];
    schedules.forEach(schedule => {
      if (schedule.timestamp < startAt) {
        errors.push(`Schedule "${schedule.description}" is before campaign start time`);
      }
      if (endAt && schedule.timestamp > endAt) {
        errors.push(`Schedule "${schedule.description}" is after campaign end time`);
      }
    });

    if (errors.length > 0) {
      setError(errors.join('. '));
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    if (!messageText.trim()) {
      setError('Please enter a message');
      return;
    }

    if (schedules.length === 0) {
      setError('Please add at least one schedule');
      return;
    }

    if (!validateSchedulesInCampaignWindow()) {
      return;
    }

    setLoading(true);
    try {
      const messageData = {
        text: messageText,
        templateHash: 'hash-' + Date.now(), // TODO: Generate proper hash
        attachments: attachments.map(att => ({ ...att, meta: { ...att.meta, previewUrl: null } })) // Remove URLs for storage
      };

      const result = campaignService.saveDraft(draftId, {
        message: messageData,
        schedules: schedules
      });
      
      if (result.success) {
        onDataChange({ message: messageData, schedules });
        onNext();
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to save message and schedules');
      console.error('Save message error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Common emojis for quick access
  const commonEmojis = ['😊', '👋', '🎉', '💪', '🔥', '💝', '🌟', '👍', '❤️', '😍'];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Message Studio</h2>
        <p className="text-gray-600">Compose your campaign message with placeholders, emojis, and attachments.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message Editor - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Message Text Area */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Message Text *
              </label>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>{characterCount} characters</span>
                <span className={messageSegments > 1 ? 'text-orange-600' : ''}>
                  {messageSegments} segment{messageSegments > 1 ? 's' : ''}
                </span>
              </div>
            </div>
            
            <div className="relative">
              <textarea
                id="message-textarea"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message here... Use {name}, {city} etc. for personalization"
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              
              {/* Toolbar */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowPlaceholders(!showPlaceholders)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    {'{}'} Placeholders
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                  >
                    😊 Emojis
                  </button>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    📝 Templates
                  </button>
                  <button
                    type="button"
                    onClick={saveAsTemplate}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    💾 Save Template
                  </button>
                </div>
              </div>

              {/* Placeholder Dropdown */}
              {showPlaceholders && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <div className="p-2">
                    <div className="text-xs font-medium text-gray-500 mb-2">Available Variables:</div>
                    {availableVariables.length > 0 ? (
                      <div className="space-y-1">
                        {availableVariables.map(variable => (
                          <button
                            key={variable}
                            onClick={() => insertPlaceholder(variable)}
                            className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded"
                          >
                            {'{' + variable + '}'}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Add contacts first to see available variables</div>
                    )}
                  </div>
                </div>
              )}

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <div className="p-3">
                    <div className="text-xs font-medium text-gray-500 mb-2">Common Emojis:</div>
                    <div className="grid grid-cols-10 gap-1">
                      {commonEmojis.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => insertEmoji(emoji)}
                          className="w-8 h-8 text-lg hover:bg-gray-100 rounded"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      TODO: Add full emoji picker component
                    </div>
                  </div>
                </div>
              )}

              {/* Template Dropdown */}
              {showTemplates && (
                <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <div className="p-2">
                    <div className="text-xs font-medium text-gray-500 mb-2">Saved Templates:</div>
                    {templates.length > 0 ? (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {templates.map(template => (
                          <button
                            key={template.id}
                            onClick={() => loadTemplate(template)}
                            className="w-full text-left px-2 py-2 text-sm hover:bg-gray-100 rounded"
                          >
                            <div className="font-medium">{template.name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {template.message.text.substring(0, 50)}...
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No saved templates</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {messageSegments > 3 && (
              <div className="mt-2 text-sm text-orange-600">
                ⚠️ Long messages may be expensive and have delivery issues
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attachments
            </label>
            <div className="space-y-2">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="attachment-upload"
                accept="image/*,.pdf,.doc,.docx"
              />
              <label
                htmlFor="attachment-upload"
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 cursor-pointer"
              >
                📎 Add Attachments
              </label>
              
              {attachments.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {attachments.map(attachment => (
                    <div key={attachment.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                      {attachment.meta.previewUrl ? (
                        <img src={attachment.meta.previewUrl} alt="" className="w-8 h-8 object-cover rounded" />
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-xs">
                          📄
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{attachment.name}</div>
                        <div className="text-xs text-gray-500">{(attachment.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <button
                        onClick={() => removeAttachment(attachment.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Schedule Manager */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Send Schedule *
              </label>
              <button
                onClick={addSchedule}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + Add Schedule
              </button>
            </div>

            <div className="space-y-2">
              {schedules.map(schedule => (
                <div key={schedule.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
                  <select
                    value={schedule.type}
                    onChange={(e) => updateSchedule(schedule.id, 'type', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="one-time">One-time</option>
                    <option value="recurring">Recurring (TODO)</option>
                  </select>
                  
                  <input
                    type="datetime-local"
                    value={new Date(schedule.timestamp).toISOString().slice(0, 16)}
                    onChange={(e) => updateSchedule(schedule.id, 'timestamp', new Date(e.target.value).getTime())}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  
                  <input
                    type="text"
                    value={schedule.description}
                    onChange={(e) => updateSchedule(schedule.id, 'description', e.target.value)}
                    placeholder="Description"
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  
                  <button
                    onClick={() => removeSchedule(schedule.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
              
              {schedules.length === 0 && (
                <div className="text-sm text-gray-500 italic">
                  No schedules added. Click "Add Schedule" to create one.
                </div>
              )}
            </div>
          </div>

          {/* Test Send */}
          <div className="pt-4 border-t">
            <button
              onClick={handleTestSend}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              📤 Send Test Message
            </button>
            <p className="text-xs text-gray-500 mt-1">
              Sends a test message (respects dry-run setting)
            </p>
          </div>
        </div>

        {/* Preview Panel - Right Column */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Message Preview</h3>
            
            {previewContacts.length > 0 ? (
              <div className="space-y-4">
                {previewContacts.map((contact, index) => (
                  <div key={contact.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      {contact.vars.name || `Contact ${index + 1}`}
                    </div>
                    <div className="bg-white p-3 rounded border">
                      <div className="text-sm whitespace-pre-wrap">
                        {previewMessage(contact)}
                      </div>
                      {attachments.length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="text-xs text-gray-500">
                            📎 {attachments.length} attachment{attachments.length > 1 ? 's' : ''}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">
                Add contacts in the previous step to see message preview
              </div>
            )}
          </div>

          {/* Schedule Timeline */}
          {schedules.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule Timeline</h3>
              <div className="space-y-2">
                {schedules
                  .sort((a, b) => a.timestamp - b.timestamp)
                  .map(schedule => (
                    <div key={schedule.id} className="p-2 bg-blue-50 rounded text-sm">
                      <div className="font-medium">
                        {new Date(schedule.timestamp).toLocaleString()}
                      </div>
                      <div className="text-gray-600">{schedule.description}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Step Actions */}
      <div className="mt-8 pt-6 border-t">
        <div className="flex justify-between">
          <div>
            <button
              onClick={onBack}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              ← Back
            </button>
          </div>
          <div>
            <button
              onClick={handleNext}
              disabled={loading || !messageText.trim() || schedules.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Saving...' : 'Next: Review & Publish →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step3_Message;