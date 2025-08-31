# ----------------------------------------------------------------------------
# world_population_analysis.py
# ----------------------------------------------------------------------------
#
# This script performs a comprehensive analysis of world population data.
# It includes:
#   1. Loading and preprocessing of population and geospatial data.
#   2. Creation of an interactive choropleth map to visualize population.
#   3. Hotspot analysis using DBSCAN clustering to find dense regions.
#   4. Generation of an interactive time-series plot of population by continent.
#
# ----------------------------------------------------------------------------

import pandas as pd
import geopandas as gpd
import folium
import plotly.express as px
from sklearn.cluster import DBSCAN
import numpy as np
from pycountry_convert import country_alpha2_to_continent_code, country_name_to_country_alpha2
import os

# --- Configuration & Constants ---

# Input file paths
POPULATION_CSV_PATH = "data/world_population.csv"
GEOJSON_PATH = "data/world-countries.json"

# Output file paths
OUTPUT_DIR = "output"
CHOROPLETH_MAP_HTML = os.path.join(OUTPUT_DIR, "world_population_map.html")
TIME_SERIES_HTML = os.path.join(OUTPUT_DIR, "population_over_time.html")

# Analysis parameters
# Find the most recent year with population data from column names
# We assume columns are like '1960', '1961', ..., '2022'
try:
    df_temp = pd.read_csv(POPULATION_CSV_PATH)
    year_columns = [col for col in df_temp.columns if col.isdigit()]
    RECENT_YEAR = max(year_columns)
except FileNotFoundError:
    print(f"Warning: Population data file not found at {POPULATION_CSV_PATH}. Using default year '2022'.")
    RECENT_YEAR = '2022'


def load_and_preprocess_data():
    """
    Loads population and geospatial data, merges them, and cleans the result.

    Returns:
        gpd.GeoDataFrame: A GeoDataFrame ready for analysis.
    """
    print("Loading and preprocessing data...")
    # Load population data
    pop_df = pd.read_csv(POPULATION_CSV_PATH)

    # Robustly rename the first column to 'country'
    first_col_name = pop_df.columns[0]
    pop_df = pop_df.rename(columns={first_col_name: "country"})
    
    # Filter to essential columns (country name and the most recent year's population)
    if RECENT_YEAR not in pop_df.columns:
        raise ValueError(f"The year {RECENT_YEAR} is not a column in the population data.")
        
    pop_recent = pop_df[["country", RECENT_YEAR]].copy()
    pop_recent.columns = ["country", "population"]
    pop_recent.dropna(subset=["population"], inplace=True)
    pop_recent["population"] = pop_recent["population"].astype(int)

    # Load world map geospatial data
    world_gdf = gpd.read_file(GEOJSON_PATH)
    world_gdf = world_gdf.rename(columns={"name": "country"})

    # --- Data Cleaning: Standardize Country Names ---
    # This is often the trickiest part. We'll handle a few common mismatches.
    country_name_map = {
        "United States": "United States of America",
        "Russian Federation": "Russia",
        "Egypt, Arab Rep.": "Egypt",
        "Hong Kong SAR, China": "Hong Kong",
        "Iran, Islamic Rep.": "Iran",
        "Macao SAR, China": "Macau",
        "Congo, Dem. Rep.": "Democratic Republic of the Congo",
        "Congo, Rep.": "Republic of the Congo",
        "Venezuela, RB": "Venezuela",
        "Yemen, Rep.": "Yemen",
        "Korea, Rep.": "South Korea",
        "United Kingdom": "United Kingdom",
    }
    pop_recent["country"] = pop_recent["country"].replace(country_name_map)

    # Merge population data with geospatial data
    merged_gdf = world_gdf.merge(pop_recent, on="country", how="left")
    
    # Fill missing population with 0 for visualization purposes
    merged_gdf["population"] = merged_gdf["population"].fillna(0)
    
    print("Data loading and preprocessing complete.")
    return merged_gdf, pop_df


def create_choropleth_map(gdf: gpd.GeoDataFrame):
    """
    Creates and saves an interactive choropleth map of world population.

    Args:
        gdf (gpd.GeoDataFrame): GeoDataFrame with population data.
    
    Returns:
        folium.Map: The Folium map object, for further modification.
    """
    print("Creating choropleth map...")
    # Create a Folium map centered on the world
    world_map = folium.Map(location=[20, 0], zoom_start=2, tiles="CartoDB positron")

    # Create the choropleth layer
    choropleth = folium.Choropleth(
        geo_data=gdf,
        name="Population",
        data=gdf,
        columns=["country", "population"],
        key_on="feature.properties.country",
        fill_color="YlOrRd",
        fill_opacity=0.7,
        line_opacity=0.2,
        legend_name=f"Population ({RECENT_YEAR})",
        bins=9,
        nan_fill_color="white"
    ).add_to(world_map)
    
    # Add tooltips to the choropleth layer
    choropleth.geojson.add_child(
        folium.features.GeoJsonTooltip(
            fields=["country", "population"],
            aliases=["Country:", "Population:"],
            style=("background-color: white; color: #333333; font-family: arial; font-size: 12px; padding: 10px;")
        )
    )
    print("Choropleth map created.")
    return world_map


