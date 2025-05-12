[![banner](https://raw.githubusercontent.com/nevermined-io/assets/main/images/logo/banner_logo.png)](https://nevermined.io)

Image & Video Generation Agent (TypeScript)
===========================================

> A TypeScript agent that listens for tasks via the **A2A** (Agent-to-Agent) protocol, automatically generates images and videos from text prompts using advanced AI models. It supports real-time notifications (SSE) and webhooks, and is designed for seamless orchestration in multi-agent workflows.

---

**Description**
---------------

The **Image & Video Generation Agent** is designed to:

1. **Receive** prompts for image or video generation via the A2A protocol.
2. **Generate** images or videos using state-of-the-art AI models, based on the provided prompt and parameters.
3. **Output** the final artifact (image or video URL) and metadata.
4. **Support** real-time updates and notifications via SSE and webhooks.

This agent implements the **A2A** protocol, enabling standard orchestration and communication between Nevermined agents and third-party systems.

---

**Related Projects**
--------------------

This agent is part of an AI-powered multimedia creation ecosystem. See how it interacts with other agents:

1. [Music Video Orchestrator Agent](https://github.com/nevermined-io/music-video-orchestrator)
   * Orchestrates end-to-end workflows: collects prompts, splits tasks, pays agents, merges results.
2. [Script Generator Agent](https://github.com/nevermined-io/movie-script-generator-agent)
   * Generates cinematic scripts, extracts scenes and characters, produces prompts for video.
3. [Song Generator Agent](https://github.com/nevermined-io/song-generation-agent)
   * Produces music using third-party APIs and AI models.

**Workflow example:**

```
[ User Prompt ] --> [Music Orchestrator] --> [Song Generation] --> [Script Generation] --> [Image/Video Generation] --> [Final Compilation]
```

---

**Table of Contents**
---------------------

1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Environment Variables](#environment-variables)
5. [Project Structure](#project-structure)
6. [Architecture & Workflow](#architecture--workflow)
7. [A2A Protocol](#a2a-protocol)
8. [Skills](#skills)
9. [Usage](#usage)
10. [Examples & Scripts](#examples--scripts)
11. [Development & Testing](#development--testing)
12. [License](#license)

---

**Features**
-------------

* **A2A protocol**: Full support for task orchestration, state transitions, SSE notifications, and webhooks.
* **Image and video generation**: Advanced AI models for text-to-image, image-to-image, and text-to-video.
* **Real-time notifications**: SSE and webhook support for task updates.
* **Configurable**: Customize prompts, models, and parameters.
* **Logging and error management**: Detailed logs via a custom `Logger`.
* **Modular and SOLID architecture**: Each class/function has a clear responsibility.

---

**Prerequisites**
-----------------

* **Node.js** (>= 18.0.0 recommended)
* **TypeScript** (^5.7.0 or higher)
* **API keys** for any third-party AI services used (if required)

---

**Installation**
----------------

1. **Clone** the repository:
    ```bash
    git clone https://github.com/nevermined-io/video-generation-agent-a2a.git
    cd video-generation-agent-a2a
    ```
2. **Install** dependencies:
    ```bash
    yarn install
    ```
3. **Configure** the environment:
    ```bash
    cp .env.example .env
    # Edit .env and add your keys
    ```
4. **Build** the project (optional for production):
    ```bash
    yarn build
    ```

---

**Environment Variables**
-------------------------

Rename `.env.example` to `.env` and set the required keys:

```env
# Example
FAL_API_KEY=your_fal_key
PIAPI_KEY=your_piapi_key
DEMO_MODE=true
```

* `FAL_API_KEY`: Access to Fal.ai for image/video generation (if used).
* `PIAPI_KEY`: Access to TTapi for video generation (if used).
* `DEMO_MODE`: Set to `true` to use the demo video client that simulates API responses without making external API calls (default: `false`).

---

**Project Structure**
---------------------

```plaintext
video-generation-agent-a2a/
├── src/
│   ├── server.ts                # Main entry point (Express)
│   │   └── a2aRoutes.ts         # RESTful and A2A routes
│   ├── controllers/
│   │   ├── a2aController.ts     # Main A2A protocol logic
│   │   ├── imageController.ts   # Image generation logic
│   │   └── videoController.ts   # Video generation logic
│   ├── core/
│   │   ├── taskProcessor.ts     # Task processing
│   │   ├── taskStore.ts         # Task storage and lifecycle
│   │   └── ...
│   ├── services/
│   │   ├── pushNotificationService.ts # SSE and webhook notifications
│   │   └── streamingService.ts  # Real-time SSE streaming
│   ├── clients/                 # API clients for third-party services
│   ├── interfaces/              # Types and A2A contracts
│   ├── models/                  # Data models (Task, Artifact)
│   ├── utils/                   # Utilities and logger
│   └── config/                  # Configuration and environment variables
├── scripts/
│   ├── generate-image.ts
│   ├── generate-image-with-notifications.ts
│   ├── generate-image-with-webhook.ts
│   ├── generate-video.ts
│   ├── generate-video-with-notifications.ts
│   └── generate-video-with-webhook.ts
├── package.json
└── README.md
```

---

**Architecture & Workflow**
---------------------------

1. **Task reception**: The agent exposes RESTful and A2A endpoints (`/tasks/send`, `/tasks/sendSubscribe`) to receive prompts and parameters.
2. **Image/video generation**: The agent processes the task and invokes the appropriate AI model or API.
3. **Notifications**: The agent emits status updates and results via SSE (`/tasks/:taskId/notifications`) or webhooks.
4. **Result delivery**: The user receives the artifact URL and metadata as A2A artifacts.

**Simplified flow diagram:**

```
Client         Agent           AI Model/API
  |             |               |
  |--Task------>|               |
  |             |--Generate---->|
  |             |  image/video  |
  |             |<--------------|
  |<------------|   SSE/Webhook |
  |<------------|   Final result|
```

---

**A2A Protocol**
----------------

The agent implements the **A2A** (Agent-to-Agent) protocol, which defines:

- **Task states**: `submitted`, `working`, `input-required`, `completed`, `failed`, `cancelled`.
- **Messages**: Standard structure with `role`, `parts` (text, image, video, file, etc.).
- **Artifacts**: Structured responses with parts (image, video, text, metadata).
- **Notifications**: Real-time updates via SSE or webhooks.

**A2A request example (JSON-RPC):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks/sendSubscribe",
  "params": {
    "id": "unique-task-id",
    "sessionId": "user-session-123",
    "acceptedOutputModes": ["image/png"],
    "message": {
      "role": "user",
      "parts": [
        { "type": "text", "text": "Generate a futuristic cityscape at night" }
      ]
    },
    "taskType": "text2image"
  }
}
```

> **Nota:** Los endpoints `/tasks/send` y `/tasks/sendSubscribe` requieren que todas las peticiones sean en formato JSON-RPC 2.0. El cuerpo debe incluir los campos `jsonrpc`, `id`, `method` y `params` siguiendo el estándar A2A.

**Streaming SSE response example:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "unique-task-id",
    "status": {
      "state": "working",
      "timestamp": "2024-06-01T12:00:00Z",
      "message": {
        "role": "agent",
        "parts": [
          { "type": "text", "text": "Generating image..." }
        ]
      }
    },
    "final": false
  }
}
```

**Final artifact:**

```json
{
  "parts": [
    { "type": "image", "url": "https://.../image.png" }
  ],
  "metadata": {
    "prompt": "Generate a futuristic cityscape at night"
  },
  "index": 0
}
```

---

**Skills**
----------

> **Important:**
> The `taskType` parameter is **mandatory** and determines the type of operation the agent will perform. Always specify `taskType` in your request. If omitted or incorrect, the agent will not know which skill to execute and will return an error.

The agent exposes the following skills via the A2A protocol:

### 1. Image Generation (`image-generation`)

- **Description**: Generates an image from a text prompt.
- **Input Modes**: `text/plain`, `application/json`
- **Output Modes**: `image/png`, `application/json`
- **Parameters**:
  - `taskType` (string, required): Type of image generation task. Must be `"text2image"`.
  - `prompt` (string, required): Text prompt for image generation.

**Example: text2image**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks/send",
  "params": {
    "id": "task-123",
    "sessionId": "session-abc",
    "message": {
      "role": "user",
      "parts": [
        { "type": "text", "text": "A surreal landscape with floating islands" }
      ]
    },
    "taskType": "text2image"
  }
}
```

### 2. Video Generation (`video-generation`)

- **Description**: Generates a video from a text prompt and one or more reference images.
- **Input Modes**: `text/plain`, `application/json`
- **Output Modes**: `video/mp4`, `application/json`
- **Parameters**:
  - `taskType` (string, required): Type of video generation task. Must be `"text2video"`.
  - `prompt` (string, required): Text prompt for video generation.
  - `imageUrls` (string[], required): List of reference image URLs.
  - `duration` (number, optional): Video duration in seconds (5 or 10).

**Example: text2video**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tasks/send",
  "params": {
    "id": "task-456",
    "sessionId": "session-def",
    "message": {
      "role": "user",
      "parts": [
        { "type": "text", "text": "A time-lapse of a flower blooming" }
      ]
    },
    "taskType": "text2video",
    "imageUrls": [
      "https://example.com/flower1.png",
      "https://example.com/flower2.png"
    ],
    "duration": 10
  }
}
```

---

**Usage**
---------

1. **Configure** `.env` with your keys.
2. **Start** the agent in development mode:
    ```bash
    yarn dev
    ```
   The agent will wait for A2A or REST tasks.
3. **Send a prompt** using a compatible client (see examples below).

---

**Examples & Scripts**
----------------------

The repository includes example scripts to interact with the agent:

### 1. Classic polling (`scripts/generate-image.ts`, `scripts/generate-video.ts`)

Lanza una tarea y consulta periódicamente su estado hasta la finalización. Usa el formato JSON-RPC 2.0 para enviar la tarea:

```bash
yarn ts-node scripts/generate-image.ts
yarn ts-node scripts/generate-video.ts
```

### 2. SSE notifications (`scripts/generate-image-with-notifications.ts`, `scripts/generate-video-with-notifications.ts`)

Lanza una tarea y se suscribe a eventos SSE para recibir actualizaciones en tiempo real. Usa el formato JSON-RPC 2.0:

```bash
yarn ts-node scripts/generate-image-with-notifications.ts "A futuristic cityscape"
yarn ts-node scripts/generate-video-with-notifications.ts "A time-lapse of a flower blooming"
```

### 3. Webhooks (`scripts/generate-image-with-webhook.ts`, `scripts/generate-video-with-webhook.ts`)

Lanza una tarea y registra un webhook local para recibir notificaciones push. Usa el formato JSON-RPC 2.0:

```bash
yarn ts-node scripts/generate-image-with-webhook.ts "A surreal landscape"
yarn ts-node scripts/generate-video-with-webhook.ts "A time-lapse of a flower blooming"
```

---

**Development & Testing**
-------------------------

### Local execution

```bash
yarn dev
```

### Build for production

```bash
yarn build
```

### Testing

```bash
yarn test
```

---

**License**
------------

```
Apache License 2.0

(C) 2025 Nevermined AG

Licensed under the Apache License, Version 2.0 (the "License"); 
you may not use this file except in compliance with the License.
You may obtain a copy of the License at:

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software 
distributed under the License is distributed on an "AS IS" BASIS, 
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
See the License for the specific language governing permissions 
and limitations under the License.
```