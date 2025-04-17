// Parse the input JSON
const data = JSON.parse(inputJsonStr);

function processTimeSeries(values) {
    // Process a series of values to get statistics
    return {
        values: values,  // Keep raw values for time series plotting
        stats: {
            average: Number((values.reduce((a, b) => a + b) / values.length).toFixed(2)),
            min: Number(Math.min(...values).toFixed(2)),
            max: Number(Math.max(...values).toFixed(2)),
            trend: Number((values[values.length - 1] - values[0]).toFixed(2))
        }
    };
}

function calculateAssetMetrics(assetData) {
    // Calculate metrics for an asset, keeping raw data for visualization
    const months = Object.keys(assetData.data);  // Convert to array to preserve order
    
    // Extract time series data
    const co2Values = [];
    const femalePercentages = [];
    const minorityPercentages = [];
    
    // Collect values across months
    months.forEach(month => {
        const monthData = assetData.data[month];
        co2Values.push(monthData.CO2_emission);
        femalePercentages.push(monthData.Board_Diversity.female_percentage);
        minorityPercentages.push(monthData.Board_Diversity.minority_percentage);
    });
    
    return {
        name: assetData.name,
        time_series: {
            time_points: months,
            metrics: {
                CO2_emission: processTimeSeries(co2Values),
                board_diversity: {
                    female_percentage: processTimeSeries(femalePercentages),
                    minority_percentage: processTimeSeries(minorityPercentages)
                }
            }
        }
    };
}

// Process each asset
const result = {
    fund_name: data.fund.name,
    analysis_period: "Q1",  // Assuming January-March is Q1
    assets_analysis: data.fund.assets.map(asset => calculateAssetMetrics(asset))
}; 