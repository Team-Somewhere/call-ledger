import { Router } from "express";
import { authRouter } from "./auth.routes";
import { archiveRouter } from "./archive.routes";
import { creatorRouter } from "./creator.routes";
import { creatorSourceRouter, meRouter } from "./creator-source.routes";
import { healthRouter } from "./health.routes";
import { monitoringRouter } from "./monitoring.routes";
import { oauthRouter } from "./oauth.routes";
import { postRouter } from "./post.routes";
import { userRouter } from "./user.routes";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/me", meRouter);
apiRouter.use("/creators", creatorRouter);
apiRouter.use("/creator-sources", creatorSourceRouter);
apiRouter.use("/integrations/x", oauthRouter);
apiRouter.use("/monitoring", monitoringRouter);
apiRouter.use("/posts", postRouter);
apiRouter.use("/archive", archiveRouter);
