// Initialize CodeMirror editors
let editor = null;
let jsonEditor = null;
let jsonOutputEditor = null;
let configEditor = null;
let markdownEditor = null;
let currentChartId = null;

// Chart instances
let environmentalChart = null;
let socialChart = null;
let radarChart = null;
let gaugeChart = null;
let timelineChart = null;

// Tab Functionality
function switchTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Deactivate all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content and activate tab
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    // Resize charts if switching to charts tab
    if (tabId === 'charts') {
        if (environmentalChart) environmentalChart.resize();
        if (socialChart) socialChart.resize();
        if (radarChart) radarChart.resize();
        if (gaugeChart) gaugeChart.resize();
        if (timelineChart) timelineChart.resize();
    }

    // Update report preview if switching to report tab
    if (tabId === 'report') {
        try {
            const jsonOutput = jsonOutputEditor.getValue();
            if (jsonOutput) {
                const data = JSON.parse(jsonOutput);
                updateReportPreview(data);
            }
        } catch (e) {
            console.error('Error updating report preview:', e);
        }
    }
}

// Initialize charts when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize editors
    initializeEditors();
    
    // Initialize charts
    initializeCharts();
    
    // Add tab click event listeners
    initializeTabListeners();
    
    // Load initial data
    await loadInitialData();
});

// Function to initialize editors
function initializeEditors() {
    // Initialize JSON input editor
    jsonEditor = CodeMirror.fromTextArea(document.getElementById('json-input'), {
        mode: { name: "javascript", json: true },
        theme: "monokai",
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        extraKeys: {"Tab": "indentMore"},
        lineWrapping: true
    });

    // Initialize JavaScript code editor
    editor = CodeMirror.fromTextArea(document.getElementById('code'), {
        mode: "javascript",
        theme: "monokai",
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        extraKeys: {"Tab": "indentMore"},
        lineWrapping: true
    });

    // Initialize JSON output editor
    jsonOutputEditor = CodeMirror.fromTextArea(document.getElementById('json-output'), {
        mode: { name: "javascript", json: true },
        theme: "monokai",
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        extraKeys: {"Tab": "indentMore"},
        lineWrapping: true,
        readOnly: true
    });

    // Initialize markdown editor
    markdownEditor = CodeMirror.fromTextArea(document.getElementById('markdown-template'), {
        mode: "markdown",
        theme: "monokai",
        lineNumbers: true,
        matchBrackets: true,
        lineWrapping: true,
        viewportMargin: Infinity
    });
}

// Function to initialize charts
function initializeCharts() {
    if (!document.getElementById('environmentalChart')) {
        console.error('Chart containers not found in DOM');
        return;
    }

    try {
        environmentalChart = echarts.init(document.getElementById('environmentalChart'));
        socialChart = echarts.init(document.getElementById('socialChart'));
        radarChart = echarts.init(document.getElementById('radarChart'));
        gaugeChart = echarts.init(document.getElementById('gaugeChart'));
        timelineChart = echarts.init(document.getElementById('timelineChart'));
        console.log('All charts initialized successfully');
    } catch (error) {
        console.error('Error initializing charts:', error);
        updateExecutionOutput('error', `Error initializing charts: ${error.message}`);
    }
}

// Function to handle chart resizing
function resizeCharts() {
    const charts = [environmentalChart, socialChart, radarChart, gaugeChart, timelineChart];
    charts.forEach(chart => {
        if (chart) {
            try {
                chart.resize();
            } catch (error) {
                console.error('Error resizing chart:', error);
            }
        }
    });
}

// Function to initialize tab listeners
function initializeTabListeners() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.getAttribute('data-tab'));
        });
    });
}

// Function to load initial data
async function loadInitialData() {
    try {
        // Load markdown template
        const templateResponse = await fetch('report-template.md');
        if (templateResponse.ok) {
            const templateContent = await templateResponse.text();
            markdownEditor.setValue(templateContent);
        }

        // Load default code
        const codeResponse = await fetch('transformer.js');
        if (codeResponse.ok) {
            const defaultCode = await codeResponse.text();
            editor.setValue(defaultCode);
        }

        // Refresh editors
        setTimeout(() => {
            jsonEditor.refresh();
            editor.refresh();
            jsonOutputEditor.refresh();
            markdownEditor.refresh();
        }, 100);

        // Auto-load JSON data and run code
        await loadJSONData();
        setTimeout(() => {
            runJavaScript();
        }, 100);

        updateExecutionOutput('info', 'All editors and charts initialized successfully');
    } catch (error) {
        updateExecutionOutput('error', `Error loading initial data: ${error.message}`);
    }
}

