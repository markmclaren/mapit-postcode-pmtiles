# /// script
# dependencies = [
#   "shapely"
# ]
# ///

import os
import sys
import json
import glob
from concurrent.futures import ProcessPoolExecutor
from shapely.geometry import shape, mapping
from shapely.strtree import STRtree

def color_features(features):
    """
    Given a list of GeoJSON features, builds a spatial index,
    computes adjacency, and assigns a colour_index (0-5) to each.
    """
    if not features:
        return []
        
    # Prepare geometries
    geoms = []
    valid_indices = []
    
    for idx, f in enumerate(features):
        geom_json = f.get("geometry")
        if not geom_json:
            continue
        try:
            geom = shape(geom_json)
            if not geom.is_valid:
                geom = geom.buffer(0)
            if geom.is_empty:
                continue
            geoms.append(geom)
            valid_indices.append(idx)
        except Exception:
            continue
            
    if not geoms:
        for f in features:
            if "properties" not in f:
                f["properties"] = {}
            f["properties"]["colour_index"] = 0
        return features

    # Build STRtree
    tree = STRtree(geoms)
    adjacency = {i: set() for i in range(len(geoms))}
    
    for i, geom in enumerate(geoms):
        # Query STRtree directly for candidate overlap bounds (very fast)
        neighbour_candidates = tree.query(geom)
        
        for candidate in neighbour_candidates:
            j = candidate if isinstance(candidate, (int, float, complex)) or hasattr(candidate, 'item') else geoms.index(candidate)
            if i != j:
                # Fast touches/intersects check
                if geom.touches(geoms[j]) or geom.intersects(geoms[j]):
                    adjacency[i].add(int(j))
                    adjacency[int(j)].add(i)
                # Distance threshold for tiny precision gaps
                elif geom.distance(geoms[j]) < 0.0001:
                    adjacency[i].add(int(j))
                    adjacency[int(j)].add(i)

    # Greedy Graph Coloring with degree descending sort
    degrees = {i: len(adjacency[i]) for i in range(len(geoms))}
    sorted_nodes = sorted(range(len(geoms)), key=lambda x: degrees[x], reverse=True)
    
    color_assigned = {}
    for node in sorted_nodes:
        used_colors = {color_assigned[neigh] for neigh in adjacency[node] if neigh in color_assigned}
        color = 0
        while color in used_colors:
            color += 1
        color_assigned[node] = color
        
    # Write back colour_index to original features
    for idx, f in enumerate(features):
        if "properties" not in f:
            f["properties"] = {}
        if idx in valid_indices:
            geom_idx = valid_indices.index(idx)
            f["properties"]["colour_index"] = color_assigned.get(geom_idx, 0)
        else:
            f["properties"]["colour_index"] = 0
            
    return features

def process_single_file(file_path):
    """
    Reads a single GeoJSON file, colors its features locally, and writes it back.
    """
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        features = data.get("features", [])
        if not features:
            return
        colored = color_features(features)
        data["features"] = colored
        with open(file_path, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        print(f"Error coloring file {file_path}: {e}")

def color_files_as_group(args):
    """
    Given a list of file paths, reads all features, colors them as a unified group,
    and writes them back to their respective files.
    """
    file_paths, group_label = args
    if not file_paths:
        return
        
    all_features = []
    feature_source_map = [] # (file_path, feature_index_in_file)
    
    for file_path in file_paths:
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            features = data.get("features", [])
            for feat_idx, feat in enumerate(features):
                all_features.append(feat)
                feature_source_map.append((file_path, feat_idx))
        except Exception as e:
            print(f"Error reading {file_path} in group {group_label}: {e}")
            
    if not all_features:
        return
        
    colored_features = color_features(all_features)
    
    # Group colored features back by file path
    file_contents = {fp: [] for fp in file_paths}
    for idx, feat in enumerate(colored_features):
        file_path, _ = feature_source_map[idx]
        file_contents[file_path].append(feat)
        
    # Write back to files
    for file_path, features in file_contents.items():
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            data["features"] = features
            with open(file_path, 'w') as f:
                json.dump(data, f)
        except Exception as e:
            print(f"Error writing to {file_path} in group {group_label}: {e}")

def group_and_color_directory(dir_path, label):
    """
    Gathers all geojson files in dir_path, groups them by their postcode area prefix
    (e.g., the first 1-2 alphabetic characters), and colors each group in parallel.
    """
    print(f"Grouping and coloring {label} by area prefix...")
    
    # Gather files
    geojson_files = []
    for root, _, files in os.walk(dir_path):
        for file in files:
            if file.endswith(".geojson"):
                geojson_files.append(os.path.join(root, file))
                
    if not geojson_files:
        print(f"No files found in {dir_path}")
        return
        
    # Group files by area prefix (e.g. "AB10.geojson" -> "AB", "AL1 1.geojson" -> "AL")
    groups = {}
    for fp in geojson_files:
        base = os.path.basename(fp)
        # Extract leading alphabetic characters
        prefix = ""
        for char in base:
            if char.isalpha():
                prefix += char
            else:
                break
        prefix = prefix.upper() or "OTHER"
        if prefix not in groups:
            groups[prefix] = []
        groups[prefix].append(fp)
        
    print(f"Found {len(groups)} area prefix groups for {label}.")
    
    # Build tasks for the process pool
    tasks = [(files, prefix) for prefix, files in groups.items()]
    
    cpu_count = os.cpu_count() or 4
    with ProcessPoolExecutor(max_workers=cpu_count) as executor:
        list(executor.map(color_files_as_group, tasks))

def main():
    base_dir = "gb-postcodes-v5-clipped"
    if not os.path.exists(base_dir):
        print(f"Error: Clipped directory {base_dir} does not exist.")
        sys.exit(1)
        
    print("=== 1/4 Globally coloring Areas (Single Graph) ===")
    areas_files = glob.glob(os.path.join(base_dir, "areas", "*.geojson"))
    color_files_as_group((areas_files, "AREAS"))
    
    print("=== 2/4 Coloring Districts (Grouped by Area Prefix, Parallel) ===")
    group_and_color_directory(os.path.join(base_dir, "districts"), "Districts")
    
    print("=== 3/4 Coloring Sectors (Grouped by Area Prefix, Parallel) ===")
    group_and_color_directory(os.path.join(base_dir, "sectors"), "Sectors")
    
    print("=== 4/4 Coloring Units (File-by-file, Parallel) ===")
    units_dir = os.path.join(base_dir, "units")
    unit_files = glob.glob(os.path.join(units_dir, "*.geojson"))
    print(f"Processing {len(unit_files)} unit files...")
    cpu_count = os.cpu_count() or 4
    with ProcessPoolExecutor(max_workers=cpu_count) as executor:
        list(executor.map(process_single_file, unit_files))
        
    print("=== Coloring complete successfully! ===")

if __name__ == "__main__":
    main()

