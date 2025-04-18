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

// Transform and analyze ESG data
function transformData(inputData) {
    try {
        // Parse input JSON if it's a string
        const data = typeof inputData === 'string' ? JSON.parse(inputData) : inputData;
        
        // Create result object with basic structure
        const result = {
            fund_name: data.fund_name,
            analysis_period: data.analysis_period,
            assets_analysis: []
        };

        // Process each asset
        result.assets_analysis = data.assets_analysis.map(asset => {
            // Calculate statistics for each metric
            const processedAsset = {
                name: asset.name,
                sector: asset.sector,
                time_series: {
                    time_points: asset.time_series.time_points,
                    metrics: {
                        environmental: {},
                        social: {},
                        governance: {}
                    }
                }
            };

            // Process environmental metrics
            const envMetrics = asset.time_series.metrics.environmental;
            processedAsset.time_series.metrics.environmental = {
                CO2_emission: calculateMetricStats(envMetrics.CO2_emission),
                water_usage: calculateMetricStats(envMetrics.water_usage),
                renewable_energy_percentage: calculateMetricStats(envMetrics.renewable_energy_percentage)
            };

            // Process social metrics
            const socialMetrics = asset.time_series.metrics.social;
            processedAsset.time_series.metrics.social = {
                board_diversity: {
                    female_percentage: calculateMetricStats(socialMetrics.board_diversity.female_percentage),
                    minority_percentage: calculateMetricStats(socialMetrics.board_diversity.minority_percentage)
                },
                employee_satisfaction: calculateMetricStats(socialMetrics.employee_satisfaction),
                pay_equity_ratio: calculateMetricStats(socialMetrics.pay_equity_ratio)
            };

            // Process governance metrics
            const govMetrics = asset.time_series.metrics.governance;
            processedAsset.time_series.metrics.governance = {
                board_independence: calculateMetricStats(govMetrics.board_independence),
                ethics_violations: calculateMetricStats(govMetrics.ethics_violations),
                cybersecurity_incidents: calculateMetricStats(govMetrics.cybersecurity_incidents)
            };

            return processedAsset;
        });

        // Add overall fund statistics
        result.fund_statistics = calculateFundStatistics(result.assets_analysis);

        return result;
    } catch (error) {
        throw new Error(`Error transforming data: ${error.message}`);
    }
}

// Helper function to calculate metric statistics
function calculateMetricStats(metric) {
    if (!metric || !metric.values) {
        throw new Error('Invalid metric data: missing values');
    }

    const values = metric.values;
    const stats = {
        current: values[values.length - 1],
        previous: values[values.length - 2],
        min: Math.min(...values),
        max: Math.max(...values),
        average: metric.stats.average,
        trend: metric.stats.trend,
        year_over_year_change: metric.stats.year_over_year_change,
        unit: metric.unit || ''
    };

    return {
        values: values,
        unit: metric.unit || '',
        stats: stats
    };
}

// Calculate overall fund statistics
function calculateFundStatistics(assets) {
    const stats = {
        environmental: {
            average_co2_reduction: calculateAverageMetricChange(assets, 'environmental.CO2_emission'),
            average_water_reduction: calculateAverageMetricChange(assets, 'environmental.water_usage'),
            average_renewable_increase: calculateAverageMetricChange(assets, 'environmental.renewable_energy_percentage')
        },
        social: {
            average_diversity_improvement: {
                female: calculateAverageMetricChange(assets, 'social.board_diversity.female_percentage'),
                minority: calculateAverageMetricChange(assets, 'social.board_diversity.minority_percentage')
            },
            average_satisfaction_change: calculateAverageMetricChange(assets, 'social.employee_satisfaction'),
            average_pay_equity_improvement: calculateAverageMetricChange(assets, 'social.pay_equity_ratio')
        },
        governance: {
            average_board_independence_change: calculateAverageMetricChange(assets, 'governance.board_independence'),
            total_ethics_violations_reduction: calculateAverageMetricChange(assets, 'governance.ethics_violations'),
            total_cybersecurity_incidents_reduction: calculateAverageMetricChange(assets, 'governance.cybersecurity_incidents')
        }
    };

    return stats;
}

// Helper function to calculate average metric change across assets
function calculateAverageMetricChange(assets, metricPath) {
    try {
        const changes = assets.map(asset => {
            const metric = metricPath.split('.').reduce((obj, key) => obj && obj[key], asset.time_series.metrics);
            if (!metric || !metric.stats || typeof metric.stats.year_over_year_change !== 'number') {
                throw new Error(`Invalid metric data for path: ${metricPath}`);
            }
            return metric.stats.year_over_year_change;
        });
        
        return changes.reduce((sum, change) => sum + change, 0) / changes.length;
    } catch (error) {
        console.error(`Error calculating average change for ${metricPath}:`, error);
        return 0;
    }
}

// Process the input data and return the result
const result = transformData(inputJsonStr);
return result; 