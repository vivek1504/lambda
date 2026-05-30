import { extractZip, prepareRootfs } from "./rootfs.js";
import {
  startFirecrackerProcess,
  configureVM,
  createFcCient,
  waitForVMReady,
  snapshotVM,
  cleanupResources,
} from "./firecracker.js";
import fs from "fs";
import crypto from "crypto";
import { getPaths } from "../utils/path.js";
import { pipelineLogger } from "../utils/logger.js";
import { deployTotal, deployStageDuration } from "../utils/metrics.js";

export async function deployFunction(zipPath: string) {
  const functionId = crypto.randomBytes(8).toString("hex");
  const paths = getPaths(functionId);
  let fc: ReturnType<typeof startFirecrackerProcess> extends Promise<infer T> ? T : never;

  pipelineLogger.info(
    { functionId, zipPath },
    "starting deployment pipeline",
  );

  try {
    const t0 = performance.now();
    await extractZip(zipPath, paths.outputDir);
    const extractDuration = performance.now() - t0;
    deployStageDuration.observe({ stage: "extract" }, extractDuration / 1000);
    pipelineLogger.info(
      { functionId, stage: "extract", durationMs: extractDuration },
      "zip extraction completed",
    );
    await fs.promises.unlink(zipPath);

    const t1 = performance.now();
    const image = await prepareRootfs(functionId);
    const rootfsDuration = performance.now() - t1;
    deployStageDuration.observe({ stage: "rootfs" }, rootfsDuration / 1000);
    pipelineLogger.info(
      { functionId, stage: "rootfs", durationMs: rootfsDuration, image },
      "rootfs preparation completed",
    );

    const t2 = performance.now();
    fc = await startFirecrackerProcess(paths.apiSock);
    const spawnDuration = performance.now() - t2;
    deployStageDuration.observe({ stage: "fc-spawn" }, spawnDuration / 1000);
    pipelineLogger.info(
      { functionId, stage: "fc-spawn", durationMs: spawnDuration },
      "firecracker process spawned",
    );

    const t3 = performance.now();
    const readyPromise = waitForVMReady(fc);
    const client = createFcCient(paths.apiSock);

    const t4 = performance.now();
    await configureVM(client, functionId, image);
    const configureDuration = performance.now() - t4;
    deployStageDuration.observe({ stage: "configure-vm" }, configureDuration / 1000);
    pipelineLogger.info(
      { functionId, stage: "configure-vm", durationMs: configureDuration },
      "VM configured",
    );

    await readyPromise;
    const readyDuration = performance.now() - t3;
    deployStageDuration.observe({ stage: "vm-ready" }, readyDuration / 1000);
    pipelineLogger.info(
      { functionId, stage: "vm-ready", durationMs: readyDuration },
      "VM reported READY",
    );

    const t5 = performance.now();
    await snapshotVM(client, functionId);
    const snapshotDuration = performance.now() - t5;
    deployStageDuration.observe({ stage: "snapshot" }, snapshotDuration / 1000);
    pipelineLogger.info(
      { functionId, stage: "snapshot", durationMs: snapshotDuration },
      "VM snapshot created",
    );

    const totalDuration = performance.now() - t0;
    deployStageDuration.observe({ stage: "complete" }, totalDuration / 1000);
    deployTotal.inc({ status: "success" });

    pipelineLogger.info(
      {
        functionId,
        stage: "complete",
        totalDurationMs: totalDuration,
        stages: {
          extractMs: extractDuration,
          rootfsMs: rootfsDuration,
          spawnMs: spawnDuration,
          configureMs: configureDuration,
          readyMs: readyDuration,
          snapshotMs: snapshotDuration,
        },
      },
      "deployment pipeline completed successfully",
    );

    return {
      functionId,
      url: `http://localhost:3000/f/${functionId}`,
    };
  } catch (err) {
    deployTotal.inc({ status: "error" });

    pipelineLogger.error(
      { functionId, err },
      "deployment pipeline failed",
    );
    throw err;
  } finally {
    try { fc!?.kill("SIGKILL"); } catch { }

    const t6 = performance.now();
    await cleanupResources(paths);
    const cleanupDuration = performance.now() - t6;
    deployStageDuration.observe({ stage: "cleanup" }, cleanupDuration / 1000);
    pipelineLogger.debug(
      { functionId, stage: "cleanup", durationMs: cleanupDuration },
      "post-deploy cleanup completed",
    );
  }
}
