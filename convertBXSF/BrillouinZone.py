import numpy as np
from scipy.spatial import Voronoi, Delaunay
from scipy.ndimage import map_coordinates
from scipy.spatial import ConvexHull
from collections import defaultdict

class BrillouinZoneData:
    def __init__(self, bxsf_data):
        self.bxsf = bxsf_data
        self.bz_voronoi = self._compute_brillouin_zone()

    def _generate_reciprocal_lattice(self, n=3):
        a1, a2, a3 = self.bxsf.reciprocal_vectors
        points = []
        for i in range(-n, n + 1):
            for j in range(-n, n + 1):
                for k in range(-n, n + 1):
                    pt = i * a1 + j * a2 + k * a3
                    points.append(pt)
        return np.array(points)

    def _compute_brillouin_zone(self):
        points = self._generate_reciprocal_lattice()
        vor = Voronoi(points)
        return vor


    def get_bz_geometry(self):
        origin_idx = np.argmin(np.linalg.norm(self.bz_voronoi.points, axis=1))
        region_idx = self.bz_voronoi.point_region[origin_idx]
        region = self.bz_voronoi.regions[region_idx]

        if -1 in region:
            raise ValueError("Voronoi region is unbounded. Increase lattice range.")

        region_vertices = self.bz_voronoi.vertices[region]
        hull = ConvexHull(region_vertices)

        vertices = np.round(region_vertices, 6).tolist()
        indices = hull.simplices.tolist() 

        return vertices, indices

    def get_bz_faces_with_planes(self):
        """
        Returns:
            vertices: ndarray (N,3)
            faces: list of [i0, i1, i2]
            planes: list of dicts { normal: [nx,ny,nz], D: offset }
        """
        vertices, faces = self.get_bz_vertices_and_faces()
        planes = []

        # compute center of BZ to define "inside"
        bz_center = np.mean(vertices, axis=0)

        for f in faces:
            i0, i1, i2 = f
            v0, v1, v2 = vertices[i0], vertices[i1], vertices[i2]

            # Compute normal
            u = v1 - v0
            v = v2 - v0
            normal = np.cross(u, v)
            norm_length = np.linalg.norm(normal)
            if norm_length == 0:
                continue  # degenerate face
            normal /= norm_length

            # Plane offset
            D = float(np.dot(normal, v0))

            # Ensure normal points outward from BZ center
            if np.dot(normal, bz_center - v0) > 0:
                normal = -normal
                D = -D

            planes.append({"normal": normal.tolist(), "D": D})

        return vertices.tolist(), faces.tolist(), planes




    def get_bz_outline_edges(self):
        vor = self.bz_voronoi
        origin_idx = np.argmin(np.linalg.norm(vor.points, axis=1))
        origin_region_idx = vor.point_region[origin_idx]
        origin_region = vor.regions[origin_region_idx]

        if -1 in origin_region:
            raise ValueError("Voronoi region unbounded, increase lattice range")

        # Keep edges from all ridges adjacent to origin point
        edges = set()
        for (p1, p2), ridge_vertices in zip(vor.ridge_points, vor.ridge_vertices):
            if origin_idx not in (p1, p2):
                continue  # Not adjacent to origin cell

            if -1 in ridge_vertices:
                continue  # Infinite ridge

            # ridge_vertices form a polygon edge(s) on BZ boundary
            # ridge_vertices is a list of indices into vor.vertices
            # Edges between consecutive ridge_vertices are polygon edges on BZ boundary

            # If ridge_vertices length > 2, it’s a polygon (rare), else line segment
            for i in range(len(ridge_vertices)):
                v_start = ridge_vertices[i]
                v_end = ridge_vertices[(i + 1) % len(ridge_vertices)]
                edge = tuple(sorted((v_start, v_end)))
                edges.add(edge)

        vertices = vor.vertices[list(origin_region)]

        # Map vertex indices in edges (which are global) to local indices in origin_region
        index_map = {v: i for i, v in enumerate(origin_region)}

        unique_edges_local = []
        for e in edges:
            if e[0] in index_map and e[1] in index_map:
                unique_edges_local.append([index_map[e[0]], index_map[e[1]]])

        vertices_list = np.round(vertices, 6).tolist()

        return vertices_list, unique_edges_local


    def get_bz_vertices_and_faces(self):
        origin_idx = np.argmin(np.linalg.norm(self.bz_voronoi.points, axis=1))
        region_idx = self.bz_voronoi.point_region[origin_idx]
        region = self.bz_voronoi.regions[region_idx]

        if -1 in region:
            raise ValueError("Voronoi region is unbounded. Increase lattice range.")

        vertices = self.bz_voronoi.vertices[region]
        
        # Compute convex hull to get triangle faces
        hull = ConvexHull(vertices)
        faces = hull.simplices  # shape (n_faces, 3)
        
        return vertices, faces


    def get_bz_vertices_and_regions(self):
        origin_idx = np.argmin(np.linalg.norm(self.bz_voronoi.points, axis=1))
        region_idx = self.bz_voronoi.point_region[origin_idx]
        region = self.bz_voronoi.regions[region_idx]

        if -1 in region:
            raise ValueError("Voronoi region is unbounded. Increase lattice range.")

        vertices = self.bz_voronoi.vertices[region]
        return vertices, region

    def generate_cartesian_grid(self, resolution=50):
        vertices, _ = self.get_bz_vertices_and_regions()
        min_corner = vertices.min(axis=0)
        max_corner = vertices.max(axis=0)

        grid_x, grid_y, grid_z = np.meshgrid(
            np.linspace(min_corner[0], max_corner[0], resolution),
            np.linspace(min_corner[1], max_corner[1], resolution),
            np.linspace(min_corner[2], max_corner[2], resolution),
            indexing='ij'
        )

        grid_points = np.stack([grid_x, grid_y, grid_z], axis=-1).reshape(-1, 3)
        return grid_points, grid_x.shape

    def filter_points_in_bz(self, grid_points):
        vertices, _ = self.get_bz_vertices_and_regions()
        hull = Delaunay(vertices)
        mask = hull.find_simplex(grid_points) >= 0
        return grid_points[mask], mask

    def cartesian_to_fractional(self, cart_coords):
        B = self.bxsf.reciprocal_vectors.T
        return np.linalg.solve(B, cart_coords.T).T

    def interpolate_scalar_field(self, fractional_coords, band_index=0):
        nx, ny, nz = self.bxsf.grid_shape
        field = self.bxsf.scalar_field[band_index]

        # Wrap fractional coordinates to [0,1) to enforce periodicity
        fractional_coords_wrapped = fractional_coords % 1.0
        fractional_coords_wrapped = np.clip(fractional_coords_wrapped, 1e-12, 1 - 1e-12)

        # Scale to grid indices
        coords = fractional_coords_wrapped * np.array([nx, ny, nz]).reshape(1, 3)

        # map_coordinates expects coords shape (3, N)
        coords = coords.T

        # Interpolate with periodic boundary conditions (mode='wrap') mirror might be better?
        # TODO read this: "https://docs.scipy.org/doc/scipy/reference/generated/scipy.ndimage.map_coordinates.html"        
        values = map_coordinates(field, coords, order=1, mode='nearest')
        return values

    def sample_scalar_field_in_bz(self, resolution=50, band_index=0):
        grid_points, shape = self.generate_cartesian_grid(resolution)
        points_in_bz, mask = self.filter_points_in_bz(grid_points)

        frac_coords = self.cartesian_to_fractional(points_in_bz)
        interpolated_values = self.interpolate_scalar_field(frac_coords, band_index)

        scalar_field_bz = np.full((np.prod(shape),), np.nan)
        scalar_field_bz[mask] = interpolated_values
        scalar_field_bz = scalar_field_bz.reshape(shape)

        return scalar_field_bz
