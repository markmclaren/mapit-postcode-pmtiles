#!/bin/bash
set -eo pipefail

echo "=== Starting PMTiles Generation for CLIPPED GB Postcodes ==="

# Run the color indexing script to ensure all geojson features get properties.colour_index
echo "--- 0/4 Calculating colour_index for polygon contrast ---"
uv run add_colour_index.py

# 1. Areas
echo "--- 1/4 Generating gb_areas.mbtiles (Zoom 0-12) ---"
rm -f gb_areas.mbtiles gb_areas.pmtiles gb_areas.mbtiles-journal
python3 -c 'import os, sys, json; [sys.stdout.write(json.dumps(feat) + "\n") for r, ds, fs in os.walk("gb-postcodes-v5-clipped/areas") for f in fs if f.endswith(".geojson") for feat in json.load(open(os.path.join(r, f))).get("features", [])]' | \
  tippecanoe -o gb_areas.mbtiles -l areas -z12 -Z0 \
  --coalesce-smallest-as-needed --detect-shared-borders --force
pmtiles convert gb_areas.mbtiles gb_areas.pmtiles
echo "Converted gb_areas.mbtiles -> gb_areas.pmtiles"
rm -f gb_areas.mbtiles

# 2. Districts
echo "--- 2/4 Generating gb_districts.mbtiles (Zoom 0-14) ---"
rm -f gb_districts.mbtiles gb_districts.pmtiles gb_districts.mbtiles-journal
python3 -c 'import os, sys, json; [sys.stdout.write(json.dumps(feat) + "\n") for r, ds, fs in os.walk("gb-postcodes-v5-clipped/districts") for f in fs if f.endswith(".geojson") for feat in json.load(open(os.path.join(r, f))).get("features", [])]' | \
  tippecanoe -o gb_districts.mbtiles -l districts -z14 -Z0 \
  --coalesce-smallest-as-needed --detect-shared-borders --force
pmtiles convert gb_districts.mbtiles gb_districts.pmtiles
echo "Converted gb_districts.mbtiles -> gb_districts.pmtiles"
rm -f gb_districts.mbtiles

# 3. Sectors
echo "--- 3/4 Generating gb_sectors.mbtiles (Zoom 0-16) ---"
rm -f gb_sectors.mbtiles gb_sectors.pmtiles gb_sectors.mbtiles-journal
python3 -c 'import os, sys, json; [sys.stdout.write(json.dumps(feat) + "\n") for r, ds, fs in os.walk("gb-postcodes-v5-clipped/sectors") for f in fs if f.endswith(".geojson") for feat in json.load(open(os.path.join(r, f))).get("features", [])]' | \
  tippecanoe -o gb_sectors.mbtiles -l sectors -z16 -Z0 \
  --coalesce-smallest-as-needed --detect-shared-borders --force
pmtiles convert gb_sectors.mbtiles gb_sectors.pmtiles
echo "Converted gb_sectors.mbtiles -> gb_sectors.pmtiles"
rm -f gb_sectors.mbtiles

# 4. Units
echo "--- 4/4 Generating gb_units.mbtiles (Zoom 8-14) ---"
rm -f gb_units.mbtiles gb_units.pmtiles gb_units.mbtiles-journal
python3 -c '
import os, sys, json
for r, ds, fs in os.walk("gb-postcodes-v5-clipped/units"):
    for f in fs:
        if f.endswith(".geojson"):
            try:
                with open(os.path.join(r, f)) as file:
                    for feat in json.load(file).get("features", []):
                        sys.stdout.write(json.dumps(feat) + "\n")
            except Exception as e:
                sys.stderr.write(f"Error {f}: {e}\n")
' | \
  tippecanoe -o gb_units.mbtiles -l units -z14 -Z8 \
  --coalesce-smallest-as-needed --detect-shared-borders --force
pmtiles convert gb_units.mbtiles gb_units.pmtiles
echo "Converted gb_units.mbtiles -> gb_units.pmtiles"
rm -f gb_units.mbtiles

echo "=== All Clipped PMTiles Generated Successfully ==="
ls -lh *.pmtiles
