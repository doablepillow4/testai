import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketRouter from "./market";
import predictionsRouter from "./predictions";
import simulatorRouter from "./simulator";
import polymarketRouter from "./polymarket";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketRouter);
router.use(predictionsRouter);
router.use(simulatorRouter);
router.use(polymarketRouter);

export default router;
