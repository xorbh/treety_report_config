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

// Initialize Pyodide
let pyodide;

// AWS Configuration
AWS.config.update({
    region: 'us-east-1', // Replace with your region
    credentials: new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'YOUR_IDENTITY_POOL_ID' // Replace with your Identity Pool ID
    })
});

const s3 = new AWS.S3();

async function initPyodide() {
    pyodide = await loadPyodide();
    console.log("Pyodide loaded!");
}

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

    console.log('Updating report preview with data:', data); // Debug log
    
    // Get the template from the editor
    const template = markdownEditor.getValue();
    console.log('Template:', template); // Debug log
    
    try {
        // First render the template
        const renderedTemplate = renderTemplate(template, data);
        console.log('Rendered template:', renderedTemplate); // Debug log
        
        // Then convert markdown to HTML with proper table support
        const htmlContent = marked.parse(renderedTemplate, {
            gfm: true, // Enable GitHub Flavored Markdown
            breaks: true, // Enable line breaks
            tables: true // Enable tables
        });
        console.log('Parsed HTML:', htmlContent); // Debug log
        
        // Update the preview
        const previewElement = document.getElementById('report-preview');
        if (previewElement) {
            previewElement.innerHTML = htmlContent;
            
            // Fix table formatting
            const tables = previewElement.getElementsByTagName('table');
            for (const table of tables) {
                if (!table.classList.contains('formatted')) {
                    table.classList.add('formatted');
                    const rows = table.getElementsByTagName('tr');
                    for (const row of rows) {
                        const cells = row.children;
                        for (const cell of cells) {
                            if (cell.textContent.trim() === '') {
                                cell.innerHTML = '&nbsp;';
                            }
                        }
                    }
                }
            }
        } else {
            console.error('Preview element not found');
        }
    } catch (error) {
        console.error('Error rendering template:', error);
        const previewElement = document.getElementById('report-preview');
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

// Function to run Python code
async function runPython() {
    if (!pyodide) {
        console.log("Pyodide is still loading...");
        return;
    }

    const code = editor.getValue();
    const jsonInput = jsonEditor.getValue();
    const jsonError = document.getElementById("json-error");
    const executionError = document.getElementById("execution-error");
    
    // Clear previous errors
    jsonError.textContent = "";
    executionError.textContent = "";
    
    // Validate JSON
    const jsonValidation = isValidJSON(jsonInput);
    if (!jsonValidation.valid) {
        jsonError.textContent = `Invalid JSON: ${jsonValidation.error}`;
        return;
    }

    try {
        // Redirect stdout to capture print statements
        pyodide.runPython(`
            import sys
            import json
            from io import StringIO
            sys.stdout = StringIO()
        `);

        // Make the JSON string available to Python
        pyodide.globals.set('input_json_str', jsonInput);
        
        // Run the actual code
        await pyodide.runPythonAsync(code);
        
        // Get the captured output
        const stdout = pyodide.runPython("sys.stdout.getvalue()");
        
        // Reset stdout
        pyodide.runPython("sys.stdout = sys.__stdout__");

        // Try to parse the output as JSON and format it
        const formattedOutput = formatJSON(stdout);
        jsonOutputEditor.setValue(formattedOutput);

        // Parse the output data
        const outputData = JSON.parse(stdout);
        console.log('Parsed output data:', outputData); // Debug log

        // Update charts with the new data
        updateCharts(outputData);
        
        // Update report preview with the new data
        updateReportPreview(outputData);

    } catch (error) {
        console.error('Error in runPython:', error); // Debug log
        executionError.textContent = `Error: ${error.message}`;
        jsonOutputEditor.setValue("");
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

// Initialize everything when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize CodeMirror editors
    editor = CodeMirror.fromTextArea(document.getElementById("code"), {
        mode: "python",
        theme: "monokai",
        lineNumbers: true,
        indentUnit: 4,
        matchBrackets: true,
        autoCloseBrackets: true,
        extraKeys: {"Tab": "indentMore"}
    });

    jsonEditor = CodeMirror.fromTextArea(document.getElementById("json-input"), {
        mode: { name: "javascript", json: true },
        theme: "monokai",
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        extraKeys: {"Tab": "indentMore"}
    });

    jsonOutputEditor = CodeMirror.fromTextArea(document.getElementById("json-output"), {
        mode: { name: "javascript", json: true },
        theme: "monokai",
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        readOnly: true
    });

    markdownEditor = CodeMirror.fromTextArea(document.getElementById("markdown-template"), {
        mode: "markdown",
        theme: "monokai",
        lineNumbers: true,
        lineWrapping: true,
        extraKeys: {"Tab": "indentMore"}
    });

    // Add change listener to markdown editor
    markdownEditor.on('change', () => {
        try {
            const outputValue = jsonOutputEditor.getValue();
            if (outputValue && outputValue.trim() !== '') {
                const data = JSON.parse(outputValue);
                updateReportPreview(data);
            }
        } catch (error) {
            console.error('Error updating preview:', error);
        }
    });

    // Initialize ECharts instances
    co2Chart = echarts.init(document.getElementById('co2Chart'));
    diversityChart = echarts.init(document.getElementById('diversityChart'));

    // Initialize Pyodide
    initPyodide().then(() => {
        // Run the code once Pyodide is loaded to generate initial data
        runPython().catch(console.error);
    });

    // Handle window resize
    window.addEventListener('resize', function() {
        co2Chart.resize();
        diversityChart.resize();
    });
}); 