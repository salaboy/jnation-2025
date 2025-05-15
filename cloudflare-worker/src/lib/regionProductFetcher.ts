import { geese } from "../db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export interface Goose {
  id: number;
  region: string;
  name: string;
  info: string;
  base_price: number;
}

export async function getProductByRegion(region: string, d1Db: D1Database): Promise<Goose | null> {
   const db = drizzle(d1Db);
   const goose = await db.select().from(geese).where(eq(geese.region, region));
   return goose[0] || null;
}
