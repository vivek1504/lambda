# Firecracker-Based Serverless Runtime

> An AWS Lambda-like execution platform built on Firecracker microVMs — exploring microVM isolation, snapshot-based cold starts, IPC, and multi-tenant scheduling.

---

## Overview

This project is a high-performance serverless execution platform that runs user-submitted functions inside isolated Firecracker microVMs. It demonstrates how modern serverless platforms like AWS Lambda work under the hood, with a focus on low-latency execution, strong isolation, and high throughput.

---

## Features

### MicroVM-Based Isolation

- Each function runs inside a dedicated **Firecracker microVM**
- Minimal attack surface using a custom kernel and rootfs
- Stronger isolation compared to traditional containers

### Snapshot-Based Cold Start Optimization

Pre-initialized VM state is snapshotted and restored on each invocation, dramatically reducing startup time:

| Boot Method | Latency |
|---|---|
| Cold boot | ~200ms |
| Snapshot restore | ~1–5ms |

### High-Performance IPC

- Host ↔ VM communication via **vsock**
- Internal routing via **Unix domain sockets**
- Eliminated per-request connection overhead for better throughput

### Custom Runtime

- Node.js-based runtime executing user handlers
- Deterministic execution model: 1 request → 1 execution → response
- Handles success, errors, and malformed input

### Control Plane & VM Manager

- Manages function deployment and VM lifecycle (create, snapshot, restore, destroy)
- Routes invocations and enforces execution boundaries and resource limits

### Multi-Tenant Scheduling

- Per-function queues with concurrency control
- Fair scheduling across multiple concurrent workloads

---

## Architecture

```
Client Request (HTTP)
        ↓
Control Plane (Node.js)
        ↓
Scheduler / VM Manager
        ↓
Firecracker MicroVM (snapshot restore)
        ↓
Runtime (Node.js)
        ↓
User Handler Execution
        ↓
Response → Client
```

---

## Execution Flow

1. User deploys function code
2. System builds a minimal rootfs containing the user code
3. Firecracker VM boots and the runtime initializes
4. A snapshot of the initialized VM state is created
5. On each invocation:
   - Pre warm VM is used
   - If no warm VM is present then a VM is restored from the snapshot
   - Request is sent via vsock
   - Runtime executes the handler
   - Response is returned to the client

---

## Usage

### Prerequisites

- Linux host with **KVM support** (`/dev/kvm` must be accessible)
- [Firecracker](https://github.com/firecracker-microvm/firecracker) binary in `PATH`
- **Node.js** v18+ and npm

#### Kernel image and rootfs

Pre-built demo assets are available in the [Beta release](https://github.com/vivek1504/serverless-runtime/releases/tag/Beta):

| Asset | Download |
|---|---|
| Linux kernel image | [`vmlinux`](https://github.com/vivek1504/serverless-runtime/releases/download/Beta/vmlinux) |
| Root filesystem | [`rootfs.ext4.gz`](https://github.com/vivek1504/serverless-runtime/releases/download/Beta/rootfs.ext4.gz) |

Download and place them in the project root:

```bash
wget https://github.com/vivek1504/serverless-runtime/releases/download/Beta/vmlinux
wget https://github.com/vivek1504/serverless-runtime/releases/download/Beta/rootfs.ext4.gz

# Extract the rootfs
gunzip rootfs.ext4.gz
```

### Installation

```bash
git clone https://github.com/vivek1504/serverless-runtime.git
cd serverless-runtime

# directories to store usercode and snapshots
mkdir extracted mem rootfs snapshot userCode 

# log file for firecracker.log
touch firecracker.log

npm install
```

Start the control plane:

```bash
npm start

# listening on http://localhost:3000
```

### Deploying a Function

#### Preparing your code

Your function must export a `handler` using [`serverless-http`](https://github.com/dougmoscrop/serverless-http) — `app.listen` is not supported inside a microVM. Wrap your Express (or any Node.js HTTP framework) app like so:

```js
// app.js
const express = require('express');
const serverless = require('serverless-http');

const app = express();

app.get('/', (req, res) => {
  res.send('Hello from Firecracker!');
});

module.exports.handler = serverless(app);
```

Zip your project with `node_modules` included:

```bash
zip -r function.zip . # node_modules must be inside the zip
```

> **Note:** The runtime has no network access to install packages, so `node_modules` must be bundled inside the zip.

#### Deploying

Send the zip as a multipart form upload to `/deploy`:

```bash
curl -X POST http://localhost:3000/deploy \
  -F "code=@function.zip"
```

Response:

```json
{
  "functionId": "44ca883e56733724",
  "status": "deployed",
  "snapshotReady": true,
  "url": "http://localhost:3000/f/44ca883e56733724"
}
```

### Invoking a Function

Use the `url` returned from the deploy response to invoke your function:

```bash
curl http://localhost:3000/f/44ca883e56733724
```

You can also pass a path or body depending on your handler's routing:

```bash
curl -X POST http://localhost:3000/f/44ca883e56733724/greet \
  -H "Content-Type: application/json" \
  -d '{ "name": "John Doe" }'
```

### Running Benchmarks

With the control plane running and a function deployed, run the autocannon benchmark:

```bash
npx autocannon -c 10 -d 30 -m POST \
  -H "Content-Type: application/json" \
  -b '{ "name": "John Doe" }' \
  http://localhost:3000/f/44ca883e56733724
```

This replicates the benchmark configuration used to produce the performance numbers in this README (10 concurrent connections, 30-second duration).

---

## Performance

Benchmarked using [`autocannon`](https://github.com/mcollina/autocannon) with 10 concurrent connections over 30 seconds:

| Metric | Result |
|---|---|
| Throughput | ~5,400 req/sec |
| p50 latency | ~1ms |
| p99 latency | ~4ms |
| Total requests | ~164,000 |

**Key optimizations:** snapshot reuse, persistent runtime, reduced IPC overhead.

---

## Tech Stack

| Component | Technology |
|---|---|
| MicroVMs | Firecracker |
| Control plane & runtime | Node.js / Express |
| Virtualization | Linux (KVM, namespaces) |
| Host ↔ VM IPC | vsock |
| Intra-VM IPC | Unix domain sockets |
| Benchmarking | autocannon |

---

## Design Tradeoffs

| Aspect | Decision |
|---|---|
| Latency | Warm execution reuse for low latency |
| Isolation | Strong VM isolation; runtime reuse introduces shared state |
| Throughput | Optimized for high throughput over strict per-request isolation |

---

## Future Improvements

- Per-function autoscaling
- Rate limiting and priority scheduling
- Distributed execution across multiple hosts

---

## Why This Project Matters

This project demonstrates:

- Deep understanding of **OS-level virtualization**
- Practical use of **Firecracker and microVMs**
- Handling of **real-world concurrency challenges**
- Thoughtful tradeoffs between **latency, isolation, and throughput**
- System design comparable to **production serverless platforms**

---

## Author

**Vivek Jadhav** — [github.com/vivek1504](https://github.com/vivek1504)
