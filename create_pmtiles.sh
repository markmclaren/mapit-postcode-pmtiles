#!/bin/bash
set -e

echo "=== Starting PMTiles Generation for GB Postcodes ==="

# 1. Areas
echo "--- 1/4 Generating gb_areas.mbtiles (Zoom 0-12) ---"
find gb-postcodes-v5/areas -name "*.geojson" -exec jq -c '.features[]' {} + | \
  tippecanoe -o gb_areas.mbtiles -l areas -z12 -Z0 \
  --coalesce-smallest-as-needed --detect-shared-borders --force
pmtiles convert gb_areas.mbtiles gb_areas.pmtiles
rm -f gb_areas.mbtiles

# 2. Districts
echo "--- 2/4 Generating gb_districts.mbtiles (Zoom 0-14) ---"
find gb-postcodes-v5/districts -name "*.geojson" -exec jq -c '.features[]' {} + | \
  tippecanoe -o gb_districts.mbtiles -l districts -z14 -Z0 \
  --coalesce-smallest-as-needed --detect-shared-borders --force
pmtiles convert gb_districts.mbtiles gb_districts.pmtiles
rm -f gb_districts.mbtiles

# 3. Sectors
echo "--- 3/4 Generating gb_sectors.mbtiles (Zoom 0-16) ---"
find gb-postcodes-v5/sectors -name "*.geojson" -exec jq -c '.features[]' {} + | \
  tippecanoe -o gb_sectors.mbtiles -l sectors -z16 -Z0 \
  --coalesce-smallest-as-needed --detect-shared-borders --force
pmtiles convert gb_sectors.mbtiles gb_sectors.pmtiles
rm -f gb_sectors.mbtiles

# 4. Units
echo "--- 4/4 Generating gb_units.mbtiles (Zoom 8-16) ---"
find gb-postcodes-v5/units -name "*.geojson" -exec jq -c '.features[]' {} + | \
  tippecanoe -o gb_units.mbtiles -l units -z16 -Z8 \
  --coalesce-smallest-as-needed --detect-shared-borders --force
pmtiles convert gb_units.mbtiles gb_units.pmtiles
rm -f gb_units.mbtiles

echo "=== All PMTiles Generated Successfully ==="
ls -lh *.pmtiles
