// Initialize CodeMirror editors
let editor = null;
let jsonEditor = null;
let jsonOutputEditor = null;
let configEditor = null;
let markdownEditor = null;
let currentChartId = null;

// Initialize ECharts instances
let co2Chart = null;
let diversityChart = null;

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
    if (tabId === 'charts' && co2Chart && diversityChart) {
        co2Chart.resize();
        diversityChart.resize();
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

// Add tab click event listeners
document.addEventListener('DOMContentLoaded', async () => {
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

    // Initialize markdown editor with template
    markdownEditor = CodeMirror.fromTextArea(document.getElementById('markdown-template'), {
        mode: "markdown",
        theme: "monokai",
        lineNumbers: true,
        matchBrackets: true,
        lineWrapping: true,
        viewportMargin: Infinity
    });

    // Function to refresh all editors
    const refreshEditors = () => {
        jsonEditor.refresh();
        editor.refresh();
        jsonOutputEditor.refresh();
        markdownEditor.refresh();
    };

    try {
        // Load markdown template from file
        const templateResponse = await fetch('report-template.md');
        if (!templateResponse.ok) {
            throw new Error(`HTTP error! status: ${templateResponse.status}`);
        }
        const templateContent = await templateResponse.text();
        markdownEditor.setValue(templateContent);

        // Load default code from transformer.js
        const response = await fetch('transformer.js');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const defaultCode = await response.text();
        editor.setValue(defaultCode);

        // Ensure all editors are properly refreshed
        setTimeout(refreshEditors, 100);

        // Auto-load JSON data and run code
        try {
            // Load JSON data
            await loadJSONData();
            
            // Wait a brief moment for the editor to update
            setTimeout(() => {
                // Run the code
                runJavaScript();
                // Refresh editors again after running
                refreshEditors();
            }, 100);
        } catch (error) {
            console.error('Error during auto-load:', error);
            document.getElementById('json-error').textContent = `Error auto-loading: ${error.message}`;
        }

        updateExecutionOutput('info', 'All editors initialized successfully');
    } catch (error) {
        updateExecutionOutput('error', `Error loading files: ${error.message}`);
    }

    // Add event listeners
    markdownEditor.on('change', () => {
        try {
            const jsonOutput = jsonOutputEditor.getValue();
            if (jsonOutput) {
                const data = JSON.parse(jsonOutput);
                updateReportPreview(data);
            }
        } catch (e) {
            console.error('Error updating report preview:', e);
        }
    });

    // Add tab click event listeners
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.getAttribute('data-tab'));
        });
    });

    // Add window resize handler
    window.addEventListener('resize', refreshEditors);

    // Initialize ECharts instances
    co2Chart = echarts.init(document.getElementById('co2Chart'));
    diversityChart = echarts.init(document.getElementById('diversityChart'));
});

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
    currentChartId = chartId;
    const chart = chartId === 'co2Chart' ? co2Chart : diversityChart;
    const config = chart.getOption();
    showConfigModal(`Export ${chartId} Configuration`);
    configEditor.setValue(JSON.stringify(config, null, 2));
}

// Function to import chart configuration
function importChartConfig(chartId) {
    currentChartId = chartId;
    showConfigModal(`Import ${chartId} Configuration`);
    configEditor.setValue('{\n  // Paste your ECharts configuration here\n}');
}

// Function to apply imported configuration
function applyConfig() {
    try {
        const config = JSON.parse(configEditor.getValue());
        const chart = currentChartId === 'co2Chart' ? co2Chart : diversityChart;
        
        // Preserve the data series while applying new configuration
        const currentData = chart.getOption().series.map(s => ({
            name: s.name,
            data: s.data
        }));

        // Apply new configuration
        chart.setOption(config, true);

        // Restore data series if needed
        if (config.series && Array.isArray(config.series)) {
            config.series.forEach((s, i) => {
                if (currentData[i]) {
                    s.data = currentData[i].data;
                }
            });
            chart.setOption({ series: config.series });
        }

        closeConfigModal();
    } catch (error) {
        alert('Invalid configuration: ' + error.message);
    }
}

// Function to download chart as image
function downloadChart(chartId, filename) {
    const chart = chartId === 'co2Chart' ? co2Chart : diversityChart;
    const url = chart.getDataURL({
        pixelRatio: 2,
        backgroundColor: '#fff'
    });
    
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Function to create/update charts
function updateCharts(data) {
    const assets = data.assets_analysis;
    const timePoints = assets[0].time_series.time_points;

    // CO2 Emissions Chart Configuration
    const co2Option = {
        title: {
            text: 'CO2 Emissions Over Time',
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        legend: {
            data: assets.map(a => a.name),
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '10%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: timePoints,
            boundaryGap: false
        },
        yAxis: {
            type: 'value',
            name: 'CO2 Emissions',
            axisLabel: {
                formatter: '{value}'
            }
        },
        series: assets.map(asset => ({
            name: asset.name,
            type: 'line',
            data: asset.time_series.metrics.CO2_emission.values,
            smooth: true,
            markPoint: {
                data: [
                    { type: 'max', name: 'Max' },
                    { type: 'min', name: 'Min' }
                ]
            },
            markLine: {
                data: [
                    { type: 'average', name: 'Average' }
                ]
            }
        }))
    };

    // Diversity Chart Configuration
    const diversityOption = {
        title: {
            text: 'Board Diversity Over Time',
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        legend: {
            data: assets.flatMap(a => [`${a.name} - Female %`, `${a.name} - Minority %`]),
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '10%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: timePoints,
            boundaryGap: false
        },
        yAxis: {
            type: 'value',
            name: 'Percentage',
            axisLabel: {
                formatter: '{value}%'
            }
        },
        series: assets.flatMap(asset => [
            {
                name: `${asset.name} - Female %`,
                type: 'line',
                data: asset.time_series.metrics.board_diversity.female_percentage.values,
                smooth: true,
                markLine: {
                    data: [
                        { type: 'average', name: 'Average' }
                    ]
                }
            },
            {
                name: `${asset.name} - Minority %`,
                type: 'line',
                data: asset.time_series.metrics.board_diversity.minority_percentage.values,
                smooth: true,
                lineStyle: {
                    type: 'dashed'
                },
                markLine: {
                    data: [
                        { type: 'average', name: 'Average' }
                    ]
                }
            }
        ])
    };

    // Set chart options
    co2Chart.setOption(co2Option);
    diversityChart.setOption(diversityOption);

    // Add chart images to the data object directly
    data.chart_images = {
        co2_emissions: co2Chart.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' }),
        diversity: diversityChart.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' })
    };
    
    // Update the output with the modified data including chart images
    jsonOutputEditor.setValue(JSON.stringify(data, null, 2));

    // Update the report preview with the complete data
    updateReportPreview(data);
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

// Handle window resize
window.addEventListener('resize', function() {
    co2Chart.resize();
    diversityChart.resize();
});