// AWS Configuration
AWS.config.update({
    region: 'us-east-1', // Replace with your region
    credentials: new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'YOUR_IDENTITY_POOL_ID' // Replace with your Identity Pool ID
    })
});

const s3 = new AWS.S3();

// Function to validate JSON
function isValidJSON(str) {
    try {
        JSON.parse(str);
        return { valid: true, error: null };
    } catch (e) {
        return { valid: false, error: e.message };
    }
}

// Function to format JSON string
function formatJSON(str) {
    try {
        return JSON.stringify(JSON.parse(str), null, 2);
    } catch (e) {
        return str;
    }
}

// Function to show configuration modal
function showConfigModal(title) {
    const modal = document.getElementById('configModal');
    document.getElementById('modalTitle').textContent = title;
    modal.style.display = 'block';

    if (!configEditor) {
        configEditor = CodeMirror(document.getElementById('configEditor'), {
            mode: { name: "javascript", json: true },
            theme: "monokai",
            lineNumbers: true,
            matchBrackets: true,
            autoCloseBrackets: true,
            extraKeys: {"Tab": "indentMore"},
            lineWrapping: true
        });
    }
}

// Function to close configuration modal
function closeConfigModal() {
    document.getElementById('configModal').style.display = 'none';
}

// Function to export chart configuration
function exportChartConfig(chartId) {
    const chart = getChartInstance(chartId);
    if (!chart) {
        console.error(`Chart ${chartId} not found`);
        return;
    }

    const config = chart.getOption();
    const configStr = JSON.stringify(config, null, 2);
    
    // Create and trigger download
    const blob = new Blob([configStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chartId}-config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Function to import chart configuration
function importChartConfig(chartId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const config = JSON.parse(e.target.result);
                showConfigModal(chartId, config);
            } catch (error) {
                console.error('Error parsing configuration file:', error);
                alert('Invalid configuration file');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

// Function to apply imported configuration
function applyConfig() {
    const modal = document.getElementById('configModal');
    const chartId = modal.dataset.chartId;
    const textarea = modal.querySelector('textarea');
    
    try {
        const config = JSON.parse(textarea.value);
        const chart = getChartInstance(chartId);
        if (chart) {
            chart.setOption(config);
            closeConfigModal();
        } else {
            throw new Error(`Chart ${chartId} not found`);
        }
    } catch (error) {
        console.error('Error applying configuration:', error);
        alert('Invalid configuration format');
    }
}

// Function to download chart as image
function downloadChart(chartId, filename) {
    const chart = getChartInstance(chartId);
    if (!chart) {
        console.error(`Chart ${chartId} not found`);
        return;
    }

    const url = chart.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#fff'
    });

    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename || chartId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Add window resize handler
window.addEventListener('resize', () => {
    if (document.getElementById('charts').classList.contains('active')) {
        resizeCharts();
    }
});

function updateCharts(data) {
    try {
        // Initialize chart options
        const environmentalOption = createEnvironmentalOption(data);
        const socialOption = createSocialOption(data);
        const radarOption = createRadarOption(data);
        const gaugeOption = createGaugeOption(data);
        const timelineOption = createTimelineOption(data);

        // Set chart options with null checks
        if (environmentalChart) environmentalChart.setOption(environmentalOption);
        if (socialChart) socialChart.setOption(socialOption);
        if (radarChart) radarChart.setOption(radarOption);
        if (gaugeChart) gaugeChart.setOption(gaugeOption);
        if (timelineChart) timelineChart.setOption(timelineOption);

        // Add chart images to the data object with null checks
        data.chart_images = {
            environmental: environmentalChart ? environmentalChart.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' }) : null,
            social: socialChart ? socialChart.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' }) : null,
            radar: radarChart ? radarChart.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' }) : null,
            gauge: gaugeChart ? gaugeChart.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' }) : null,
            timeline: timelineChart ? timelineChart.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' }) : null
        };

        return data;
    } catch (error) {
        console.error('Error updating charts:', error);
        updateExecutionOutput('error', `Error updating charts: ${error.message}`);
        throw error;
    }
}

// Function to create chart containers
function createChartContainers() {
    const chartsContainer = document.getElementById('charts');
    if (!chartsContainer) return;

    const chartConfigs = [
        { id: 'environmentalChart', title: 'Environmental Metrics' },
        { id: 'socialChart', title: 'Social Metrics' },
        { id: 'radarChart', title: 'ESG Overview' },
        { id: 'gaugeChart', title: 'Governance Status' },
        { id: 'timelineChart', title: 'Timeline View' }
    ];

    chartConfigs.forEach(config => {
        const container = document.createElement('div');
        container.className = 'chart-container';
        
        const title = document.createElement('h3');
        title.textContent = config.title;
        container.appendChild(title);

        const chartDiv = document.createElement('div');
        chartDiv.id = config.id;
        chartDiv.className = 'chart';
        container.appendChild(chartDiv);

        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'Download';
        downloadBtn.onclick = () => downloadChart(config.id, `${config.id}.png`);
        container.appendChild(downloadBtn);

        const exportBtn = document.createElement('button');
        exportBtn.textContent = 'Export Config';
        exportBtn.onclick = () => exportChartConfig(config.id);
        container.appendChild(exportBtn);

        chartsContainer.appendChild(container);
    });
}

// Function to update the report preview
function updateReportPreview(data) {
    if (!data) {
        console.error('No data provided to updateReportPreview');
        return;
    }

    // Get the template from the editor
    const template = markdownEditor.getValue();
    
    try {
        // First render the template
        const renderedTemplate = renderTemplate(template, data);
        
        // Then convert markdown to HTML
        const htmlContent = marked.parse(renderedTemplate, {
            gfm: true,
            breaks: true,
            tables: true
        });
        
        // Update the preview
        const previewElement = document.querySelector('#report-preview .preview-content');
        if (previewElement) {
            previewElement.innerHTML = htmlContent;
            
            // Fix table formatting
            const tables = previewElement.getElementsByTagName('table');
            for (const table of tables) {
                if (!table.classList.contains('formatted')) {
                    table.classList.add('formatted');
                }
            }

            // Handle images
            const images = previewElement.getElementsByTagName('img');
            for (const img of images) {
                if (img.src.startsWith('data:image')) {
                    img.style.display = 'block';
                    img.style.maxWidth = '100%';
                    img.style.margin = '10px auto';
                }
            }
        }
    } catch (error) {
        console.error('Error rendering template:', error);
        const previewElement = document.querySelector('#report-preview .preview-content');
        if (previewElement) {
            previewElement.innerHTML = `<div class="error">Error rendering template: ${error.message}</div>`;
        }
    }
}

// Function to render the markdown template with data
function renderTemplate(template, data) {
    if (!template || !data) {
        console.error('Missing template or data:', { template: !!template, data: !!data });
        return '';
    }

    console.log('Rendering template with data:', data); // Debug log
    
    try {
        // Simple template engine
        let rendered = template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, p1) => {
            const path = p1.trim();
            const value = path.split('.').reduce((obj, key) => obj?.[key], data);
            console.log(`Replacing ${match} with:`, value); // Debug log
            return value !== undefined ? value : match;
        });

        // Handle for loops
        rendered = rendered.replace(/\{%\s*for\s+(\w+)\s+in\s+([^%]+)\s*%\}([\s\S]+?)\{%\s*endfor\s*%\}/g, (match, varName, collection, content) => {
            const collectionPath = collection.trim();
            const items = collectionPath.split('.').reduce((obj, key) => obj?.[key], data);
            console.log(`Processing for loop - ${varName} in:`, items); // Debug log
            
            if (!Array.isArray(items)) {
                console.error(`Collection ${collectionPath} is not an array:`, items);
                return '';
            }
            
            return items.map(item => {
                const itemData = { ...data, [varName]: item };
                return renderTemplate(content, itemData);
            }).join('\n');
        });

        // Handle if conditions with expressions
        rendered = rendered.replace(/\{%\s*if\s+([^%]+)\s*%\}([\s\S]+?)\{%\s*endif\s*%\}/g, (match, condition, content) => {
            try {
                // Create a function that evaluates the condition with the data context
                const conditionFn = new Function('data', `
                    with (data) {
                        try {
                            return ${condition};
                        } catch (e) {
                            return false;
                        }
                    }
                `);
                const result = conditionFn(data);
                console.log(`Evaluating condition ${condition}:`, result); // Debug log
                return result ? content : '';
            } catch (error) {
                console.error('Error in if condition:', error);
                return '';
            }
        });

        // Handle ternary expressions
        rendered = rendered.replace(/\{\{\s*([^}]+\?[^}]+:[^}]+)\s*\}\}/g, (match, expr) => {
            try {
                const [condition, values] = expr.split('?').map(s => s.trim());
                const [trueValue, falseValue] = values.split(':').map(s => s.trim());
                
                // Create a function that evaluates the condition with the data context
                const conditionFn = new Function('data', `
                    with (data) {
                        try {
                            return ${condition};
                        } catch (e) {
                            return false;
                        }
                    }
                `);
                const result = conditionFn(data);
                return result ? trueValue : falseValue;
            } catch (error) {
                console.error('Error in ternary expression:', error);
                return match;
            }
        });

        return rendered;
    } catch (error) {
        console.error('Error in template rendering:', error);
        return `Error: ${error.message}`;
    }
}

