import React, { useState, useEffect } from 'react';
import campaignService from './campaignService.js';

/**
 * Step 2: Contact Management
 * Features: Upload CSV/XLSX, Paste contacts, Manual add, Column mapping, Preview, Deduplication
 */
const Step2_Contacts = ({ draftId, draftData, onDataChange, onNext, onBack, isFirst, isLast }) => {
  const [activeTab, setActiveTab] = useState('upload');
  const [contacts, setContacts] = useState({
    total: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    rows: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [manualContact, setManualContact] = useState({ phone: '', name: '', variables: {} });
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [rawData, setRawData] = useState(null);

  // Load existing contacts from draft
  useEffect(() => {
    if (draftId) {
      loadExistingContacts();
    }
  }, [draftId]);

  const loadExistingContacts = () => {
    try {
      const draft = campaignService.getDraft(draftId);
      if (draft && draft.contacts) {
        setContacts(draft.contacts);
        if (draft.contacts.rows.length > 0) {
          setShowPreview(true);
        }
      }
    } catch (error) {
      console.error('Failed to load existing contacts:', error);
    }
  };

  // TODO: Implement CSV/XLSX parsing helpers
  const parseUploadedFile = (file) => {
    // TODO: Add parseCSV, parseXLSX helper functions
    console.log('TODO: Parse uploaded file:', file.name);
    
    // Placeholder implementation
    const sampleData = [
      ['Name', 'Phone', 'City', 'Email'],
      ['Alice Johnson', '+911234567890', 'Mumbai', 'alice@example.com'],
      ['Bob Smith', '+911234567891', 'Delhi', 'bob@example.com'],
      ['Charlie Brown', '+911234567892', 'Bangalore', 'charlie@example.com']
    ];
    
    setRawData(sampleData);
    setShowColumnMapping(true);
  };

  // TODO: Implement phone normalization helper  
  const normalizePhone = (phone) => {
    // TODO: Add proper E.164 phone normalization
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return '+' + cleaned;
    }
    if (cleaned.length === 10) {
      return '+91' + cleaned;
    }
    return cleaned;
  };

  const validatePhone = (phone) => {
    const normalized = normalizePhone(phone);
    // Basic validation - should be improved
    return normalized.length >= 10 && normalized.includes('+');
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file type
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      setError('Please upload a CSV or Excel file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      parseUploadedFile(file);
    } catch (err) {
      setError('Failed to parse file: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasteContacts = () => {
    if (!pastedText.trim()) {
      setError('Please paste contact data');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // TODO: Parse pasted text (CSV format, tab-separated, etc.)
      const lines = pastedText.trim().split('\n');
      const parsedData = lines.map(line => line.split(/[,\t]/));
      
      setRawData(parsedData);
      setShowColumnMapping(true);
      setPastedText('');
    } catch (err) {
      setError('Failed to parse pasted data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addManualContact = () => {
    if (!manualContact.phone || !validatePhone(manualContact.phone)) {
      setError('Please enter a valid phone number');
      return;
    }

    const normalizedPhone = normalizePhone(manualContact.phone);
    
    // Check for duplicates
    const isDuplicate = contacts.rows.some(row => row.phone === normalizedPhone);
    if (isDuplicate) {
      setError('Phone number already exists');
      return;
    }

    const newContact = {
      id: 'manual-' + Date.now(),
      phone: normalizedPhone,
      vars: {
        name: manualContact.name || 'Unknown',
        ...manualContact.variables
      }
    };

    const updatedContacts = {
      ...contacts,
      total: contacts.total + 1,
      valid: contacts.valid + 1,
      rows: [...contacts.rows, newContact]
    };

    setContacts(updatedContacts);
    setManualContact({ phone: '', name: '', variables: {} });
    setError(null);
    setShowPreview(true);
  };

  const processColumnMapping = (mapping) => {
    if (!rawData || rawData.length < 2) {
      setError('No data to process');
      return;
    }

    setLoading(true);
    
    try {
      const headers = rawData[0];
      const dataRows = rawData.slice(1);
      
      const processedContacts = [];
      let validCount = 0;
      let invalidCount = 0;
      const phonesSeen = new Set();
      
      dataRows.forEach((row, index) => {
        const contactData = {
          id: 'imported-' + Date.now() + '-' + index,
          phone: '',
          vars: {}
        };

        // Map columns according to user selection
        Object.entries(mapping).forEach(([columnIndex, fieldType]) => {
          const cellValue = row[columnIndex]?.trim() || '';
          
          if (fieldType === 'phone') {
            contactData.phone = normalizePhone(cellValue);
          } else if (fieldType !== 'ignore' && cellValue) {
            contactData.vars[fieldType] = cellValue;
          }
        });

        // Validate and deduplicate
        if (validatePhone(contactData.phone)) {
          if (phonesSeen.has(contactData.phone)) {
            invalidCount++; // Count duplicates as invalid for now
          } else {
            phonesSeen.add(contactData.phone);
            processedContacts.push(contactData);
            validCount++;
          }
        } else {
          invalidCount++;
        }
      });

      const updatedContacts = {
        total: processedContacts.length + invalidCount,
        valid: validCount,
        invalid: invalidCount,
        duplicates: dataRows.length - processedContacts.length - invalidCount,
        rows: processedContacts
      };

      setContacts(updatedContacts);
      setShowColumnMapping(false);
      setShowPreview(true);
      setRawData(null);
    } catch (err) {
      setError('Failed to process contacts: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeContact = (contactId) => {
    const updatedRows = contacts.rows.filter(row => row.id !== contactId);
    const updatedContacts = {
      ...contacts,
      total: updatedRows.length,
      valid: updatedRows.length, // Assume all remaining are valid
      rows: updatedRows
    };
    setContacts(updatedContacts);
  };

  const editContact = (contactId, field, value) => {
    const updatedRows = contacts.rows.map(row => {
      if (row.id === contactId) {
        if (field === 'phone') {
          return { ...row, phone: normalizePhone(value) };
        } else {
          return { 
            ...row, 
            vars: { ...row.vars, [field]: value }
          };
        }
      }
      return row;
    });

    setContacts(prev => ({ ...prev, rows: updatedRows }));
  };

  const handleNext = async () => {
    if (contacts.valid === 0) {
      setError('Please add at least one valid contact before proceeding');
      return;
    }

    setLoading(true);
    try {
      // Save contacts to draft
      const result = campaignService.saveDraft(draftId, { contacts });
      
      if (result.success) {
        onDataChange({ contacts });
        onNext();
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to save contacts');
      console.error('Save contacts error:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportCleanedCSV = () => {
    // TODO: Implement CSV export functionality
    console.log('TODO: Export cleaned contacts as CSV');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Add Contacts</h2>
        <p className="text-gray-600">Upload, paste, or manually add contacts for your campaign.</p>
      </div>

      {/* Summary Ribbon */}
      {contacts.total > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex space-x-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{contacts.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{contacts.valid}</div>
                <div className="text-sm text-gray-600">Valid</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{contacts.invalid}</div>
                <div className="text-sm text-gray-600">Invalid</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{contacts.duplicates}</div>
                <div className="text-sm text-gray-600">Duplicates</div>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setContacts({ total: 0, valid: 0, invalid: 0, duplicates: 0, rows: [] })}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear All
              </button>
              <button
                onClick={exportCleanedCSV}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'upload', label: 'Upload File' },
            { id: 'paste', label: 'Paste Data' },
            { id: 'manual', label: 'Add Manually' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="text-gray-400 mb-2">
                  <svg className="mx-auto h-12 w-12" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 3a2 2 0 00-2 2v1.586l8 8 8-8V5a2 2 0 00-2-2H4zM2 7.414V15a2 2 0 002 2h12a2 2 0 002-2V7.414l-8 8-8-8z" />
                  </svg>
                </div>
                <div className="text-lg text-gray-700">Click to upload or drag files here</div>
                <div className="text-sm text-gray-500">Supports CSV, XLSX, XLS files</div>
              </label>
            </div>
            <p className="text-sm text-gray-600">
              Expected format: Phone numbers in E.164 format (+country code), with optional name and custom variables.
            </p>
          </div>
        )}

        {activeTab === 'paste' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste Contact Data
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste CSV data, tab-separated, or one contact per line&#10;Example:&#10;Name,Phone,City&#10;John Doe,+911234567890,Mumbai&#10;Jane Smith,+911234567891,Delhi"
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handlePasteContacts}
              disabled={!pastedText.trim() || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Process Pasted Data'}
            </button>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={manualContact.phone}
                  onChange={(e) => setManualContact(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+911234567890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={manualContact.name}
                  onChange={(e) => setManualContact(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Contact name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={addManualContact}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Add Contact
            </button>
          </div>
        )}
      </div>

      {/* Column Mapping Modal */}
      {showColumnMapping && rawData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Map Columns</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select which column contains which type of data:
            </p>
            
            {/* TODO: Implement column mapping interface */}
            <div className="space-y-2">
              {rawData[0].map((header, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <div className="w-32 text-sm font-medium">{header}</div>
                  <select
                    onChange={(e) => {
                      // TODO: Handle column mapping selection
                      console.log(`Column ${index} mapped to ${e.target.value}`);
                    }}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="ignore">Ignore</option>
                    <option value="phone">Phone</option>
                    <option value="name">Name</option>
                    <option value="email">Email</option>
                    <option value="city">City</option>
                    <option value="custom">Custom Variable</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowColumnMapping(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => processColumnMapping({ 0: 'name', 1: 'phone', 2: 'city' })} // TODO: Use actual mapping
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Import Contacts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Preview */}
      {showPreview && contacts.rows.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Preview</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variables</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contacts.rows.slice(0, 20).map((contact) => (
                    <tr key={contact.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <input
                          type="text"
                          value={contact.phone}
                          onChange={(e) => editContact(contact.id, 'phone', e.target.value)}
                          className="w-full border-0 p-0 focus:ring-0 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <input
                          type="text"
                          value={contact.vars.name || ''}
                          onChange={(e) => editContact(contact.id, 'name', e.target.value)}
                          className="w-full border-0 p-0 focus:ring-0 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {Object.entries(contact.vars || {})
                          .filter(([key]) => key !== 'name')
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(', ')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => removeContact(contact.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {contacts.rows.length > 20 && (
              <div className="bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Showing first 20 contacts. {contacts.rows.length - 20} more contacts not shown.
              </div>
            )}
          </div>
        </div>
      )}

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
              disabled={loading || contacts.valid === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Saving...' : `Next: Message Studio → (${contacts.valid} contacts)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step2_Contacts;