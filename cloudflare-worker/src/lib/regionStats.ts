export interface RegionStats {
  totalVisitors: number;
  uniqueVisitorsToday: number;
  currentlyActive: number;
  mostActiveRegion: string;
  mostActiveRegionVisitors: number;
}

export interface RegionCounts {
  [key: string]: number;
}

export function getMostActiveRegionInfo(regionCounts: RegionCounts): { region: string; visitors: number } {
  if (Object.keys(regionCounts).length === 0) {
    return { region: 'None', visitors: 0 };
  }

  const sortedRegions = Object.entries(regionCounts)
    .sort(([, a], [, b]) => b - a);
  
  if (sortedRegions.length > 0) {
    const [region, visitors] = sortedRegions[0];
    return { region, visitors };
  }
  
  return { region: 'None', visitors: 0 };
}

export async function updateRegionStats(
  region: string,
  visitorKV: KVNamespace,
  activeUsers: number,
  uniqueVisitors: Set<string>
): Promise<RegionStats> {
  const today = new Date().toISOString().split('T')[0];
  const regionKey = `region_${today}`;
  
  // Get and update region counts
  const regionCounts = JSON.parse(await visitorKV.get(regionKey) || '{}') as RegionCounts;
  if (region !== 'unknown') {
    regionCounts[region] = (regionCounts[region] || 0) + 1;
    await visitorKV.put(regionKey, JSON.stringify(regionCounts), { expirationTtl: 86400 });
  }

  // Get total visitors
  const totalVisitors = parseInt(await visitorKV.get('total') || '0');

  const { region: mostActiveRegion, visitors: mostActiveRegionVisitors } = getMostActiveRegionInfo(regionCounts);

  return {
    totalVisitors,
    uniqueVisitorsToday: uniqueVisitors.size,
    currentlyActive: activeUsers,
    mostActiveRegion,
    mostActiveRegionVisitors
  };
}
