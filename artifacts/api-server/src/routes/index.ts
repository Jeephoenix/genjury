import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import faucetRouter from "./faucet";
import profileRouter from "./profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(faucetRouter);
router.use(profileRouter);

export default router;
