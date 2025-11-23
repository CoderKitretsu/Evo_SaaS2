import React, { useState, useEffect, useRef } from 'react';
import campaignService from './campaignService.js';

/**
 * Pure helper functions for contact processing
 */

// Parse CSV content into rows and columns
const parseCSV = (csvText) => {
  if (!csvText || typeof csvText !== 'string') return [];
  
  const lines = csvText.trim().split('\n');
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parsing - handles quoted fields and commas
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = line[j + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          j++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    
    result.push(fields);
  }
  
  return result;
};

// Parse XLSX content (simplified approach using CSV-like parsing)
const parseXLSX = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        // For now, we'll prompt user to export as CSV
        // In a real implementation, you'd use a library like xlsx or exceljs
        reject(new Error('XLSX parsing requires additional library. Please export your Excel file as CSV format for now.'));
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read XLSX file'));
    reader.readAsArrayBuffer(file);
  });
};

// Normalize phone number to E.164 format
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

// Validate phone number format
const isValidPhone = (phone) => {
  if (!phone) return false;
  const normalized = normalizePhone(phone);
  return normalized && normalized.length >= 10 && normalized.length <= 16;
};

// Generate unique ID
const generateId = () => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

/**
 * Step 2: Contacts Management
 * Upload CSV/XLSX, Paste, Manual Add with column mapping and validation
 */
const Step2_Contacts = ({ draftId, draftData, onDataChange, onNext, onBack, isFirst, isLast }) => {
  const [activeTab, setActiveTab] = useState('upload');
  const [contacts, setContacts] = useState({ total: 0, valid: 0, invalid: 0, duplicates: 0, rows: [] });
  const [pasteText, setPasteText] = useState('');
  const [newContact, setNewContact] = useState({ phone: '', name: '', email: '', city: '', company: '' });
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [columnMapping, setColumnMapping] = useState({ phone: 0, name: 1, email: 2, city: 3, company: 4 });
  const [rawData, setRawData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [hasHeaders, setHasHeaders] = useState(true);
  const [showHeaderConfirm, setShowHeaderConfirm] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState({});
  const [tempRawData, setTempRawData] = useState([]);
  
  const fileInputRef = useRef(null);

  // Load draft data on mount
  useEffect(() => {
    if (draftId) {
      loadDraftData();
    }
  }, [draftId]);

  const loadDraftData = () => {
    try {
      const draft = campaignService.getDraft(draftId);
      if (draft && draft.contacts) {
        setContacts(draft.contacts);
      }
    } catch (error) {
      console.error('Failed to load draft contacts:', error);
    }
  };

  // Save contacts to draft whenever contacts change
  const saveContactsToDraft = async (updatedContacts) => {
    try {
      const result = campaignService.saveDraft(draftId, { contacts: updatedContacts });
      if (result.success) {
        onDataChange({ contacts: updatedContacts });
      } else {
        console.error('Failed to save contacts to draft:', result.error);
      }
    } catch (error) {
      console.error('Error saving contacts:', error);
    }
  };

  // Process and validate contacts
  const processContacts = (data, mapping = columnMapping) => {
    const processed = [];
    const phoneSet = new Set();
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    // Process all rows as data (headers already separated)
    data.forEach((row, index) => {
      const phone = row[mapping.phone] || '';
      const normalizedPhone = normalizePhone(phone);
      
      if (!normalizedPhone || !isValidPhone(phone)) {
        invalidCount++;
        processed.push({
          id: generateId(),
          phone: phone,
          normalizedPhone: null,
          vars: {
            name: (mapping.name >= 0 ? row[mapping.name] : '') || '',
            email: (mapping.email >= 0 ? row[mapping.email] : '') || '',
            city: (mapping.city >= 0 ? row[mapping.city] : '') || '',
            company: (mapping.company >= 0 ? row[mapping.company] : '') || ''
          },
          isValid: false,
          isDuplicate: false,
          rowIndex: index
        });
        return;
      }

      const isDuplicate = phoneSet.has(normalizedPhone);
      if (isDuplicate) {
        duplicateCount++;
      } else {
        phoneSet.add(normalizedPhone);
        validCount++;
      }

      processed.push({
        id: generateId(),
        phone: phone,
        normalizedPhone: normalizedPhone,
        vars: {
          name: (mapping.name >= 0 ? row[mapping.name] : '') || '',
          email: (mapping.email >= 0 ? row[mapping.email] : '') || '',
          city: (mapping.city >= 0 ? row[mapping.city] : '') || '',
          company: (mapping.company >= 0 ? row[mapping.company] : '') || ''
        },
        isValid: !isDuplicate,
        isDuplicate: isDuplicate,
        rowIndex: index
      });
    });

    const result = {
      total: processed.length,
      valid: validCount,
      invalid: invalidCount,
      duplicates: duplicateCount,
      rows: processed
    };

    setContacts(result);
    saveContactsToDraft(result);
    return result;
  };

  // Handle file upload
  const handleFileUpload = async (file) => {
    if (!file) return;

    setProcessing(true);
    setErrors({});

    try {
      let parsed = [];
      
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        const reader = new FileReader();
        
        reader.onload = (e) => {
          try {
            const content = e.target.result;
            parsed = parseCSV(content);
            
            if (parsed.length > 0) {
              setTempRawData(parsed);
              setShowHeaderConfirm(true);
            } else {
              setErrors({ file: 'No data found in the CSV file.' });
              setProcessing(false);
            }
          } catch (error) {
            console.error('Error parsing CSV:', error);
            setErrors({ file: 'Failed to parse CSV file. Please check the format.' });
            setProcessing(false);
          }
        };
        
        reader.onerror = () => {
          setErrors({ file: 'Failed to read file.' });
          setProcessing(false);
        };
        
        reader.readAsText(file);
        
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        try {
          // For XLSX files - show helpful message for now
          setErrors({ 
            file: 'XLSX files require additional processing. Please export your Excel file as CSV format, or we can add XLSX support with a library like xlsx or exceljs.' 
          });
          setProcessing(false);
        } catch (error) {
          setErrors({ file: 'Failed to process XLSX file: ' + error.message });
          setProcessing(false);
        }
      } else {
        setErrors({ file: 'Please upload a CSV or Excel file.' });
        setProcessing(false);
      }
    } catch (error) {
      console.error('Error handling file:', error);
      setErrors({ file: 'Failed to process file: ' + error.message });
      setProcessing(false);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Handle header confirmation
  const handleHeaderConfirmation = (userHasHeaders) => {
    setHasHeaders(userHasHeaders);
    
    if (userHasHeaders) {
      // First row contains headers
      setHeaders(tempRawData[0] || []);
      setRawData(tempRawData.slice(1)); // Data starts from second row
    } else {
      // No headers, generate default ones
      const maxCols = Math.max(...tempRawData.map(row => row.length));
      const defaultHeaders = Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);
      setHeaders(defaultHeaders);
      setRawData(tempRawData); // All rows are data
    }
    
    // Reset column mapping to defaults based on detected headers
    const initialMapping = {
      phone: 0,
      name: Math.min(1, headers.length - 1),
      email: Math.min(2, headers.length - 1),
      city: Math.min(3, headers.length - 1),
      company: Math.min(4, headers.length - 1)
    };
    setColumnMapping(initialMapping);
    
    setShowHeaderConfirm(false);
    setShowColumnMapping(true);
    setProcessing(false);
  };

  // Handle paste contacts
  const handlePasteContacts = () => {
    if (!pasteText.trim()) return;

    setProcessing(true);
    try {
      // Try to parse as CSV first
      const lines = pasteText.trim().split('\n');
      const parsed = lines.map(line => {
        // Simple split by comma, tab, or multiple spaces
        return line.split(/[,\t]+|  +/).map(cell => cell.trim());
      });

      if (parsed.length > 0) {
        setTempRawData(parsed);
        setShowHeaderConfirm(true);
      }
    } catch (error) {
      setErrors({ paste: 'Failed to parse pasted content.' });
      setProcessing(false);
    }
  };

  // Handle manual contact add
  const handleAddManualContact = () => {
    if (!newContact.phone.trim()) {
      setErrors({ manual: 'Phone number is required.' });
      return;
    }

    const normalizedPhone = normalizePhone(newContact.phone);
    if (!normalizedPhone || !isValidPhone(newContact.phone)) {
      setErrors({ manual: 'Please enter a valid phone number.' });
      return;
    }

    // Check for duplicates
    const isDuplicate = contacts.rows.some(row => row.normalizedPhone === normalizedPhone);
    
    const contact = {
      id: generateId(),
      phone: newContact.phone,
      normalizedPhone: normalizedPhone,
      vars: {
        name: newContact.name || '',
        email: newContact.email || '',
        city: newContact.city || '',
        company: newContact.company || ''
      },
      isValid: !isDuplicate,
      isDuplicate: isDuplicate,
      rowIndex: contacts.rows.length
    };

    const updatedContacts = {
      ...contacts,
      total: contacts.total + 1,
      valid: contacts.valid + (isDuplicate ? 0 : 1),
      duplicates: contacts.duplicates + (isDuplicate ? 1 : 0),
      rows: [...contacts.rows, contact]
    };

    setContacts(updatedContacts);
    saveContactsToDraft(updatedContacts);
    setNewContact({ phone: '', name: '', email: '', city: '', company: '' });
    setErrors({});
  };

  // Handle column mapping confirmation
  const handleColumnMappingConfirm = () => {
    processContacts(rawData, columnMapping);
    setShowColumnMapping(false);
    setActiveTab('preview');
  };

  // Handle cell edit
  const handleCellEdit = (rowId, field, value) => {
    const updatedRows = contacts.rows.map(row => {
      if (row.id === rowId) {
        if (field === 'phone') {
          const normalizedPhone = normalizePhone(value);
          const isValid = normalizedPhone && isValidPhone(value);
          const isDuplicate = isValid && contacts.rows.some(r => r.id !== rowId && r.normalizedPhone === normalizedPhone);
          
          return {
            ...row,
            phone: value,
            normalizedPhone: isValid ? normalizedPhone : null,
            isValid: isValid && !isDuplicate,
            isDuplicate: isDuplicate
          };
        } else {
          return {
            ...row,
            vars: {
              ...row.vars,
              [field]: value
            }
          };
        }
      }
      return row;
    });

    // Recalculate stats
    const validCount = updatedRows.filter(row => row.isValid).length;
    const invalidCount = updatedRows.filter(row => !row.isValid && !row.isDuplicate).length;
    const duplicateCount = updatedRows.filter(row => row.isDuplicate).length;

    const updatedContacts = {
      ...contacts,
      valid: validCount,
      invalid: invalidCount,
      duplicates: duplicateCount,
      rows: updatedRows
    };

    setContacts(updatedContacts);
    saveContactsToDraft(updatedContacts);
  };

  // Handle remove contact
  const handleRemoveContact = (rowId) => {
    const updatedRows = contacts.rows.filter(row => row.id !== rowId);
    
    // Recalculate stats
    const validCount = updatedRows.filter(row => row.isValid).length;
    const invalidCount = updatedRows.filter(row => !row.isValid && !row.isDuplicate).length;
    const duplicateCount = updatedRows.filter(row => row.isDuplicate).length;

    const updatedContacts = {
      total: updatedRows.length,
      valid: validCount,
      invalid: invalidCount,
      duplicates: duplicateCount,
      rows: updatedRows
    };

    setContacts(updatedContacts);
    saveContactsToDraft(updatedContacts);
  };

  // Handle deduplicate
  const handleDeduplicate = () => {
    const phoneSet = new Set();
    const deduplicatedRows = [];
    
    contacts.rows.forEach(row => {
      if (row.normalizedPhone && !phoneSet.has(row.normalizedPhone)) {
        phoneSet.add(row.normalizedPhone);
        deduplicatedRows.push({
          ...row,
          isValid: true,
          isDuplicate: false
        });
      }
    });

    const updatedContacts = {
      total: deduplicatedRows.length,
      valid: deduplicatedRows.length,
      invalid: 0,
      duplicates: 0,
      rows: deduplicatedRows
    };

    setContacts(updatedContacts);
    saveContactsToDraft(updatedContacts);
  };

  // Handle next step
  const handleNext = () => {
    if (contacts.valid === 0) {
      setErrors({ submit: 'Please add at least one valid contact before proceeding.' });
      return;
    }
    onNext();
  };

  // Get preview rows (first 20)
  const previewRows = contacts.rows.slice(0, 20);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Add Contacts</h2>
        <p className="text-gray-600">
          Upload contacts from a file, paste them directly, or add them manually. Phone numbers will be validated and duplicates will be highlighted.
        </p>
      </div>

      {/* Summary Ribbon */}
      {contacts.total > 0 && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{contacts.total}</div>
            <div className="text-sm text-blue-700">Total</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{contacts.valid}</div>
            <div className="text-sm text-green-700">Valid</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{contacts.invalid}</div>
            <div className="text-sm text-red-700">Invalid</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{contacts.duplicates}</div>
            <div className="text-sm text-orange-700">Duplicates</div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {['upload', 'paste', 'manual', 'preview'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'upload' && 'Upload File'}
                {tab === 'paste' && 'Paste Contacts'}
                {tab === 'manual' && 'Add Manually'}
                {tab === 'preview' && `Preview (${contacts.total})`}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* Drag & Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="mt-4">
              <p className="text-lg font-medium text-gray-900">
                Drop your CSV file here, or{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-500 font-medium"
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse
                </button>
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Supports CSV files up to 10MB. For Excel files, please export as CSV format.
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => handleFileUpload(e.target.files[0])}
            className="hidden"
          />

          {errors.file && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
              {errors.file}
            </div>
          )}
        </div>
      )}

      {activeTab === 'paste' && (
        <div className="space-y-6">
          <div>
            <label htmlFor="paste-contacts" className="block text-sm font-medium text-gray-700 mb-2">
              Paste Contacts
            </label>
            <textarea
              id="paste-contacts"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Paste your contacts here. Separate columns with commas or tabs.&#10;Example:&#10;John Doe, +1234567890, john@example.com, New York, Acme Corp&#10;Jane Smith, +0987654321, jane@example.com, Los Angeles, Tech Inc"
            />
            <p className="mt-2 text-sm text-gray-600">
              Each line should be one contact. Separate fields with commas or tabs.
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handlePasteContacts}
              disabled={!pasteText.trim() || processing}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {processing ? 'Processing...' : 'Parse Contacts'}
            </button>
            <button
              onClick={() => setPasteText('')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
            >
              Clear
            </button>
          </div>

          {errors.paste && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
              {errors.paste}
            </div>
          )}
        </div>
      )}

      {activeTab === 'manual' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                id="phone"
                type="tel"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+1234567890"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <input
                id="city"
                type="text"
                value={newContact.city}
                onChange={(e) => setNewContact({ ...newContact, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="New York"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                Company
              </label>
              <input
                id="company"
                type="text"
                value={newContact.company}
                onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Acme Corporation"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleAddManualContact}
              disabled={!newContact.phone.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Add Contact
            </button>
          </div>

          {errors.manual && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
              {errors.manual}
            </div>
          )}
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="space-y-6">
          {contacts.total > 0 ? (
            <>
              {/* Action buttons */}
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  {contacts.duplicates > 0 && (
                    <button
                      onClick={handleDeduplicate}
                      className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-medium text-sm"
                    >
                      Remove Duplicates ({contacts.duplicates})
                    </button>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  Showing first {Math.min(20, contacts.total)} of {contacts.total} contacts
                </div>
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        City
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Company
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewRows.map((row) => (
                      <tr key={row.id} className={`${
                        !row.isValid ? (row.isDuplicate ? 'bg-orange-50' : 'bg-red-50') : ''
                      }`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {row.isValid ? (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              Valid
                            </span>
                          ) : row.isDuplicate ? (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                              Duplicate
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              Invalid
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingCell === `${row.id}-phone` ? (
                            <input
                              type="tel"
                              value={row.phone}
                              onChange={(e) => handleCellEdit(row.id, 'phone', e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              onKeyPress={(e) => e.key === 'Enter' && setEditingCell(null)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              autoFocus
                            />
                          ) : (
                            <div
                              onClick={() => setEditingCell(`${row.id}-phone`)}
                              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                            >
                              {row.phone}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingCell === `${row.id}-name` ? (
                            <input
                              type="text"
                              value={row.vars.name}
                              onChange={(e) => handleCellEdit(row.id, 'name', e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              onKeyPress={(e) => e.key === 'Enter' && setEditingCell(null)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              autoFocus
                            />
                          ) : (
                            <div
                              onClick={() => setEditingCell(`${row.id}-name`)}
                              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                            >
                              {row.vars.name || '-'}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingCell === `${row.id}-email` ? (
                            <input
                              type="email"
                              value={row.vars.email}
                              onChange={(e) => handleCellEdit(row.id, 'email', e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              onKeyPress={(e) => e.key === 'Enter' && setEditingCell(null)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              autoFocus
                            />
                          ) : (
                            <div
                              onClick={() => setEditingCell(`${row.id}-email`)}
                              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                            >
                              {row.vars.email || '-'}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingCell === `${row.id}-city` ? (
                            <input
                              type="text"
                              value={row.vars.city}
                              onChange={(e) => handleCellEdit(row.id, 'city', e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              onKeyPress={(e) => e.key === 'Enter' && setEditingCell(null)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              autoFocus
                            />
                          ) : (
                            <div
                              onClick={() => setEditingCell(`${row.id}-city`)}
                              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                            >
                              {row.vars.city || '-'}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingCell === `${row.id}-company` ? (
                            <input
                              type="text"
                              value={row.vars.company}
                              onChange={(e) => handleCellEdit(row.id, 'company', e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              onKeyPress={(e) => e.key === 'Enter' && setEditingCell(null)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              autoFocus
                            />
                          ) : (
                            <div
                              onClick={() => setEditingCell(`${row.id}-company`)}
                              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                            >
                              {row.vars.company || '-'}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleRemoveContact(row.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {contacts.total > 20 && (
                <div className="text-center py-4 text-sm text-gray-600">
                  ... and {contacts.total - 20} more contacts
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium">No contacts added yet</h3>
              <p className="mt-2">Use the tabs above to upload, paste, or manually add contacts.</p>
            </div>
          )}
        </div>
      )}

      {/* Header Confirmation Modal */}
      {showHeaderConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Data Structure</h3>
            <p className="text-gray-600 mb-4">
              We detected {tempRawData.length} rows of data. Does the first row contain column headers?
            </p>

            {/* Preview first few rows */}
            {tempRawData.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">Preview:</h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tempRawData.slice(0, 3).map((row, index) => (
                        <tr key={index} className={index === 0 ? 'bg-yellow-50' : ''}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-500 w-20">
                            Row {index + 1}:
                          </td>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-2 text-sm text-gray-900 border-l">
                              {cell || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Row 1 is highlighted. If it contains headers like "Name", "Phone", "Email", etc., select "Yes".
                </p>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <button
                onClick={() => handleHeaderConfirmation(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
              >
                No, Row 1 is Data
              </button>
              <button
                onClick={() => handleHeaderConfirmation(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Yes, Row 1 Contains Headers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Column Mapping Modal */}
      {showColumnMapping && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Map Columns to Contact Fields</h3>
            <p className="text-gray-600 mb-6">
              Please map your {headers.length} data columns to the appropriate contact fields. This determines how we'll organize your contact information.
            </p>

            {/* Column mapping */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📱 Phone Column (Required)
                </label>
                <select
                  value={columnMapping.phone}
                  onChange={(e) => setColumnMapping({ ...columnMapping, phone: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {headers.map((header, index) => (
                    <option key={index} value={index}>
                      {hasHeaders ? `"${header}"` : `Column ${index + 1}`} 
                      {hasHeaders && header ? ` (Column ${index + 1})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  👤 Name Column
                </label>
                <select
                  value={columnMapping.name}
                  onChange={(e) => setColumnMapping({ ...columnMapping, name: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={-1}>Skip this field</option>
                  {headers.map((header, index) => (
                    <option key={index} value={index}>
                      {hasHeaders ? `"${header}"` : `Column ${index + 1}`} 
                      {hasHeaders && header ? ` (Column ${index + 1})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📧 Email Column
                </label>
                <select
                  value={columnMapping.email}
                  onChange={(e) => setColumnMapping({ ...columnMapping, email: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={-1}>Skip this field</option>
                  {headers.map((header, index) => (
                    <option key={index} value={index}>
                      {hasHeaders ? `"${header}"` : `Column ${index + 1}`} 
                      {hasHeaders && header ? ` (Column ${index + 1})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏙️ City Column
                </label>
                <select
                  value={columnMapping.city}
                  onChange={(e) => setColumnMapping({ ...columnMapping, city: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={-1}>Skip this field</option>
                  {headers.map((header, index) => (
                    <option key={index} value={index}>
                      {hasHeaders ? `"${header}"` : `Column ${index + 1}`} 
                      {hasHeaders && header ? ` (Column ${index + 1})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏢 Company Column
                </label>
                <select
                  value={columnMapping.company}
                  onChange={(e) => setColumnMapping({ ...columnMapping, company: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={-1}>Skip this field</option>
                  {headers.map((header, index) => (
                    <option key={index} value={index}>
                      {hasHeaders ? `"${header}"` : `Column ${index + 1}`} 
                      {hasHeaders && header ? ` (Column ${index + 1})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mapping Summary */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-md font-medium text-gray-900 mb-3">Current Mapping:</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <div><strong>Phone:</strong> {hasHeaders ? `"${headers[columnMapping.phone]}"` : `Column ${columnMapping.phone + 1}`}</div>
                <div><strong>Name:</strong> {columnMapping.name >= 0 ? (hasHeaders ? `"${headers[columnMapping.name]}"` : `Column ${columnMapping.name + 1}`) : 'Skipped'}</div>
                <div><strong>Email:</strong> {columnMapping.email >= 0 ? (hasHeaders ? `"${headers[columnMapping.email]}"` : `Column ${columnMapping.email + 1}`) : 'Skipped'}</div>
                <div><strong>City:</strong> {columnMapping.city >= 0 ? (hasHeaders ? `"${headers[columnMapping.city]}"` : `Column ${columnMapping.city + 1}`) : 'Skipped'}</div>
                <div><strong>Company:</strong> {columnMapping.company >= 0 ? (hasHeaders ? `"${headers[columnMapping.company]}"` : `Column ${columnMapping.company + 1}`) : 'Skipped'}</div>
              </div>
            </div>

            {/* Preview */}
            {rawData.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">Preview - How your data will be imported:</h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rawData.slice(0, 3).map((row, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm font-medium">{row[columnMapping.phone] || '-'}</td>
                          <td className="px-4 py-2 text-sm">{columnMapping.name >= 0 ? (row[columnMapping.name] || '-') : '-'}</td>
                          <td className="px-4 py-2 text-sm">{columnMapping.email >= 0 ? (row[columnMapping.email] || '-') : '-'}</td>
                          <td className="px-4 py-2 text-sm">{columnMapping.city >= 0 ? (row[columnMapping.city] || '-') : '-'}</td>
                          <td className="px-4 py-2 text-sm">{columnMapping.company >= 0 ? (row[columnMapping.company] || '-') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rawData.length > 3 && (
                  <p className="mt-2 text-sm text-gray-500">
                    Showing first 3 rows of {rawData.length} data rows...
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowColumnMapping(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleColumnMappingConfirm}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Import Contacts
              </button>
            </div>
          </div>
        </div>
      )}

      {errors.submit && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          {errors.submit}
        </div>
      )}

      {/* Step Actions */}
      <div className="mt-8 pt-6 border-t">
        <div className="flex justify-between items-center">
          <div>
            {!isFirst && (
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 rounded"
              >
                ← Back
              </button>
            )}
          </div>
          <div>
            <button
              onClick={handleNext}
              disabled={contacts.valid === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Next: Compose Message →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step2_Contacts;