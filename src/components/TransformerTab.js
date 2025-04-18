import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import ReactJson from '@microlink/react-json-view';

const TransformerTab = ({ jsonOutput, setJsonOutput }) => {
  const [jsonInput, setJsonInput] = useState({});
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
            setJsonInput(data);
            setInfo('Sample JSON data loaded');
            
            // Run the transformation after both code and data are loaded
            try {
              // eslint-disable-next-line no-new-func
              const transformFn = new Function('inputJsonStr', transformerCode);
              const result = transformFn(JSON.stringify(data));
              const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
              setJsonOutput(parsedResult);
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
  }, [setJsonOutput]);

  const loadJSONData = () => {
    try {
      fetch('/data.json')
        .then(response => response.json())
        .then(data => {
          setJsonInput(data);
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
      // eslint-disable-next-line no-new-func
      const transformFn = new Function('inputJsonStr', code);
      
      try {
        const result = transformFn(JSON.stringify(jsonInput));
        const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
        setJsonOutput(parsedResult);
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
          <div style={{
            background: '#282c34',
            padding: '10px',
            borderRadius: '4px',
            height: '300px',
            overflow: 'auto'
          }}>
            <ReactJson
              src={jsonInput}
              theme="monokai"
              name={null}
              collapsed={1}
              enableClipboard={true}
              displayDataTypes={false}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </div>
          {error && <div className="error">{error}</div>}
        </div>
        <div className="editor-container">
          <div className="editor-label">JSON Output</div>
          <div style={{
            background: '#282c34',
            padding: '10px',
            borderRadius: '4px',
            height: '300px',
            overflow: 'auto'
          }}>
            <ReactJson
              src={jsonOutput}
              theme="monokai"
              name={null}
              collapsed={1}
              enableClipboard={true}
              displayDataTypes={false}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </div>
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