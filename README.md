# Mapit Postcode PMTiles

A MapLibre GL JS client application designed to visualize and inspect local postcode boundary datasets stored in the PMTiles format. It utilizes the OpenFreeMap Liberty basemap.

# Inspiration

Mark Longair's [Open Data GB postcode unit boundaries](https://longair.net/blog/2021/08/23/open-data-gb-postcode-unit-boundaries/).  
https://github.com/mhl/postcodes-mapit

# Download

PMTiles derived from this file of GeoJSON:

[https://postcodes-mapit-static.s3.eu-west-2.amazonaws.com/data/gb-postcodes-v5.tar.bz2](https://postcodes-mapit-static.s3.eu-west-2.amazonaws.com/data/gb-postcodes-v5.tar.bz2)

## Running Locally

Because PMTiles works by fetching specific byte ranges directly from the server on-demand (via HTTP Range Requests), you must host both the HTML page and the PMTiles files using a local web server that supports:
1. **HTTP Range Requests**
2. **CORS (Cross-Origin Resource Sharing)**

### Option 1: Using `serve`
You can start a lightweight web server in this directory using `npx`:

```bash
npx serve --cors -p 8080 .
```

After launching, open your browser and navigate to:
[http://localhost:8080](http://localhost:8080)

---

## GB PMTiles Build Workflow

This repository includes helper scripts to build the GB postcode PMTiles files.

1. `download.sh`
   - Downloads the raw `gb-postcodes-v5` dataset archive.
   - Use this first if you do not already have `gb-postcodes-v5/`.

2. `clip_data.sh`
   - Clips the raw postcode GeoJSON files to the Great Britain coastline.
   - Outputs clipped GeoJSON into `gb-postcodes-v5-clipped/`.
   - This is optional, but recommended if you want coastline-clean postcode boundaries.

3. `create_pmtiles.sh`
   - Generates MBTiles from `gb-postcodes-v5/`, then converts them into PMTiles.
   - Use this when you do not need coastline clipping.
   - Outputs: `gb_areas.pmtiles`, `gb_districts.pmtiles`, `gb_sectors.pmtiles`, `gb_units.pmtiles`.

4. `create_pmtiles_clipped.sh`
   - Generates MBTiles from `gb-postcodes-v5-clipped/`, then converts them into PMTiles.
   - Use this after `clip_data.sh` if you want clipped boundaries in your PMTiles.
   - Outputs: `gb_areas.pmtiles`, `gb_districts.pmtiles`, `gb_sectors.pmtiles`, `gb_units.pmtiles`.

### Recommended order

- If you want raw PMTiles:  
  1. `./download.sh` (if needed). 
  2. `./create_pmtiles.sh`. 

- If you want coastline-clipped PMTiles:  
  1. `./download.sh` (if needed). 
  2. `./clip_data.sh`. 
  3. `./create_pmtiles_clipped.sh`. 

If you already have `gb-postcodes-v5/` and do not want clipped output, skip `clip_data.sh`.

---

## Features
- **OpenFreeMap Integration**: Uses OpenFreeMap's zero-key, high-speed Liberty style vector basemap.
- **Layer Visibility Toggles**: Enable/disable each of the three dataset layers dynamically.
- **Dynamic Styling Controls**: Customize fill color, fill opacity, outline color, and outline thickness in real-time.
- **Clicked Feature Inspector**: Click on any postcode region to query and view its attributes in a clean key-value table.
- **PMTiles Header Metadata**: Parses and displays internal PMTiles metadata (bounding box, zoom level ranges, format, etc.) using range requests.

# PMTiles location

The PMTiles produced are available as a HuggingFace dataset at:

https://huggingface.co/datasets/markmclaren/mapit-postcode-pmtiles

# Licensing

You may use this data under the Open Government License v3.0, and must include the following copyright notices:

Contains OS data © Crown copyright and database right 2020.  
Contains Royal Mail data © Royal Mail copyright and database right 2020.  
Source: Office for National Statistics licensed under the Open Government Licence v.3.0.  
