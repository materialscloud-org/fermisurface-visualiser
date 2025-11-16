#!/usr/bin/env python3
import argparse
import numpy as np
import json

from bxsf import parse_bxsf
from BrillouinZone import BrillouinZoneData

# function to take a list of planes and return a set of unique planes.
def deduplicate_planes(faces, planes, tol=1e-6):   
    unique_planes = []
    unique_faces = []
    seen = []

    for face, plane in zip(faces, planes):
        normal = np.array(plane["normal"])
        D = plane["D"]

        duplicate = False
        for n0, D0 in seen:
            # Check if normals are effectively identical and D matches
            if np.allclose(normal, n0, atol=tol) and abs(D - D0) < tol:
                duplicate = True
                break

        if not duplicate:
            seen.append((normal, D))
            unique_planes.append(plane)
            unique_faces.append(face)

    return unique_faces, unique_planes


def export_multiple_scalar_fields_with_edges_to_json(
    scalar_fields_bz, band_names, bz: BrillouinZoneData, min_corner, max_corner, path
):
    print("\n=== Exporting multiple scalar fields and BZ outline edges to JSON ===")

    Nz, Ny, Nx = scalar_fields_bz[0].shape
    spacing = (max_corner - min_corner) / np.array([Nx - 1, Ny - 1, Nz - 1])
    origin = min_corner

    fermi_energy = bz.bxsf.fermi_energy

    scalar_fields_json = []
    for scalar_field_bz, band_name in zip(scalar_fields_bz, band_names):

        # Round to 2 decimals
        rounded_array = np.round(scalar_field_bz, 2).flatten(order="C")

        # Further compress: convert e.g. 1.0 -> 1
        rounded_array = [int(x) if x.is_integer() else x for x in rounded_array.tolist()]

        # Convert nan to None for JSON null casting
        rounded_list = [None if np.isnan(x) else x for x in rounded_array]

        # Compute min/max ignoring None
        numeric_values = [x for x in rounded_list if x is not None]
        minval = float(np.min(numeric_values)) if numeric_values else None
        maxval = float(np.max(numeric_values)) if numeric_values else None

        scalar_fields_json.append({
            "name": band_name,
            "scalarFieldInfo": {
                "dimensions": [Nx, Ny, Nz],
                "scalarField": rounded_list,
                "origin": np.round(origin, 6).tolist(),
                "spacing": np.round(spacing, 6).tolist(),
                "minval": minval,
                "maxval": maxval
            }
        })

    vertices, edges = bz.get_bz_outline_edges()
    _v, faces, planes = bz.get_bz_faces_with_planes()
    faces_unique, planes_unique = deduplicate_planes(faces, planes)
    print(f"Original: {len(faces)} faces, {len(planes)} planes")
    print(f"Deduplicated: {len(faces_unique)} faces, {len(planes_unique)} planes")


    data = {
        "fermiEnergy": fermi_energy,
        "scalarFields": scalar_fields_json,
        "brillouinZone": {
            "vertices": np.round(vertices, 6).tolist(),
            "edges": [list(map(int, edge)) for edge in edges],
            "reciprocalVectors": np.round(bz.bxsf.reciprocal_vectors, 6).tolist(),
            "faces": faces_unique,
            "planes": planes_unique
        }
    }


    with open(path, "w") as f:
        json.dump(data, f, separators=(',', ':'))
    print(f"JSON export complete: {path}")


def main():
    parser = argparse.ArgumentParser(
        description="Export BXSF scalar fields and Brillouin zone outline to JSON."
    )
    parser.add_argument("bxsf_file", help="Input .bxsf file path")
    parser.add_argument(
        "-r", "--resolution", type=int, default=20,
        help="Grid resolution along each axis (default: 20)"
    )
    parser.add_argument(
        "-o", "--output", default="fermidata.json",
        help="Output JSON filename (default: fermidata.json)"
    )
    parser.add_argument(
        "-b", "--bands", type=str,
        help="Comma-separated list of band indices to export (default: all bands)"
    )

    parser.add_argument(
        "-nm",
        "--no-mask-outside-bz",
        dest="no_mask_outside_bz",
        action="store_false",
        default=True,
        help="Dont mask values outside of the brillioun Zone"
    )


    args = parser.parse_args()

    print("=== Parsing BXSF data ===")
    data = parse_bxsf(args.bxsf_file)
    bz = BrillouinZoneData(data)

    print(f"=== Generating grid with resolution={args.resolution} ===")
    grid_points, shape = bz.generate_cartesian_grid(resolution=args.resolution)
    margin = 0.05  # pad the grid box a little.
    min_corner = grid_points.min(axis=0)
    max_corner = grid_points.max(axis=0)
    extent = max_corner - min_corner
    min_corner = min_corner - margin * extent
    max_corner = max_corner + margin * extent

    if args.no_mask_outside_bz:
        print("=== Using full grid, no masking ===")
        print("=== This is the better mode if you are want to use the visualiser.")
        frac_coords = bz.cartesian_to_fractional(grid_points)
    else:
        print("=== Filtering points inside BZ ===")
        print("=== This effectively cleaves (poorly) at the data level")
        points_in_bz, mask = bz.filter_points_in_bz(grid_points)
        frac_coords = bz.cartesian_to_fractional(points_in_bz)

    if args.bands:
        band_indices = [int(idx.strip()) - 1 for idx in args.bands.split(",")]
    else:
        band_indices = list(range(data.num_bands))

    scalar_fields_bz = []
    band_names = []

    for band_idx in band_indices:
        print(f"\n=== Processing Band {band_idx+1} ===", end="")
        interpolated_values = bz.interpolate_scalar_field(frac_coords, band_index=band_idx)

        if args.no_mask_outside_bz:
            # Interpolate everywhere, reshape directly
            scalar_field_bz = interpolated_values.reshape(shape)
        else:
            # Create full grid, fill with NaN, insert values only inside BZ
            scalar_field_flat = np.full((np.prod(shape),), np.nan)
            scalar_field_flat[mask] = interpolated_values
            scalar_field_bz = scalar_field_flat.reshape(shape)


        print(f" Interpolated stats: min={np.nanmin(interpolated_values)}, max={np.nanmax(interpolated_values)}", end="")
        scalar_fields_bz.append(scalar_field_bz)
        band_names.append(f"Band {band_idx+1}")

    export_multiple_scalar_fields_with_edges_to_json(
        scalar_fields_bz, band_names, bz, min_corner, max_corner, args.output
    )


if __name__ == "__main__":
    main()
