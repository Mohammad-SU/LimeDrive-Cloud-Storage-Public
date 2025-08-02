# System Architecture

![System Architecture Diagram](docs/images/system_architecture.png)

## Overview

This diagram illustrates the architecture of **LimeDrive**, which is designed to remain performant and cost-efficient even under demanding workloads.

## Core Backend Architecture

At its core is a **Laravel backend**, which provides a REST API for handling:
- Authentication  
- File metadata  
- Logic for generating signed URLs

One of the key architectural decisions was to **minimize the server’s involvement in actual file transfer**. Instead, the client receives signed URLs that allow direct interaction with object storage.

## File Upload Workflow

1. **Client sends metadata to the server**  
   - The server validates input (e.g., file size limits).  
   - It returns a presigned **PUT URL**.

2. **Client uploads directly to Cloudflare R2**  
   - Using the presigned URL, the heavy file payload bypasses the server entirely.  
   - Cloudflare validates the upload on its end.

3. **Client notifies the server post-upload**  
   - This finalizes the DB entry.  
   - The server checks for **incomplete or orphaned uploads**, ensuring consistency and cleanup.

## File Download Workflow

1. **Client requests multiple files**  
   - The server responds with:
     - A ZIP file structure (not the actual ZIP)
     - Signed **GET URLs** for each file

2. **Client-side ZIP assembly**  
   - Web workers **stream each file concurrently** using the signed URLs.  
   - The final ZIP archive is assembled **locally in the browser**.

## Performance & Cost Optimization

- **Cloudflare’s edge cache** acts as a CDN layer, serving frequently requested files and reducing load on the object store.
- A **Cloudflare Worker** acts as a validation layer for GET URLs:
  - Rejects expired or tampered requests  
  - Adds a layer of lightweight security

## Conclusion

The system is designed so the server:
- Handles only sensitive logic and rule enforcement
- **Offloads large data transfers** to independently scalable and cost-effective infrastructure

The result is a **high-performance, secure, and cost-efficient** architecture.