// Function to update execution output
function updateExecutionOutput(type, message) {
    const outputArea = document.getElementById('execution-output');
    const errorDiv = document.getElementById('execution-error');
    const infoDiv = document.getElementById('execution-info');
    const successDiv = document.getElementById('execution-success');

    // Clear previous messages
    errorDiv.textContent = '';
    infoDiv.textContent = '';
    successDiv.textContent = '';

    // Add new message to appropriate div
    switch(type) {
        case 'error':
            errorDiv.textContent = message;
            break;
        case 'info':
            infoDiv.textContent = message;
            break;
        case 'success':
            successDiv.textContent = message;
            break;
    }

    // Show output area if there's content
    outputArea.style.display = message ? 'block' : 'none';
}

// Update the runJavaScript function to use the new output area
function runJavaScript() {
    try {
        // Get the input JSON
        const inputJsonStr = jsonEditor.getValue();
        const { valid, error } = isValidJSON(inputJsonStr);
        
        if (!valid) {
            updateExecutionOutput('error', 'Invalid JSON: ' + error);
            return;
        }

        // Create a function from the code and pass the input JSON as a string
        const code = editor.getValue();
        const wrappedCode = `
            (function() {
                try {
                    const inputJsonStr = ${JSON.stringify(inputJsonStr)};
                    ${code}
                    return result;
                } catch(e) {
                    throw new Error('Execution error: ' + e.message);
                }
            })
        `;

        // Execute the code
        const result = eval(wrappedCode)();
        
        // Update the output
        if (result !== undefined) {
            jsonOutputEditor.setValue(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
            updateExecutionOutput('success', 'Code executed successfully');
        }
        
        // Try to parse the output for charts
        try {
            const outputData = JSON.parse(jsonOutputEditor.getValue());
            updateCharts(outputData);
            updateReportPreview(outputData);
        } catch (e) {
            updateExecutionOutput('error', 'Error updating visualizations: ' + e.message);
        }
    } catch (e) {
        updateExecutionOutput('error', e.message);
    }
}

// Update loadJSONData to use the new output area
async function loadJSONData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        jsonEditor.setValue(JSON.stringify(data, null, 2));
        updateExecutionOutput('success', 'JSON data loaded successfully');
    } catch (error) {
        updateExecutionOutput('error', `Error loading JSON data: ${error.message}`);
    }
}

