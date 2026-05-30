import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from "prom-client";

export const register = new Registry();

collectDefaultMetrics({ register });

export const httpRequestDuration = new Histogram({
  name: "http_request_duration",
  help: "Duration of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestsTotal = new Counter({
  name: "total_http_requests",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const deployTotal = new Counter({
  name: "total_deployments",
  help: "Total deployment attempts",
  labelNames: ["status"],
  registers: [register],
});

export const deployStageDuration = new Histogram({
  name: "deploy_stage_duration",
  help: "Duration of each deployment pipeline stage",
  labelNames: ["stage"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const deployQueueDepth = new Gauge({
  name: "deploy_queue_depth",
  help: "Current number of jobs in the deploy queue",
  registers: [register],
});

export const deployQueueWaitTime = new Histogram({
  name: "deploy_queue_wait_time",
  help: "Time a deploy job spends waiting in queue before execution",
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [register],
});

export const vmCount = new Gauge({
  name: "active_vm_count",
  help: "Number of currently active VMs",
  labelNames: ["function_id", "state"],
  registers: [register],
});

export const vmCreationTime = new Histogram({
  name: "vm_creation_time",
  help: "Time to create and restore a VM from snapshot",
  buckets: [0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

export const vmCreationTotal = new Counter({
  name: "total_vm_created",
  help: "Total VMs created",
  labelNames: ["status"],
  registers: [register],
});

export const vmCleanupTotal = new Counter({
  name: "total_vm_cleanups",
  help: "Total VMs cleaned up",
  registers: [register],
});

export const invocationTotal = new Counter({
  name: "total_invocations",
  help: "Total function invocations",
  labelNames: ["function_id", "status"],
  registers: [register],
});

export const invocationTime = new Histogram({
  name: "invocation_time",
  help: "End-to-end function invocation time",
  labelNames: ["function_id"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const invocationQueueDepth = new Gauge({
  name: "invocation_queue_depth",
  help: "Current request queue depth per function",
  labelNames: ["function_id"],
  registers: [register],
});

export const vsockConnectionTime = new Histogram({
  name: "vsock_connection_time",
  help: "Time to establish vsock connection",
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [register],
});

export const vsockErrors = new Counter({
  name: "vsock_errors_total",
  help: "Total vsock connection/read errors",
  labelNames: ["error_type"],
  registers: [register],
});
