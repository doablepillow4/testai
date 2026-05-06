import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketRouter from "./market";
import predictionsRouter from "./predictions";
import simulatorRouter from "./simulator";
import polymarketRouter from "./polymarket";
import latticeRouter from "./lattice";
import newsRouter from "./news";
import geoImpactRouter from "./geo-impact";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketRouter);
router.use(predictionsRouter);
router.use(simulatorRouter);
router.use(polymarketRouter);
router.use(latticeRouter);
router.use(newsRouter);
router.use(geoImpactRouter);

export default router;
