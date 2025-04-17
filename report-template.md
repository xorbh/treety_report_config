# {{ fund_name }} - ESG Analysis Report
## Analysis Period: {{ analysis_period }}

### CO2 Emissions Analysis
![CO2 Emissions Chart]({{ chart_images.co2_emissions }})

#### Key Findings
{% for asset in assets_analysis %}
- **{{ asset.name }}**
  - Average CO2 Emissions: {{ asset.time_series.metrics.CO2_emission.stats.average }}
  - Trend: {{ asset.time_series.metrics.CO2_emission.stats.trend }}
{% endfor %}

### Board Diversity Analysis
![Diversity Chart]({{ chart_images.diversity }})

#### Key Metrics

| Company | Female % (Avg) | Minority % (Avg) | Trend (Female) | Trend (Minority) |
|---------|---------------|-----------------|----------------|------------------|
{% for asset in assets_analysis %}| {{ asset.name }} | {{ asset.time_series.metrics.board_diversity.female_percentage.stats.average }}% | {{ asset.time_series.metrics.board_diversity.minority_percentage.stats.average }}% | {{ asset.time_series.metrics.board_diversity.female_percentage.stats.trend }}% | {{ asset.time_series.metrics.board_diversity.minority_percentage.stats.trend }}% |
{% endfor %}

### Summary
This report provides an analysis of ESG metrics for {{ fund_name }} during {{ analysis_period }}. The data shows trends in both environmental impact (CO2 emissions) and social governance (board diversity). 