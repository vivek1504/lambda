import PQueue from "p-queue";

export type JobStatus =
  | { state: "pending" }
  | { state: "running" }
  | { state: "done"; functionId: string; url: string }
  | { state: "error"; message: string };

export const jobs = new Map<string, JobStatus>();
export const deployQueue = new PQueue({ concurrency: 3 });
