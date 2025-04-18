import React, { useState } from 'react';
import TransformerTab from './components/TransformerTab';
import ChartsTab from './components/ChartsTab';
import ReportTab from './components/ReportTab';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('transformer');
  const [jsonOutput, setJsonOutput] = useState({});

  return (
    <div className="container">
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'transformer' ? 'active' : ''}`}
          onClick={() => setActiveTab('transformer')}
        >
          Data
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

      {activeTab === 'transformer' && <TransformerTab jsonOutput={jsonOutput} setJsonOutput={setJsonOutput} />}
      {activeTab === 'charts' && <ChartsTab jsonOutput={jsonOutput} setJsonOutput={setJsonOutput} />}
      {activeTab === 'report' && <ReportTab templateData={jsonOutput} />}
    </div>
  );
}

export default App; 