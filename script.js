// Initialize CodeMirror editors
let editor = null;
let jsonEditor = null;
let jsonOutputEditor = null;
let configEditor = null;
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

    // Store the current data in the window object for ECharts Studio access
    window.chartData = {
        timePoints: timePoints,
        assets: assets
    };

    // Add chart images to output
    const outputData = JSON.parse(jsonOutputEditor.getValue());
    outputData.chart_images = {
        co2_emissions: co2Chart.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' }),
        diversity: diversityChart.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' })
    };
    
    jsonOutputEditor.setValue(JSON.stringify(outputData, null, 2));
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

        // Update charts with the new data
        const outputData = JSON.parse(stdout);
        updateCharts(outputData);

    } catch (error) {
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

    // Initialize ECharts instances
    co2Chart = echarts.init(document.getElementById('co2Chart'));
    diversityChart = echarts.init(document.getElementById('diversityChart'));

    // Initialize Pyodide
    initPyodide();

    // Handle window resize
    window.addEventListener('resize', function() {
        co2Chart.resize();
        diversityChart.resize();
    });
}); 