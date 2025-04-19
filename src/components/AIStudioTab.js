import React from 'react';
import ReactJson from 'react-json-view';

function AIStudioTab({ jsonOutput }) {
  return (
    <div className="ai-studio-container">
      <div className="json-viewer-section">
        <ReactJson 
          src={jsonOutput} 
          theme="monokai"
          displayDataTypes={false}
          enableClipboard={false}
          collapsed={2}
        />
      </div>
      {/* Rest of AI Studio features will be added later */}
    </div>
  );
}

export default AIStudioTab; 