import React, { useState } from 'react';
import TransformerTab from './components/TransformerTab';
import ChartsTab from './components/ChartsTab';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('transformer');

  return (
    <div className="container">
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'transformer' ? 'active' : ''}`}
          onClick={() => setActiveTab('transformer')}
        >
          Transformer
        </button>
        <button 
          className={`tab ${activeTab === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveTab('charts')}
        >
          Charts
        </button>
        <button 
          className={`tab ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          Report
        </button>
      </div>

      {activeTab === 'transformer' && <TransformerTab />}
      {activeTab === 'charts' && <ChartsTab />}
      {/* Report tab will be added later */}
    </div>
  );
}

export default App; 