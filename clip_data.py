# /// script
# dependencies = [
#   "shapely"
# ]
# ///

import os
import json
import urllib.request
from concurrent.futures import ProcessPoolExecutor
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from shapely.wkt import loads as wkt_loads

# Configuration
SOURCE_DIR = "gb-postcodes-v5"
CLIPPED_DIR = "gb-postcodes-v5-clipped"
BOUNDARY_URL = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/ArcGIS/rest/services/"
    "Countries_December_2025_Boundaries_UK_BUC/FeatureServer/0/"
    "query?where=1%3D1&outFields=*&outSR=4326&f=geojson"
)

def download_boundary():
    print("=== 1. Downloading ONS UK Landmass Boundaries ===")
    # Download the 2025 country boundaries
    req = urllib.request.Request(
        BOUNDARY_URL, 
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
    
    # Filter out Northern Ireland (as the postcode dataset is Great Britain only)
    gb_features = []
    for f in data["features"]:
        name = f["properties"].get("CTRY25NM")
        if name != "Northern Ireland":
            print(f"Adding landmass boundary for {name}...")
            gb_features.append(shape(f["geometry"]))
            
    # Combine England, Wales, and Scotland into a single Great Britain polygon
    print("Dissolving landmass boundaries into unified Great Britain polygon...")
    return unary_union(gb_features)

def clip_file(args):
    src_path, dest_path, gb_geom_wkt = args
    # Reconstruct shape object from WKT in worker processes
    gb_geom = wkt_loads(gb_geom_wkt)
    
    try:
        with open(src_path, "r") as f:
            geojson_data = json.load(f)
            
        clipped_features = []
        for feat in geojson_data.get("features", []):
            try:
                geom = shape(feat["geometry"])
                if not geom.is_valid:
                    geom = geom.buffer(0)
                
                # Perform intersection
                intersected = geom.intersection(gb_geom)
                if not intersected.is_empty:
                    # Keep only polygon geometries
                    if intersected.geom_type in ("Polygon", "MultiPolygon"):
                        feat_copy = feat.copy()
                        feat_copy["geometry"] = mapping(intersected)
                        clipped_features.append(feat_copy)
            except Exception:
                # If geometry processing fails for a specific feature, fallback to original
                clipped_features.append(feat)
                
        if clipped_features:
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            geojson_data["features"] = clipped_features
            with open(dest_path, "w") as f:
                json.dump(geojson_data, f)
    except Exception as e:
        print(f"Error processing file {src_path}: {e}")

def main():
    # Make sure source dir exists
    if not os.path.exists(SOURCE_DIR):
        print(f"Error: Source directory {SOURCE_DIR} not found.")
        return

    gb_geom = download_boundary()
    gb_geom_wkt = gb_geom.wkt  # Serialize to WKT for process pooling
    
    # Gather all geojson files to clip
    tasks = []
    for root, dirs, files in os.walk(SOURCE_DIR):
        for file in files:
            if file.endswith(".geojson"):
                src_path = os.path.join(root, file)
                rel_path = os.path.relpath(src_path, SOURCE_DIR)
                dest_path = os.path.join(CLIPPED_DIR, rel_path)
                tasks.append((src_path, dest_path, gb_geom_wkt))
                
    print(f"=== 2. Starting parallel clipping of {len(tasks)} files ===")
    
    # Process files in parallel using all CPU cores
    cpu_count = os.cpu_count() or 4
    with ProcessPoolExecutor(max_workers=cpu_count) as executor:
        # Wrap in list to block and wait for execution
        list(executor.map(clip_file, tasks))
        
    print("=== 3. All postcode files clipped successfully ===")
    print(f"Clipped data saved in: {CLIPPED_DIR}/")

if __name__ == "__main__":
    main()
