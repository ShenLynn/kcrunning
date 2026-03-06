import { Route } from '@/types/route'

// GPS art routes centred around Sydney, Australia

const mockRoutes: Route[] = [
  {
    id: 'route-001',
    title: 'The Roo',
    description: 'A kangaroo traced through Centennial Park and the Eastern Suburbs. Our mascot deserves a run.',
    tags: ['kangaroo', 'centennial-park', 'eastern-suburbs'],
    distance_km: 9.2,
    status: 'approved',
    created_at: '2026-01-10T08:00:00Z',
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        // Kangaroo silhouette around Centennial Park (-33.895, 151.235)
        coordinates: [
          // Body
          [151.222, -33.908],
          [151.228, -33.904],
          [151.235, -33.900],
          [151.241, -33.897],
          [151.246, -33.897],
          // Chest
          [151.248, -33.901],
          [151.247, -33.906],
          // Front leg
          [151.245, -33.910],
          [151.244, -33.915],
          [151.245, -33.918],
          // Belly
          [151.242, -33.914],
          [151.238, -33.912],
          // Back legs
          [151.235, -33.914],
          [151.232, -33.918],
          [151.230, -33.922],
          [151.231, -33.925],
          // Tail
          [151.228, -33.920],
          [151.224, -33.916],
          [151.220, -33.913],
          [151.218, -33.910],
          [151.220, -33.908],
          [151.222, -33.908],
          // Head (loop back)
          [151.228, -33.900],
          [151.232, -33.896],
          [151.234, -33.893],
          [151.237, -33.893],
          [151.238, -33.895],
          // Ear
          [151.236, -33.892],
          [151.237, -33.889],
          [151.239, -33.891],
          [151.238, -33.895],
        ],
      },
    },
  },
  {
    id: 'route-002',
    title: 'Big Boomerang',
    description: 'A classic boomerang through the Inner West. Threw it from Newtown, it came back via Glebe.',
    tags: ['boomerang', 'newtown', 'glebe', 'inner-west'],
    distance_km: 11.4,
    status: 'approved',
    created_at: '2026-01-18T07:30:00Z',
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        // Boomerang shape through Inner West (-33.895, 151.17)
        coordinates: [
          [151.158, -33.883],
          [151.163, -33.882],
          [151.168, -33.880],
          [151.174, -33.879],
          [151.180, -33.879],
          [151.185, -33.881],
          [151.189, -33.884],
          [151.191, -33.888],
          // Tip of boomerang
          [151.189, -33.892],
          [151.185, -33.894],
          // Curve back
          [151.180, -33.893],
          [151.175, -33.891],
          [151.170, -33.890],
          [151.165, -33.891],
          [151.161, -33.893],
          [151.158, -33.896],
          [151.156, -33.900],
          // Second tip
          [151.155, -33.904],
          [151.157, -33.907],
          [151.160, -33.905],
        ],
      },
    },
  },
  {
    id: 'route-003',
    title: 'Harbour Star',
    description: 'Five-pointed star centred on the CBD. One point hits the Opera House, another Barangaroo.',
    tags: ['star', 'cbd', 'harbour', 'opera-house'],
    distance_km: 16.8,
    status: 'approved',
    created_at: '2026-02-02T06:45:00Z',
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        // 5-pointed star centred on Sydney CBD (-33.868, 151.209)
        coordinates: [
          [151.209, -33.845],  // top point (toward North Sydney)
          [151.220, -33.868],  // inner right-top
          [151.232, -33.866],  // right point (toward Woollahra)
          [151.222, -33.878],  // inner right-bottom
          [151.228, -33.893],  // bottom-right point (toward Moore Park)
          [151.209, -33.885],  // inner bottom
          [151.190, -33.893],  // bottom-left point (toward Glebe)
          [151.196, -33.878],  // inner left-bottom
          [151.186, -33.866],  // left point (toward Balmain)
          [151.198, -33.868],  // inner left-top
          [151.209, -33.845],  // back to top
        ],
      },
    },
  },
  {
    id: 'route-004',
    title: 'Opera House Outline',
    description: 'Traced the sail shells of the Opera House on foot through The Rocks and Circular Quay.',
    tags: ['opera-house', 'circular-quay', 'the-rocks', 'iconic'],
    distance_km: 7.3,
    status: 'approved',
    created_at: '2026-02-14T09:00:00Z',
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        // Opera House sail shapes around Circular Quay (-33.857, 151.215)
        coordinates: [
          // Base
          [151.210, -33.858],
          [151.213, -33.858],
          [151.216, -33.858],
          [151.219, -33.858],
          // First sail
          [151.213, -33.858],
          [151.212, -33.855],
          [151.213, -33.853],
          [151.215, -33.851],
          [151.217, -33.853],
          [151.217, -33.856],
          [151.216, -33.858],
          // Second sail (taller)
          [151.215, -33.858],
          [151.215, -33.854],
          [151.215, -33.851],
          [151.214, -33.849],
          [151.213, -33.847],
          [151.212, -33.849],
          [151.212, -33.852],
          [151.213, -33.855],
          [151.213, -33.858],
          // Third sail
          [151.218, -33.858],
          [151.218, -33.855],
          [151.219, -33.853],
          [151.220, -33.851],
          [151.221, -33.853],
          [151.221, -33.856],
          [151.220, -33.858],
        ],
      },
    },
  },
  {
    id: 'route-005',
    title: 'Shark Warning',
    description: 'A giant shark fin through Bondi and Coogee. Stay out of the water.',
    tags: ['shark', 'bondi', 'coogee', 'coastal'],
    distance_km: 13.5,
    status: 'approved',
    created_at: '2026-02-20T06:00:00Z',
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        // Shark shape along Eastern Beaches (-33.895, 151.27)
        coordinates: [
          // Tail
          [151.253, -33.910],
          [151.256, -33.907],
          [151.258, -33.905],
          // Body base
          [151.262, -33.903],
          [151.267, -33.901],
          [151.272, -33.900],
          [151.277, -33.900],
          // Dorsal fin (peak)
          [151.275, -33.895],
          [151.273, -33.890],
          [151.271, -33.886],
          [151.269, -33.888],
          // Continue to snout
          [151.278, -33.895],
          [151.281, -33.898],
          [151.283, -33.900],
          // Mouth
          [151.283, -33.903],
          [151.281, -33.904],
          // Jaw
          [151.278, -33.906],
          [151.274, -33.907],
          [151.270, -33.907],
          [151.265, -33.908],
          [151.260, -33.909],
          [151.256, -33.910],
          [151.253, -33.910],
        ],
      },
    },
  },
  {
    id: 'route-006',
    title: 'Southern Cross',
    description: 'Five stars of the Southern Cross mapped across Parramatta. It\'s on the flag, had to do it.',
    tags: ['southern-cross', 'parramatta', 'patriotic'],
    distance_km: 18.2,
    status: 'approved',
    created_at: '2026-03-01T07:00:00Z',
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        // Southern Cross constellation pattern across Parramatta (-33.815, 151.003)
        // Gamma Crucis (top)
        coordinates: [
          [151.003, -33.800],
          [151.005, -33.797],
          [151.007, -33.800],
          [151.005, -33.803],
          [151.003, -33.800],
          // move to Alpha Crucis (bottom)
          [151.003, -33.832],
          [151.005, -33.829],
          [151.007, -33.832],
          [151.005, -33.835],
          [151.003, -33.832],
          // move to Beta Crucis (left)
          [150.988, -33.815],
          [150.990, -33.812],
          [150.992, -33.815],
          [150.990, -33.818],
          [150.988, -33.815],
          // move to Delta Crucis (right)
          [151.018, -33.810],
          [151.020, -33.807],
          [151.022, -33.810],
          [151.020, -33.813],
          [151.018, -33.810],
          // move to Epsilon Crucis (small, inner)
          [151.006, -33.818],
          [151.008, -33.815],
          [151.010, -33.818],
          [151.008, -33.821],
          [151.006, -33.818],
        ],
      },
    },
  },
  {
    id: 'route-007',
    title: 'Smiley at Manly',
    description: 'A big smiley face on the Northern Beaches. Smile, you\'re near the ocean.',
    tags: ['smiley', 'manly', 'northern-beaches'],
    distance_km: 10.6,
    status: 'approved',
    created_at: '2026-03-05T08:30:00Z',
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        // Smiley face centred on Manly (-33.797, 151.285)
        coordinates: [
          // Face circle
          [151.285, -33.782],
          [151.296, -33.784],
          [151.303, -33.790],
          [151.306, -33.797],
          [151.303, -33.804],
          [151.296, -33.810],
          [151.285, -33.812],
          [151.274, -33.810],
          [151.267, -33.804],
          [151.264, -33.797],
          [151.267, -33.790],
          [151.274, -33.784],
          [151.285, -33.782],
          // Left eye
          [151.278, -33.790],
          [151.280, -33.788],
          [151.282, -33.790],
          [151.280, -33.792],
          [151.278, -33.790],
          // Right eye
          [151.291, -33.790],
          [151.293, -33.788],
          [151.295, -33.790],
          [151.293, -33.792],
          [151.291, -33.790],
          // Smile
          [151.276, -33.803],
          [151.280, -33.807],
          [151.285, -33.808],
          [151.290, -33.807],
          [151.294, -33.803],
        ],
      },
    },
  },
]

export default mockRoutes
