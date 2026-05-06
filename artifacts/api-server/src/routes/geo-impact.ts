import { Router, type IRouter } from "express";
import { classifyThreat } from "../lib/geo-threat-analyzer";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/geo-impact", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;

  const headline = typeof body["headline"] === "string" ? body["headline"].trim() : "";
  if (headline.length < 4) {
    res.status(400).json({ error: "headline must be at least 4 characters" });
    return;
  }

  const description = typeof body["description"] === "string" ? body["description"].slice(0, 1000) : "";
  const isBreaking = body["isBreaking"] === true;

  try {
    const classification = classifyThreat(headline, description, isBreaking);

    logger.debug(
      { type: classification.type, severity: classification.severity, headline: headline.slice(0, 60) },
      "Geo-impact classification",
    );

    res.json(classification);
  } catch (err) {
    logger.error({ err }, "Geo-impact classification failed");
    res.status(500).json({ error: "Classification failed" });
  }
});

export default router;
