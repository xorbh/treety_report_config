import React, { useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import './ChartsTab.css';

const ChartsTab = ({ jsonOutput, setJsonOutput }) => {
  const [data, setData] = useState(null);
  const [configModal, setConfigModal] = useState({ isOpen: false, chartId: null, config: '' });
  const [chartConfigs, setChartConfigs] = useState({
    environmentalChart: null,
    socialChart: null,
    radarChart: null,
    gaugeChart: null,
    timelineChart: null
  });
  
  // Use a ref object to store chart instances
  const chartRefs = React.useRef({
    environmentalChart: null,
    socialChart: null,
    radarChart: null,
    gaugeChart: null,
    timelineChart: null
  });

  // Create stable ref callbacks for each chart
  const setChartRef = useCallback((chartId) => (ref) => {
    if (ref) {
      chartRefs.current[chartId] = ref;
    }
  }, []);

  // Function to capture all charts as base64 and update JSON output
  const updateChartsInOutput = useCallback(() => {
    const chartImages = {};
    
    Object.keys(chartRefs.current).forEach(chartId => {
      const chartInstance = chartRefs.current[chartId]?.getEchartsInstance();
      if (chartInstance) {
        chartImages[chartId.replace('Chart', '')] = chartInstance.getDataURL();
      }
    });

    // Update the JSON output with chart images
    setJsonOutput({
      ...jsonOutput,
      chart_images: chartImages
    });
  }, [jsonOutput, setJsonOutput]);

  // Update charts in output whenever they change
  useEffect(() => {
    if (chartConfigs.environmentalChart) {
      // Wait for charts to render before capturing
      const timer = setTimeout(updateChartsInOutput, 500);
      return () => clearTimeout(timer);
    }
  }, [chartConfigs, updateChartsInOutput]);

  useEffect(() => {
    // Load initial data
    fetch('/data.json')
      .then(response => response.json())
      .then(jsonData => {
        setData(jsonData);
        initializeChartConfigs(jsonData);
      })
      .catch(err => console.error('Error loading data:', err));
  }, []);

  const initializeChartConfigs = (data) => {
    if (!data) return;

    const environmentalConfig = {
      title: { text: 'Environmental Metrics Over Time' },
      tooltip: { trigger: 'axis' },
      legend: { data: ['CO2 Emissions', 'Water Usage', 'Renewable Energy'] },
      xAxis: { type: 'category', data: data.assets_analysis[0].time_series.time_points },
      yAxis: [
        { type: 'value', name: 'CO2 & Water' },
        { type: 'value', name: 'Renewable %' }
      ],
      series: [
        {
          name: 'CO2 Emissions',
          type: 'line',
          data: data.assets_analysis[0].time_series.metrics.environmental.CO2_emission.values
        },
        {
          name: 'Water Usage',
          type: 'line',
          data: data.assets_analysis[0].time_series.metrics.environmental.water_usage.values
        },
        {
          name: 'Renewable Energy',
          type: 'line',
          yAxisIndex: 1,
          data: data.assets_analysis[0].time_series.metrics.environmental.renewable_energy_percentage.values
        }
      ]
    };

    const socialConfig = {
      title: { text: 'Social Metrics Overview' },
      tooltip: { trigger: 'axis' },
      legend: { data: ['Female %', 'Minority %', 'Employee Satisfaction'] },
      xAxis: { type: 'category', data: data.assets_analysis[0].time_series.time_points },
      yAxis: [
        { type: 'value', name: 'Percentage', max: 100 },
        { type: 'value', name: 'Score', max: 10 }
      ],
      series: [
        {
          name: 'Female %',
          type: 'bar',
          data: data.assets_analysis[0].time_series.metrics.social.board_diversity.female_percentage.values
        },
        {
          name: 'Minority %',
          type: 'bar',
          data: data.assets_analysis[0].time_series.metrics.social.board_diversity.minority_percentage.values
        },
        {
          name: 'Employee Satisfaction',
          type: 'line',
          yAxisIndex: 1,
          data: data.assets_analysis[0].time_series.metrics.social.employee_satisfaction.values
        }
      ]
    };

    const radarConfig = {
      title: { text: 'ESG Overview' },
      tooltip: {},
      legend: { data: data.assets_analysis.map(asset => asset.name) },
      radar: {
        indicator: [
          { name: 'Environmental', max: 100 },
          { name: 'Social', max: 100 },
          { name: 'Governance', max: 100 }
        ]
      },
      series: [{
        type: 'radar',
        data: data.assets_analysis.map(asset => ({
          name: asset.name,
          value: [
            100 - asset.time_series.metrics.environmental.CO2_emission.values[0] / 2,
            asset.time_series.metrics.social.board_diversity.female_percentage.values[0],
            asset.time_series.metrics.governance.board_independence.values[0]
          ]
        }))
      }]
    };

    const gaugeConfig = {
      title: { text: 'Governance Status' },
      series: [{
        type: 'gauge',
        progress: { show: true },
        detail: { valueAnimation: true, formatter: '{value}%' },
        data: [{
          value: data.assets_analysis[0].time_series.metrics.governance.board_independence.values[0],
          name: 'Board Independence'
        }]
      }]
    };

    const timelineConfig = {
      title: { text: 'Incidents Timeline' },
      tooltip: { trigger: 'axis' },
      legend: { data: ['Ethics Violations', 'Cybersecurity Incidents'] },
      xAxis: { type: 'category', data: data.assets_analysis[0].time_series.time_points },
      yAxis: { type: 'value', name: 'Incidents' },
      series: [
        {
          name: 'Ethics Violations',
          type: 'line',
          data: data.assets_analysis[0].time_series.metrics.governance.ethics_violations.values
        },
        {
          name: 'Cybersecurity Incidents',
          type: 'line',
          data: data.assets_analysis[0].time_series.metrics.governance.cybersecurity_incidents.values
        }
      ]
    };

    setChartConfigs({
      environmentalChart: environmentalConfig,
      socialChart: socialConfig,
      radarChart: radarConfig,
      gaugeChart: gaugeConfig,
      timelineChart: timelineConfig
    });
  };

  const handleConfigAction = (action, chartId) => {
    switch (action) {
      case 'export':
        setConfigModal({
          isOpen: true,
          chartId,
          config: JSON.stringify(chartConfigs[chartId], null, 2)
        });
        break;
      case 'import':
        setConfigModal({
          isOpen: true,
          chartId,
          config: ''
        });
        break;
      case 'download':
        const chart = document.querySelector(`#${chartId}`);
        if (chart) {
          const url = chart.querySelector('canvas').toDataURL('image/png');
          const link = document.createElement('a');
          link.download = `${chartId}.png`;
          link.href = url;
          link.click();
        }
        break;
      default:
        break;
    }
  };

  const handleConfigSave = () => {
    try {
      const newConfig = JSON.parse(configModal.config);
      setChartConfigs(prev => ({
        ...prev,
        [configModal.chartId]: newConfig
      }));
      setConfigModal({ isOpen: false, chartId: null, config: '' });
    } catch (error) {
      console.error('Invalid configuration:', error);
    }
  };

  const handleConfigChange = (chartId, newConfig) => {
    try {
      const parsedConfig = JSON.parse(newConfig);
      setChartConfigs(prev => ({
        ...prev,
        [chartId]: parsedConfig
      }));
    } catch (error) {
      console.error('Invalid configuration:', error);
    }
  };

  if (!data || !chartConfigs.environmentalChart) {
    return <div>Loading charts...</div>;
  }

  const chartRows = [
    { id: 'environmentalChart', title: 'Environmental Metrics' },
    { id: 'socialChart', title: 'Social Metrics' },
    { id: 'radarChart', title: 'ESG Overview' },
    { id: 'gaugeChart', title: 'Governance Status' },
    { id: 'timelineChart', title: 'Incidents Timeline' }
  ];

  return (
    <div className="charts-container">
      {chartRows.map(({ id, title }) => (
        <div key={id} className="chart-row">
          <div className="chart-config-panel">
            <h3>{title} Configuration</h3>
            <CodeMirror
              value={JSON.stringify(chartConfigs[id], null, 2)}
              height="400px"
              theme={oneDark}
              extensions={[javascript()]}
              onChange={(value) => handleConfigChange(id, value)}
            />
          </div>
          <div className="chart-display-panel">
            <h3>{title}</h3>
            <ReactECharts
              ref={setChartRef(id)}
              option={chartConfigs[id]}
              style={{ height: '400px' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChartsTab; 