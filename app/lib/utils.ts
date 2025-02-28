import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

type Coords = {
	lat: number;
	lon: number;
};

export const regions = {
	"aws-us-east-1": {
		name: "US East (N. Virginia)",
		coords: { lat: 38.0336, lon: -78.508 },
	},
	"aws-us-east-2": {
		name: "US East (Ohio)",
		coords: { lat: 39.9612, lon: -82.9988 },
	},
	"aws-us-west-2": {
		name: "US West (Oregon)",
		coords: { lat: 45.5235, lon: -122.6762 },
	},
	"aws-eu-central-1": {
		name: "Europe (Frankfurt)",
		coords: { lat: 50.1109, lon: 8.6821 },
	},
	"aws-ap-southeast-1": {
		name: "Asia Pacific (Singapore)",
		coords: { lat: 1.3521, lon: 103.8198 },
	},
	"aws-ap-southeast-2": {
		name: "Asia Pacific (Sydney)",
		coords: { lat: -33.8688, lon: 151.2093 },
	},
	"azure-eastus2": {
		name: "Azure US East 2",
		coords: { lat: 39.9612, lon: -82.9988 },
	},
} as const;

type RegionID = keyof typeof regions;

const toRad = (value: number): number => (value * Math.PI) / 180;

const getDistance = (
	{ lat: lat1, lon: lon1 }: Coords,
	{ lat: lat2, lon: lon2 }: Coords,
): number => {
	const R = 6371; // Radius of the Earth in km
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) *
			Math.cos(toRad(lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c; // Distance in km
};

export const findClosestRegion = (headers: Headers): RegionID => {
	let closestRegionId: RegionID = "aws-us-east-1";
	let minDistance = Number.POSITIVE_INFINITY;

	// Default to Paris
	const lon = Number(headers.get("cf-iplongitude")) || 2.4075;
	const lat = Number(headers.get("cf-iplatitude")) || 48.8323;

	for (const [key, region] of Object.entries(regions)) {
		const distance = getDistance({ lat, lon }, region.coords);
		if (distance < minDistance) {
			minDistance = distance;
			closestRegionId = key as RegionID;
		}
	}

	return closestRegionId;
};
