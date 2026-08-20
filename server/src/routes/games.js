import { Router } from "express";

export function gamesRouter(controller) {
  const router = Router();
  router.get("/", controller.list);
  router.get("/:id", controller.detail);
  return router;
}
