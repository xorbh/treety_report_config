import React, { useState, useCallback } from 'react';
import ReactJson from 'react-json-view';
import ReactECharts from 'echarts-for-react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import './AIStudioTab.css';

function AIStudioTab({ jsonOutput }) {
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('Suggest some interesting visualizations based on this data');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [chartConfig, setChartConfig] = useState(null);
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [refiningChart, setRefiningChart] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const chartRef = React.useRef(null);

  // Function to get value from object using a data path
  const getValueByPath = (obj, path) => {
    try {
      return path.split('.').reduce((acc, part) => {
        // Handle array indexing
        if (part.includes('[') && part.includes(']')) {
          const arrayPart = part.split('[');
          const arrayName = arrayPart[0];
          const index = parseInt(arrayPart[1].replace(']', ''));
          return acc[arrayName][index];
        }
        return acc[part];
      }, obj);
    } catch (error) {
      console.error('Invalid data path:', path);
      return null;
    }
  };

  // Function to process chart configuration and replace data paths with actual data
  const processChartConfig = (config) => {
    if (!config || typeof config !== 'object') return config;

    const processValue = (value) => {
      if (!value || typeof value !== 'object') return value;
      
      if (value.dataPath) {
        const data = getValueByPath(displayData, value.dataPath);
        console.log('Processing data path:', value.dataPath, 'Result:', data);
        return data;
      }
      
      if (Array.isArray(value)) {
        return value.map(item => processValue(item));
      }
      
      const result = {};
      for (const key in value) {
        result[key] = processValue(value[key]);
      }
      return result;
    };

    const processedConfig = processValue(config);
    
    // Ensure the config has required properties
    if (!processedConfig.series || !Array.isArray(processedConfig.series)) {
      console.warn('Invalid chart configuration: missing or invalid series array');
      return {
        ...processedConfig,
        series: [{
          type: 'line',
          data: []
        }]
      };
    }

    // Ensure each series has required properties
    processedConfig.series = processedConfig.series.map(series => ({
      type: series.type || 'line',
      data: Array.isArray(series.data) ? series.data : [],
      name: series.name || 'Series',
      ...series
    }));

    console.log('Processed chart config:', processedConfig);
    return processedConfig;
  };

  // Create default chart configuration
  const createDefaultChartConfig = () => ({
    title: { text: 'Visualization Preview' },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      name: 'Data',
      type: 'line',
      data: [10, 15, 8, 20, 12, 18]
    }]
  });

  const handleConfigChange = useCallback((value) => {
    try {
      const parsedConfig = JSON.parse(value);
      console.log('Parsed config:', parsedConfig);
      const processedConfig = processChartConfig(parsedConfig);
      setChartConfig(processedConfig);
    } catch (error) {
      console.error('Invalid configuration:', error);
    }
  }, []);

  const stripChartImages = (obj) => {
    if (!obj) return obj;
    
    // Create a deep copy of the object
    const copy = JSON.parse(JSON.stringify(obj));
    
    // Function to recursively remove chart_images
    const removeChartImages = (object) => {
      if (typeof object !== 'object' || object === null) return;
      
      if (Array.isArray(object)) {
        object.forEach(item => removeChartImages(item));
      } else {
        delete object.chart_images;
        Object.values(object).forEach(value => removeChartImages(value));
      }
    };

    removeChartImages(copy);
    return copy;
  };

  const handleSubmit = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your OpenAI API key');
      return;
    }
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const messages = [
        {
          role: 'system',
          content: `You are an AI assistant analyzing JSON data. You should provide suggestions in a structured JSON format with the following schema:
{
  "suggestions": [
    {
      "title": "Chart Title",
      "description": "Chart Description",
      "chartType": "Chart Type",
      "config": {
        // ECharts configuration object
        // IMPORTANT: Instead of embedding data directly, use data paths to reference the source data
        // The configuration MUST include:
        // 1. title: { text: string }
        // 2. series: array of series objects, each with:
        //    - type: chart type (e.g., 'line', 'bar')
        //    - name: series name
        //    - dataPath: path to the data array
        // Example:
        {
          "title": { "text": "CO2 Emissions Over Time" },
          "tooltip": { "trigger": "axis" },
          "xAxis": { 
            "type": "category",
            "dataPath": "assets_analysis[0].time_series.time_points"
          },
          "yAxis": { "type": "value" },
          "series": [{
            "name": "CO2 Emissions",
            "type": "line",
            "dataPath": "assets_analysis[0].time_series.metrics.environmental.CO2_emission.values"
          }]
        }
      }
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Here is the JSON data to analyze:\n${JSON.stringify(displayData, null, 2)}\n\nBased on this data, provide visualization suggestions in the specified JSON format. Consider the following prompt: ${prompt}`
        }
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: messages,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to get response from OpenAI');
      }

      try {
        const messageContent = data.choices[0]?.message?.content || '';
        const parsedSuggestions = JSON.parse(messageContent);
        setSuggestions(parsedSuggestions);
        
        // Set the first suggestion's config as the initial chart config
        if (parsedSuggestions?.suggestions?.[0]?.config) {
          const processedConfig = processChartConfig(parsedSuggestions.suggestions[0].config);
          setChartConfig(processedConfig);
        } else {
          setChartConfig(createDefaultChartConfig());
        }
        
        setResult(data);
      } catch (parseError) {
        setError('Failed to parse AI response as JSON');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChartRefinement = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your OpenAI API key');
      return;
    }
    if (!refinementPrompt.trim()) {
      setError('Please enter a refinement prompt');
      return;
    }
    if (!chartConfig) {
      setError('No chart configuration selected');
      return;
    }

    setRefiningChart(true);
    setError(null);

    try {
      const messages = [
        {
          role: 'system',
          content: `You are an AI assistant specializing in ECharts configurations. You must respond with a valid JSON object that follows the ECharts configuration schema. Analyze the provided chart configuration and return a modified JSON configuration object based on the user's refinement request. Do not include any explanatory text, only return the JSON configuration object.`
        },
        {
          role: 'user',
          content: `Here is the current chart configuration:\n${JSON.stringify(chartConfig, null, 2)}\n\nPlease modify this configuration based on the following request: ${refinementPrompt}`
        }
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: messages,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to get response from OpenAI');
      }

      try {
        const messageContent = data.choices[0]?.message?.content || '';
        const parsedConfig = JSON.parse(messageContent);
        const processedConfig = processChartConfig(parsedConfig);
        setChartConfig(processedConfig);
      } catch (parseError) {
        setError('Failed to parse AI response as JSON');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRefiningChart(false);
    }
  };

  // Get the display data by stripping chart_images from the result or jsonOutput
  const displayData = stripChartImages(jsonOutput);

  return (
    <div className="ai-studio-container">
      <div className="top-row">
        <div className="json-viewer-section">
          <h3>JSON Data:</h3>
          <ReactJson 
            src={displayData} 
            theme="monokai"
            displayDataTypes={false}
            enableClipboard={false}
            collapsed={2}
          />
        </div>

        <div className="input-section">
          <div className="api-key-input">
            <input
              type="password"
              placeholder="Enter your OpenAI API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="api-key-field"
            />
          </div>
          <div className="prompt-input">
            <textarea
              placeholder="Enter your prompt about the JSON data"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="prompt-field"
            />
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="submit-button"
            >
              {loading ? 'Processing...' : 'Execute'}
            </button>
          </div>
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
      
      {suggestions && (
        <div className="results-row">
          <div className="response-section">
            <div className="response-header">
              <h3>Visualization Suggestions:</h3>
              <button 
                className="view-json-button"
                onClick={() => setShowJsonModal(true)}
              >
                View Raw JSON
              </button>
            </div>
            <div className="suggestions-table">
              <table>
                <thead>
                  <tr>
                    <th>Chart Title</th>
                    <th>Type</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.suggestions.map((suggestion, index) => (
                    <tr 
                      key={index} 
                      className="suggestion-row"
                      onClick={() => suggestion.config && setChartConfig(processChartConfig(suggestion.config))}
                    >
                      <td className="suggestion-title">{suggestion.title}</td>
                      <td className="suggestion-type">{suggestion.chartType}</td>
                      <td className="suggestion-desc">{suggestion.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* JSON Modal */}
      {showJsonModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Visualization Suggestions JSON</h2>
              <button 
                className="close-button"
                onClick={() => setShowJsonModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <ReactJson 
                src={suggestions}
                theme="monokai"
                displayDataTypes={false}
                enableClipboard={true}
                collapsed={1}
                style={{ 
                  backgroundColor: '#272822',
                  padding: '15px',
                  borderRadius: '4px',
                  maxHeight: '70vh',
                  overflow: 'auto'
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="refinement-row">
        <div className="refinement-input">
          <textarea
            placeholder="Enter refinement prompt for the selected chart (e.g., 'make the lines thicker', 'change to bar chart', 'use a dark theme')"
            value={refinementPrompt}
            onChange={(e) => setRefinementPrompt(e.target.value)}
            className="refinement-field"
          />
          <button 
            onClick={handleChartRefinement}
            disabled={refiningChart || !chartConfig}
            className="refinement-button"
          >
            {refiningChart ? 'Refining...' : 'Refine Chart'}
          </button>
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-config-panel">
          <h3>Chart Configuration</h3>
          <CodeMirror
            value={JSON.stringify(chartConfig || createDefaultChartConfig(), null, 2)}
            height="400px"
            theme={oneDark}
            extensions={[javascript()]}
            onChange={handleConfigChange}
          />
        </div>
        <div className="chart-display-panel">
          <ReactECharts
            ref={chartRef}
            option={processChartConfig(chartConfig) || createDefaultChartConfig()}
            style={{ height: '400px' }}
          />
        </div>
      </div>
    </div>
  );
}

export default AIStudioTab; 