def perform_hotspot_analysis(gdf: gpd.GeoDataFrame, folium_map: folium.Map):
    """
    Performs DBSCAN clustering to find population hotspots and adds them to the map.

    Args:
        gdf (gpd.GeoDataFrame): The GeoDataFrame containing country data.
        folium_map (folium.Map): The map object to add markers to.
    """
    print("Performing hotspot analysis...")
    # Use countries with significant population
    hotspot_gdf = gdf[gdf["population"] > 1_000_000].copy()
    
    # Calculate centroids for clustering
    hotspot_gdf['centroid'] = hotspot_gdf['geometry'].centroid
    coords = np.array([[p.y, p.x] for p in hotspot_gdf['centroid']])

    # DBSCAN clustering
    # eps: The max distance between two samples for one to be considered as in the neighborhood of the other.
    # min_samples: The number of samples in a neighborhood for a point to be considered as a core point.
    db = DBSCAN(eps=15, min_samples=3).fit(coords) # eps is in degrees, may need tuning
    hotspot_gdf['cluster'] = db.labels_

    # Create a feature group for hotspots
    hotspot_layer = folium.FeatureGroup(name="Population Hotspots")
    
    # Visualize clusters on the map
    # -1 is noise, 0, 1, 2... are clusters
    num_clusters = len(set(db.labels_)) - (1 if -1 in db.labels_ else 0)
    colors = px.colors.qualitative.Bold[:num_clusters]

    for cluster_id in range(num_clusters):
        cluster_points = hotspot_gdf[hotspot_gdf['cluster'] == cluster_id]
        for _, row in cluster_points.iterrows():
            folium.CircleMarker(
                location=[row.centroid.y, row.centroid.x],
                radius=5,
                color=colors[cluster_id],
                fill=True,
                fill_color=colors[cluster_id],
                fill_opacity=0.8,
                popup=f"{row['country']} (Cluster {cluster_id})"
            ).add_to(hotspot_layer)
    
    hotspot_layer.add_to(folium_map)
    print(f"Found {num_clusters} hotspots.")


def create_time_series_plot(pop_df: pd.DataFrame):
    """
    Creates an interactive time-series plot of population by continent.

    Args:
        pop_df (pd.DataFrame): The original, wide-format population DataFrame.
    """
    print("Creating time-series plot...")
    
    def get_continent(country_name):
        try:
            alpha2 = country_name_to_country_alpha2(country_name)
            return country_alpha2_to_continent_code(alpha2)
        except:
            return None # Return None for regions like 'World', 'Arab World', etc.

    pop_df['continent'] = pop_df['country'].apply(get_continent)
    
    # Melt the dataframe from wide to long format
    id_vars = ['country', 'continent']
    value_vars = [col for col in pop_df.columns if col.isdigit()]
    long_df = pd.melt(pop_df, id_vars=id_vars, value_vars=value_vars,
                      var_name='year', value_name='population')

    # Group by continent and year to get total population
    continent_ts = long_df.groupby(['continent', 'year'])['population'].sum().reset_index()
    continent_ts = continent_ts.dropna()
    continent_ts['year'] = pd.to_numeric(continent_ts['year'])
    
    # Create the interactive plot
    fig = px.line(
        continent_ts,
        x='year',
        y='population',
        color='continent',
        title='World Population Growth by Continent (1960-Present)',
        labels={'population': 'Total Population', 'year': 'Year'},
        template='plotly_white'
    )
    
    fig.update_layout(
        legend_title_text='Continent',
        title_font_size=20,
        xaxis_title="Year",
        yaxis_title="Population (Billions)"
    )

    fig.write_html(TIME_SERIES_HTML)
    print("Time-series plot created.")


def main():
    """Main function to run the entire analysis pipeline."""
    # Ensure output directory exists
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    # Step 1: Load and process data
    merged_gdf, full_pop_df = load_and_preprocess_data()

    # Step 2: Create the base choropleth map
    world_map = create_choropleth_map(merged_gdf)
    
    # Step 3: Perform hotspot analysis and add to map
    perform_hotspot_analysis(merged_gdf, world_map)
    
    # Step 4: Add layer control and save the map
    folium.LayerControl().add_to(world_map)
    world_map.save(CHOROPLETH_MAP_HTML)
    print(f"Interactive map saved to {CHOROPLETH_MAP_HTML}")
    
    # Step 5: Create and save the time-series plot
    create_time_series_plot(full_pop_df)
    print(f"Time-series plot saved to {TIME_SERIES_HTML}")
    
    print("\nAnalysis complete!")


if __name__ == "__main__":
    main()

