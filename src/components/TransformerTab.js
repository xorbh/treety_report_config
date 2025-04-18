import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

const TransformerTab = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [success, setSuccess] = useState('');

  // Load initial transformer code and JSON data
  useEffect(() => {
    // Load transformer code
    fetch('/transformer.js')
      .then(response => response.text())
      .then(transformerCode => {
        setCode(transformerCode);
        setInfo('Transformer code loaded successfully');
        
        // After transformer code is loaded, load JSON data
        return fetch('/data.json').then(response => response.json())
          .then(data => {
            const jsonStr = JSON.stringify(data, null, 2);
            setJsonInput(jsonStr);
            setInfo('Sample JSON data loaded');
            
            // Run the transformation after both code and data are loaded
            try {
              // eslint-disable-next-line no-new-func
              const transformFn = new Function('inputJsonStr', transformerCode);
              const result = transformFn(JSON.stringify(data));
              setJsonOutput(JSON.stringify(result, null, 2));
              setSuccess('Code executed successfully');
            } catch (execError) {
              setError('Error executing code: ' + execError.message);
            }
          });
      })
      .catch(err => {
        setError('Failed to load data: ' + err.message);
        // Set fallback code
        setCode('// Transform your JSON data here\n// Example:\n// return input.map(item => ({ ...item, processed: true }));');
      });
  }, []);

  const loadJSONData = () => {
    try {
      fetch('/data.json')
        .then(response => response.json())
        .then(data => {
          setJsonInput(JSON.stringify(data, null, 2));
          setInfo('Sample JSON data loaded');
          setError('');
        })
        .catch(err => {
          setError('Failed to load JSON data: ' + err.message);
        });
    } catch (err) {
      setError('Failed to load JSON data: ' + err.message);
    }
  };

  const runJavaScript = () => {
    setError('');
    setSuccess('');
    setInfo('');

    try {
      const input = JSON.parse(jsonInput);
      
      // Create a new Function from the code string
      // eslint-disable-next-line no-new-func
      const transformFn = new Function('inputJsonStr', code);
      
      try {
        const result = transformFn(JSON.stringify(input));
        setJsonOutput(JSON.stringify(result, null, 2));
        setSuccess('Code executed successfully');
      } catch (execError) {
        setError('Error executing code: ' + execError.message);
      }
    } catch (parseError) {
      setError('Invalid JSON input: ' + parseError.message);
    }
  };

  return (
    <div className="editors-wrapper">
      <div className="json-row">
        <div className="editor-container">
          <div className="editor-header">
            <div className="editor-label">JSON Input</div>
            <button className="load-json-button" onClick={loadJSONData}>
              Load JSON
            </button>
          </div>
          <CodeMirror
            value={jsonInput}
            height="300px"
            theme={oneDark}
            extensions={[javascript()]}
            onChange={(value) => setJsonInput(value)}
          />
          {error && <div className="error">{error}</div>}
        </div>
        <div className="editor-container">
          <div className="editor-label">JSON Output</div>
          <CodeMirror
            value={jsonOutput}
            height="300px"
            theme={oneDark}
            extensions={[javascript()]}
            readOnly={true}
          />
        </div>
      </div>

      <div className="code-row">
        <div className="editor-container" style={{ width: '100%' }}>
          <div className="editor-label">JavaScript Code</div>
          <CodeMirror
            value={code}
            height="400px"
            theme={oneDark}
            extensions={[javascript()]}
            onChange={(value) => setCode(value)}
          />
          <button className="action-button" onClick={runJavaScript}>
            Run Code
          </button>
        </div>
      </div>

      <div className="output-row">
        {error && <div className="error">{error}</div>}
        {info && <div className="info">{info}</div>}
        {success && <div className="success">{success}</div>}
      </div>
    </div>
  );
};

export default TransformerTab; 