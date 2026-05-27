import { Router } from "express";
import crypto from "crypto";
import { upload } from "../deploy/upload.js";
import { jobs, deployQueue } from "../deploy/queue.js";
import { deployFunction } from "../deploy/pipeline.js";

export const deployRouter = Router();

deployRouter.post("/", upload.single("code"), async (req, res) => {
  if (!req.file?.path) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  if (deployQueue.size > 50) {
    return res.status(429).json({ error: "Too many jobs" });
  }

  const jobId = crypto.randomBytes(8).toString("hex");
  jobs.set(jobId, { state: "pending" });

  deployQueue.add(async () => {
    jobs.set(jobId, { state: "running" });
    try {
      const result = await deployFunction(req.file!.path);
      jobs.set(jobId, {
        state: "done",
        functionId: result.functionId,
        url: result.url,
      });
    } catch (err: any) {
      jobs.set(jobId, { state: "error", message: err.message });
    }
  });

  res.status(202).json({
    jobId,
    statusUrl: `http://localhost:3000/deploy/status/${jobId}`,
  });
});

deployRouter.get("/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Unknown job" });
  res.json(job);
});