async function uploadToS3(chartId, filename) {
    try {
        const chart = echarts.getInstanceByDom(document.getElementById(chartId));
        const dataUrl = chart.getDataURL();
        
        // Convert base64 to binary
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        
        const params = {
            Bucket: 'YOUR_BUCKET_NAME', // Replace with your bucket name
            Key: `charts/${filename}-${Date.now()}.png`,
            Body: buffer,
            ContentType: 'image/png',
            ACL: 'public-read' // Make the file publicly accessible
        };
        
        const result = await s3.upload(params).promise();
        console.log('Successfully uploaded to S3:', result.Location);
        alert(`Chart uploaded successfully! URL: ${result.Location}`);
    } catch (error) {
        console.error('Error uploading to S3:', error);
        alert('Error uploading chart to S3. Please check the console for details.');
    }
}

// Helper function to normalize values to 0-100 scale
function normalizeValue(value, min, max) {
    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function createEnvironmentalOption(data) {
    if (!data?.assets_analysis?.length) throw new Error('Invalid data for environmental chart');
    
    const assets = data.assets_analysis;
    const timePoints = assets[0].time_series.time_points;

    return {
        title: {
            text: 'Environmental Metrics Over Time',
            left: 'center',
            top: 0,
            textStyle: { fontSize: 16 }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' }
        },
        legend: {
            data: assets.flatMap(a => [
                `${a.name} - CO2`,
                `${a.name} - Water`,
                `${a.name} - Renewable %`
            ]),
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: timePoints,
            boundaryGap: false
        },
        yAxis: [
            {
                type: 'value',
                name: 'CO2 & Water',
                position: 'left'
            },
            {
                type: 'value',
                name: 'Renewable %',
                position: 'right',
                offset: 80,
                max: 100,
                min: 0
            }
        ],
        series: assets.flatMap(asset => [
            {
                name: `${asset.name} - CO2`,
                type: 'line',
                data: asset.time_series.metrics.environmental.CO2_emission.values,
                smooth: true,
                yAxisIndex: 0
            },
            {
                name: `${asset.name} - Water`,
                type: 'line',
                data: asset.time_series.metrics.environmental.water_usage.values,
                smooth: true,
                yAxisIndex: 0
            },
            {
                name: `${asset.name} - Renewable %`,
                type: 'line',
                data: asset.time_series.metrics.environmental.renewable_energy_percentage.values,
                smooth: true,
                yAxisIndex: 1
            }
        ])
    };
}

function createSocialOption(data) {
    if (!data?.assets_analysis?.length) throw new Error('Invalid data for social chart');
    
    const assets = data.assets_analysis;
    const timePoints = assets[0].time_series.time_points;

    return {
        title: {
            text: 'Social Metrics Over Time',
            left: 'center',
            top: 0,
            textStyle: { fontSize: 16 }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' }
        },
        legend: {
            data: assets.flatMap(a => [
                `${a.name} - Female %`,
                `${a.name} - Minority %`,
                `${a.name} - Satisfaction`,
                `${a.name} - Pay Equity`
            ]),
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: timePoints,
            boundaryGap: false
        },
        yAxis: [
            {
                type: 'value',
                name: 'Percentage',
                min: 0,
                max: 100
            },
            {
                type: 'value',
                name: 'Score',
                min: 0,
                max: 10,
                position: 'right'
            }
        ],
        series: assets.flatMap(asset => [
            {
                name: `${asset.name} - Female %`,
                type: 'line',
                data: asset.time_series.metrics.social.board_diversity.female_percentage.values,
                smooth: true,
                yAxisIndex: 0
            },
            {
                name: `${asset.name} - Minority %`,
                type: 'line',
                data: asset.time_series.metrics.social.board_diversity.minority_percentage.values,
                smooth: true,
                yAxisIndex: 0
            },
            {
                name: `${asset.name} - Satisfaction`,
                type: 'line',
                data: asset.time_series.metrics.social.employee_satisfaction.values,
                smooth: true,
                yAxisIndex: 1
            },
            {
                name: `${asset.name} - Pay Equity`,
                type: 'line',
                data: asset.time_series.metrics.social.pay_equity_ratio.values.map(v => v * 100),
                smooth: true,
                yAxisIndex: 0
            }
        ])
    };
}

function createRadarOption(data) {
    if (!data?.assets_analysis?.length) throw new Error('Invalid data for radar chart');
    
    const assets = data.assets_analysis;

    return {
        title: {
            text: 'ESG Performance Overview',
            left: 'center'
        },
        tooltip: {
            trigger: 'item'
        },
        legend: {
            data: assets.map(a => a.name),
            bottom: 0
        },
        radar: {
            indicator: [
                { name: 'CO2 Reduction', max: 100 },
                { name: 'Water Usage', max: 100 },
                { name: 'Renewable Energy', max: 100 },
                { name: 'Board Diversity', max: 100 },
                { name: 'Employee Satisfaction', max: 100 },
                { name: 'Governance Score', max: 100 }
            ]
        },
        series: [{
            type: 'radar',
            data: assets.map(asset => ({
                value: [
                    normalizeValue(asset.time_series.metrics.environmental.CO2_emission.stats.year_over_year_change, -30, 0),
                    normalizeValue(asset.time_series.metrics.environmental.water_usage.stats.year_over_year_change, -20, 0),
                    asset.time_series.metrics.environmental.renewable_energy_percentage.values[asset.time_series.metrics.environmental.renewable_energy_percentage.values.length - 1],
                    (asset.time_series.metrics.social.board_diversity.female_percentage.values[asset.time_series.metrics.social.board_diversity.female_percentage.values.length - 1] +
                     asset.time_series.metrics.social.board_diversity.minority_percentage.values[asset.time_series.metrics.social.board_diversity.minority_percentage.values.length - 1]) / 2,
                    asset.time_series.metrics.social.employee_satisfaction.values[asset.time_series.metrics.social.employee_satisfaction.values.length - 1] * 10,
                    asset.time_series.metrics.governance.board_independence.values[asset.time_series.metrics.governance.board_independence.values.length - 1]
                ],
                name: asset.name,
                areaStyle: {
                    opacity: 0.3
                }
            }))
        }]
    };
}

function createGaugeOption(data) {
    if (!data?.assets_analysis?.length) throw new Error('Invalid data for gauge chart');
    
    const assets = data.assets_analysis;

    return {
        title: {
            text: 'Current Governance Status',
            left: 'center'
        },
        tooltip: {
            formatter: '{b}: {c}%'
        },
        series: assets.flatMap(asset => [
            {
                type: 'gauge',
                startAngle: 180,
                endAngle: 0,
                min: 0,
                max: 100,
                splitNumber: 8,
                axisLine: {
                    lineStyle: {
                        width: 6,
                        color: [
                            [0.25, '#FF6E76'],
                            [0.5, '#FDDD60'],
                            [0.75, '#58D9F9'],
                            [1, '#7CFFB2']
                        ]
                    }
                },
                pointer: {
                    icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
                    length: '12%',
                    width: 20,
                    offsetCenter: [0, '-60%'],
                    itemStyle: {
                        color: 'auto'
                    }
                },
                axisTick: {
                    length: 12,
                    lineStyle: {
                        color: 'auto',
                        width: 2
                    }
                },
                splitLine: {
                    length: 20,
                    lineStyle: {
                        color: 'auto',
                        width: 5
                    }
                },
                title: {
                    offsetCenter: [0, '-20%'],
                    fontSize: 14
                },
                detail: {
                    fontSize: 16,
                    offsetCenter: [0, '0%'],
                    valueAnimation: true,
                    formatter: '{value}%',
                    color: 'auto'
                },
                data: [{
                    value: asset.time_series.metrics.governance.board_independence.values[asset.time_series.metrics.governance.board_independence.values.length - 1],
                    name: asset.name + '\nBoard Independence'
                }]
            }
        ])
    };
}

function createTimelineOption(data) {
    if (!data?.assets_analysis?.length) throw new Error('Invalid data for timeline chart');
    
    const assets = data.assets_analysis;
    const timePoints = assets[0].time_series.time_points;

    return {
        title: {
            text: 'Ethics & Security Incidents',
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        legend: {
            data: ['Ethics Violations', 'Cybersecurity Incidents'],
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: timePoints
        },
        yAxis: {
            type: 'value',
            name: 'Number of Incidents'
        },
        series: assets.flatMap(asset => [
            {
                name: 'Ethics Violations',
                type: 'bar',
                stack: asset.name,
                data: asset.time_series.metrics.governance.ethics_violations.values
            },
            {
                name: 'Cybersecurity Incidents',
                type: 'bar',
                stack: asset.name,
                data: asset.time_series.metrics.governance.cybersecurity_incidents.values
            }
        ])
    };
}

// Event handlers for chart configuration buttons
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners for all chart config buttons
    document.querySelectorAll('.chart-config-btn').forEach(button => {
        button.addEventListener('click', function() {
            const action = this.dataset.action;
            const chartId = this.dataset.chart;
            const filename = this.dataset.filename;

            switch(action) {
                case 'export':
                    exportChartConfig(chartId);
                    break;
                case 'import':
                    importChartConfig(chartId);
                    break;
                case 'download':
                    downloadChart(chartId, filename);
                    break;
            }
        });
    });

    // Modal close button
    document.querySelector('.close-modal').addEventListener('click', closeConfigModal);

    // Apply config button
    document.querySelector('.apply-config').addEventListener('click', applyConfig);
});

function getChartInstance(chartId) {
    switch(chartId) {
        case 'environmentalChart':
            return environmentalChart;
        case 'socialChart':
            return socialChart;
        case 'radarChart':
            return radarChart;
        case 'gaugeChart':
            return gaugeChart;
        case 'timelineChart':
            return timelineChart;
        default:
            return null;
    }
}