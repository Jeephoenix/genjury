import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import faucetRouter from "./faucet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(faucetRouter);

export default router;
