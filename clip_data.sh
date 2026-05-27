#!/bin/bash
set -e

# Define directories
SOURCE_DIR="gb-postcodes-v5"
CLIPPED_DIR="gb-postcodes-v5-clipped"
BOUNDARY_FILE="gb_boundary.geojson"

# Number of parallel jobs (utilize multi-core CPU)
PARALLEL_JOBS=$(sysctl -n hw.ncpu || echo 4)

echo "=== 1. Downloading ONS Great Britain Landmass Boundary ==="
# Download ONS 2025 Ultra Generalised BUC dataset (500m resolution) and filter out Northern Ireland
# This gives a high-quality coastline mask of England, Wales, and Scotland (Great Britain)
# in the standard WGS84 coordinate reference system (EPSG:4326).
ogr2ogr -where "CTRY25NM != 'Northern Ireland'" "$BOUNDARY_FILE" \
  "https://services1.arcgis.com/ESMARspQHYMw9BZ9/ArcGIS/rest/services/Countries_December_2025_Boundaries_UK_BUC/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson" \
  -overwrite

echo "=== 2. Creating output directory structure ==="
mkdir -p "$CLIPPED_DIR/areas"
mkdir -p "$CLIPPED_DIR/districts"
mkdir -p "$CLIPPED_DIR/sectors"
mkdir -p "$CLIPPED_DIR/units"

echo "=== 3. Clipping Postcode Datasets in Parallel ($PARALLEL_JOBS cores) ==="

echo "--- 3.1 Clipping Areas (120 files) ---"
find "$SOURCE_DIR/areas" -name "*.geojson" | xargs -n 1 -P "$PARALLEL_JOBS" -I {} sh -c '
  f="{}"
  ogr2ogr -clipsrc '"$BOUNDARY_FILE"' "'"$CLIPPED_DIR"'/areas/$(basename "$f")" "$f"
'

echo "--- 3.2 Clipping Districts (2736 files) ---"
find "$SOURCE_DIR/districts" -name "*.geojson" | xargs -n 1 -P "$PARALLEL_JOBS" -I {} sh -c '
  f="{}"
  ogr2ogr -clipsrc '"$BOUNDARY_FILE"' "'"$CLIPPED_DIR"'/districts/$(basename "$f")" "$f"
'

echo "--- 3.3 Clipping Sectors (11130 files) ---"
find "$SOURCE_DIR/sectors" -name "*.geojson" | xargs -n 1 -P "$PARALLEL_JOBS" -I {} sh -c '
  f="{}"
  parent_dir=$(basename "$(dirname "$f")")
  mkdir -p "'"$CLIPPED_DIR"'/sectors/$parent_dir"
  ogr2ogr -clipsrc '"$BOUNDARY_FILE"' "'"$CLIPPED_DIR"'/sectors/$parent_dir/$(basename "$f")" "$f"
'

echo "--- 3.4 Clipping Units (2736 files) ---"
find "$SOURCE_DIR/units" -name "*.geojson" | xargs -n 1 -P "$PARALLEL_JOBS" -I {} sh -c '
  f="{}"
  ogr2ogr -clipsrc '"$BOUNDARY_FILE"' "'"$CLIPPED_DIR"'/units/$(basename "$f")" "$f"
'

echo "=== 4. All Datasets Clipped Successfully ==="
echo "You can now edit create_pmtiles.sh to point to $CLIPPED_DIR instead of $SOURCE_DIR, then regenerate the PMTiles!"
