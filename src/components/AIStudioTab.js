import React, { useState, useCallback } from 'react';
import ReactJson from 'react-json-view';
import ReactECharts from 'echarts-for-react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import './AIStudioTab.css';

function AIStudioTab({ jsonOutput }) {
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [chartConfig, setChartConfig] = useState(null);
  const chartRef = React.useRef(null);

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
      setChartConfig(parsedConfig);
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
          setChartConfig(parsedSuggestions.suggestions[0].config);
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
            <h3>Visualization Suggestions:</h3>
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
                      onClick={() => suggestion.config && setChartConfig(suggestion.config)}
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
            option={chartConfig || createDefaultChartConfig()}
            style={{ height: '400px' }}
          />
        </div>
      </div>
    </div>
  );
}

export default AIStudioTab; 