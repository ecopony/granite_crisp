#!/usr/bin/env node
/**
 * Generate realistic SF 311 service request data
 *
 * This creates ~5000 points distributed across SF neighborhoods with
 * realistic clustering (more requests in denser/commercial areas).
 */

// SF neighborhood centers with relative weights (higher = more requests)
const NEIGHBORHOODS = [
  { name: "Downtown/Financial", lng: -122.4000, lat: 37.7900, weight: 3.0 },
  { name: "Mission", lng: -122.4180, lat: 37.7600, weight: 2.5 },
  { name: "SOMA", lng: -122.4050, lat: 37.7780, weight: 2.2 },
  { name: "Tenderloin", lng: -122.4130, lat: 37.7840, weight: 2.8 },
  { name: "Castro", lng: -122.4350, lat: 37.7620, weight: 1.5 },
  { name: "Haight", lng: -122.4480, lat: 37.7700, weight: 1.3 },
  { name: "Marina", lng: -122.4360, lat: 37.8020, weight: 1.0 },
  { name: "North Beach", lng: -122.4080, lat: 37.8000, weight: 1.4 },
  { name: "Chinatown", lng: -122.4060, lat: 37.7950, weight: 1.8 },
  { name: "Pacific Heights", lng: -122.4350, lat: 37.7920, weight: 0.7 },
  { name: "Richmond", lng: -122.4800, lat: 37.7800, weight: 1.0 },
  { name: "Sunset", lng: -122.4900, lat: 37.7550, weight: 0.8 },
  { name: "Potrero Hill", lng: -122.4000, lat: 37.7570, weight: 1.2 },
  { name: "Noe Valley", lng: -122.4310, lat: 37.7510, weight: 0.9 },
  { name: "Bayview", lng: -122.3900, lat: 37.7350, weight: 1.5 },
  { name: "Excelsior", lng: -122.4250, lat: 37.7250, weight: 1.1 },
  { name: "Glen Park", lng: -122.4350, lat: 37.7350, weight: 0.8 },
  { name: "Bernal Heights", lng: -122.4150, lat: 37.7400, weight: 1.0 },
  { name: "Outer Mission", lng: -122.4400, lat: 37.7150, weight: 0.9 },
  { name: "Visitacion Valley", lng: -122.4100, lat: 37.7150, weight: 0.8 },
];

// 311 service request categories with relative frequencies
const CATEGORIES = [
  { type: "Street and Sidewalk Cleaning", weight: 3.0 },
  { type: "Graffiti", weight: 2.0 },
  { type: "Abandoned Vehicle", weight: 1.5 },
  { type: "Pothole", weight: 1.2 },
  { type: "Streetlight", weight: 1.0 },
  { type: "Illegal Dumping", weight: 1.8 },
  { type: "Sidewalk Defect", weight: 0.8 },
  { type: "Tree Maintenance", weight: 0.7 },
  { type: "Blocked Driveway", weight: 0.5 },
  { type: "Noise Complaint", weight: 0.6 },
];

// Weighted random selection
function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1];
}

// Generate random point near a center (Gaussian-like distribution)
function randomNearPoint(lng, lat, spreadLng = 0.015, spreadLat = 0.012) {
  // Box-Muller transform for Gaussian distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);

  return {
    lng: lng + z1 * spreadLng,
    lat: lat + z2 * spreadLat,
  };
}

// Generate a random date within the last 30 days
function randomRecentDate() {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 30);
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

// Generate the dataset
function generateData(count = 5000) {
  const requests = [];

  for (let i = 0; i < count; i++) {
    const neighborhood = weightedRandom(NEIGHBORHOODS);
    const category = weightedRandom(CATEGORIES);
    const point = randomNearPoint(neighborhood.lng, neighborhood.lat);

    requests.push({
      id: i + 1,
      position: [
        parseFloat(point.lng.toFixed(6)),
        parseFloat(point.lat.toFixed(6)),
      ],
      category: category.type,
      neighborhood: neighborhood.name,
      created: randomRecentDate(),
    });
  }

  return {
    generated: new Date().toISOString(),
    source: "Simulated SF 311 Service Requests",
    description: "Generated dataset mimicking SF 311 call patterns",
    count: requests.length,
    requests,
  };
}

// Run and output
const data = generateData(5000);
console.log(JSON.stringify(data, null, 2));
