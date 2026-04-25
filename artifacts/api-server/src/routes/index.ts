import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import uploadRouter from "./upload.js";

const router: IRouter = Router();

router.use(healthRouter);

export default router;

export { uploadRouter };
