import type { Request, Response } from "express";
import { getSystemHealth } from "../services/health.service";

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const health = await getSystemHealth();

  if (health.success) {
    res.status(200).json(health);
  } else {
    res.status(503).json(health);
  }
}
