import React from 'react';

/**
 * Campaigns Placeholder Component
 * Safe placeholder until full campaigns implementation is ready
 */
const CampaignsPlaceholder = ({ onBackToMessaging }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Header */}
          <div className="mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Campaigns</h1>
            <p className="text-lg text-gray-600">Build & monitor message campaigns at scale</p>
          </div>

          {/* Coming Soon Content */}
          <div className="mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-3">🚀 Coming Soon</h2>
              <p className="text-blue-800 mb-4">
                The Campaigns feature is currently under development and will be available soon!
              </p>
              <div className="text-left">
                <h3 className="font-semibold text-blue-900 mb-2">Planned Features:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>✨ Advanced message composer with templates</li>
                  <li>📊 Multi-send campaign management</li>
                  <li>📅 Scheduled message delivery</li>
                  <li>📈 Real-time progress monitoring</li>
                  <li>👥 Contact list management & import</li>
                  <li>🎯 Message personalization & variables</li>
                </ul>
              </div>
            </div>

            {/* Current Status */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-center gap-3 text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm font-medium">Development in progress...</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onBackToMessaging}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
              </svg>
              Back to Messaging
            </button>
            <button
              onClick={() => alert('Stay tuned for updates!')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
              </svg>
              Get Notified
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignsPlaceholder;