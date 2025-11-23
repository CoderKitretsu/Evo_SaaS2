import React, { useState, useEffect } from 'react';
import campaignService from './campaignService.js';
import Step1_Details from './Step1_Details.jsx';
import Step2_Contacts from './Step2_Contacts.jsx';
import Step3_Message from './Step3_Message.jsx';
import Step4_Review from './Step4_Review.jsx';

/**
 * CampaignBuilder - 4-step wizard for creating campaigns
 * Layout: left vertical stepper, main content right, progress bar at top
 */
const CampaignBuilder = ({ draftId: initialDraftId, onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [draftId, setDraftId] = useState(initialDraftId);
  const [draftData, setDraftData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const steps = [
    { id: 1, title: 'Details', component: Step1_Details },
    { id: 2, title: 'Contacts', component: Step2_Contacts },
    { id: 3, title: 'Message Studio', component: Step3_Message },
    { id: 4, title: 'Review & Confirm', component: Step4_Review }
  ];

  // Initialize or load draft on mount
  useEffect(() => {
    initializeDraft();
  }, [initialDraftId]);

  const initializeDraft = async () => {
    setLoading(true);
    setError(null);

    try {
      if (initialDraftId) {
        // Load existing draft
        const existingDraft = campaignService.getDraft(initialDraftId);
        if (existingDraft) {
          setDraftData(existingDraft);
          setDraftId(initialDraftId);
        } else {
          setError('Draft not found');
        }
      } else {
        // Create new draft
        const result = campaignService.createDraft({
          name: '',
          description: '',
          instanceId: '',
          dryRun: true
        });

        if (result.success) {
          setDraftId(result.draftId);
          setDraftData(result.data);
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError('Failed to initialize campaign draft');
      console.error('Draft initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (currentStep < steps.length) {
      // Refresh draft data when moving to Step 4 (Review)
      if (currentStep === 3) {
        try {
          const latestDraft = campaignService.getDraft(draftId);
          if (latestDraft) {
            setDraftData(latestDraft);
          }
        } catch (error) {
          console.error('Failed to refresh draft data:', error);
        }
      }
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSaveDraft = async () => {
    if (!draftId) return;

    setIsSaving(true);
    try {
      // TODO: Get current step data and save it
      console.log('Saving draft...');
      // This will be implemented in individual step components
    } catch (err) {
      console.error('Failed to save draft:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const updateDraftData = (newData) => {
    setDraftData(prev => ({
      ...prev,
      ...newData,
      updatedAt: Date.now()
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading campaign builder...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <button
            onClick={initializeDraft}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const CurrentStepComponent = steps[currentStep - 1]?.component;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Progress Bar */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Create Campaign</h1>
            <div className="text-sm text-gray-500">
              Draft ID: {draftId}
            </div>
          </div>
          
          {/* Progress indicators */}
          <div className="flex items-center space-x-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  currentStep > step.id
                    ? 'bg-green-600 text-white'
                    : currentStep === step.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {currentStep > step.id ? '✓' : step.id}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'
                }`}>
                  {step.title}
                </span>
                {index < steps.length - 1 && (
                  <div className={`ml-4 w-12 h-0.5 ${
                    currentStep > step.id ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar - Stepper Navigation */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h3 className="font-medium text-gray-900">Campaign Steps</h3>
              </div>
              <nav className="p-2">
                {steps.map((step) => (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStep(step.id)}
                    disabled={step.id > currentStep + 1} // Only allow going back or to next step
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium mb-1 transition-colors ${
                      currentStep === step.id
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : currentStep > step.id
                        ? 'text-green-700 hover:bg-green-50'
                        : step.id === currentStep + 1
                        ? 'text-gray-700 hover:bg-gray-50'
                        : 'text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center mr-2 ${
                        currentStep > step.id
                          ? 'bg-green-100 text-green-700'
                          : currentStep === step.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {currentStep > step.id ? '✓' : step.id}
                      </span>
                      {step.title}
                    </div>
                  </button>
                ))}
              </nav>
            </div>

            {/* Save Draft Button */}
            <button
              onClick={handleSaveDraft}
              disabled={isSaving || !draftId}
              className="w-full mt-4 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm border min-h-96">
              {CurrentStepComponent && draftData ? (
                <CurrentStepComponent
                  draftId={draftId}
                  draftData={draftData}
                  onDataChange={updateDraftData}
                  onNext={handleNext}
                  onBack={handleBack}
                  isFirst={currentStep === 1}
                  isLast={currentStep === steps.length}
                  onComplete={onComplete}
                  // Pass specific data for Step3_Message
                  contactsData={currentStep === 3 ? {
                    contacts: draftData.contacts,
                    instanceId: draftData.meta?.instanceId
                  } : undefined}
                  initialData={currentStep === 3 ? draftData.message : undefined}
                />
              ) : (
                <div className="p-6">
                  <p className="text-gray-500">Loading step content...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-white border-t shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleBack}
                disabled={currentStep === 1}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                disabled={currentStep === steps.length}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentStep === steps.length ? 'Complete' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignBuilder;