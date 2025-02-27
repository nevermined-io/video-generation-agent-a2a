[![banner](https://raw.githubusercontent.com/nevermined-io/assets/main/images/logo/banner_logo.png)](https://nevermined.io)

Song Generator Agent (TypeScript)
=================================

> A TypeScript agent that listens for tasks via the **Nevermined Payments** framework, automatically generates lyrics and other metadata using **LangChain** + **OpenAI**, and then produces a final song audio track through **Suno**’s AI Music Generation API. It manages multiple steps internally, uses a modular architecture, and can be easily scaled or extended.

* * *

**Description**
---------------

The **Song Generator Agent** is designed to:

1.  **Receive** prompts or “ideas” for songs (e.g., “A futuristic R&B track about neon cities”).
2.  **Optionally** generate missing metadata (e.g., lyrics, title, tags) using **LangChain** and **OpenAI**.
3.  **Invoke** the **Suno** API to synthesize an audio track (MP3) based on the prompt + metadata.
4.  **Output** the final track’s URL, title, duration, and lyrics.
5.  **Integrate** seamlessly with **Nevermined Payments**, listening for “step-updated” events and updating steps as they progress or fail.

This agent is well-suited for multi-step AI workflows where you want to automate music production.

* * *

**Related Projects**
--------------------

This **Video Generator Agent** is part of a larger ecosystem of AI-driven media creation. For a complete view of how multiple agents work together, see:

1.  [Music Orchestrator Agent](https://github.com/nevermined-io/music-video-orchestrator)
    
    *   Coordinates end-to-end workflows: collects user prompts, splits them into tasks, pays agents in multiple tokens, merges final output.
2.  [Image / Video Generator Agent](https://github.com/nevermined-io/video-generator-agent)
    
    *   Produces Images / Video using 3rd party wrapper APIs (Fal.ai and TTapi, wrapping Flux and Kling.ai)
3.  [Script Generator Agent](https://github.com/nevermined-io/music-video-script-generator-agent)
    
    *   Generates cinematic scripts, extracts scene info, identifies settings and characters, producing prompts for video generation.

**Workflow Example**:

```
[ User Prompt ] --> [Music Orchestrator] --> [Song Generation] --> [Script Generation] --> [Image/Video Generation] --> [Final Compilation]
```

* * *

**Table of Contents**
---------------------

*   [Features](#features)
*   [Prerequisites](#prerequisites)
*   [Installation](#installation)
*   [Environment Variables](#environment-variables)
*   [Project Structure](#project-structure)
*   [Architecture & Workflow](#architecture--workflow)
*   [Usage](#usage)
*   [How It Works Internally](#how-it-works-internally)
*   [Development & Testing](#development--testing)
*   [License](#license)

* * *

**Features**
------------

*   **Nevermined Integration**: Subscribes to tasks via `step-updated` events and updates them automatically.
*   **Automatic Metadata Generation**: Uses **LangChain** + **OpenAI** for lyrics, titles, and tag creation.
*   **Suno Music Generation**: Calls Suno’s AI for track synthesis, monitors progress, and retrieves the final MP3.
*   **Concurrent Step Handling**: Splits tasks into multiple steps (e.g., `autoGenerateMetadata`, `buildSong`), each with its own logic.
*   **Configurable**: Customize your prompts, model versions, or usage of OpenAI.
*   **Logging & Error Handling**: Comprehensive logs (info, success, warn, error) via a custom `Logger`.
*   **SOLID, Modular Architecture**: Each function or class has a single responsibility, ensuring maintainability.

* * *

**Prerequisites**
-----------------

*   **Node.js** (>= 18.0.0 recommended)
*   **TypeScript** (project built on ^5.7.0 or later)
*   **Nevermined** credentials (API key, environment settings, and an `AGENT_DID`)
*   **Suno API Key** (for music generation)
*   **OpenAI API Key** (for metadata/lyrics generation via LangChain)

* * *

**Installation**
----------------

1.  **Clone** the repository:
    
    ```bash
    git clone https://github.com/nevermined-io/song-generation-agent.git
    cd song-generation-agent
    ```
    
2.  **Install** dependencies:
    
    ```bash
    yarn install
    ```
    
3.  **Build** the project (optional for production):
    
    ```bash
    yarn build
    ```
    

* * *

**Environment Variables**
-------------------------

Rename `.env.example` to `.env` and set the required variables:

```env
SUNO_API_KEY=your_suno_api_key
OPENAI_API_KEY=your_openai_api_key
NVM_API_KEY=your_nevermined_api_key
NVM_ENVIRONMENT=testing
AGENT_DID=did:nv:xxx-song-agent
IS_DUMMY=false
DUMMY_JOB_ID=foobar
```

*   `SUNO_API_KEY`
*   `OPENAI_API_KEY`
*   `NVM_API_KEY`
*   `NVM_ENVIRONMENT` (e.g., `testing`, `staging`, or `production`)
*   `AGENT_DID` (identifies this Song Generator Agent)
*   `IS_DUMMY` / `DUMMY_JOB_ID` (optional testing flags)

* * *

**Project Structure**
---------------------

```
.
├── clients/
│   └── sunoClient.ts          # Client for interacting with the Suno API
├── config/
│   └── env.ts                 # Loads environment variables from .env
├── interfaces/
│   └── apiResponses.ts        # Type definitions for Suno API responses
├── utils/
│   ├── logger.ts              # Logging utility with color-coded levels
│   ├── utils.ts               # General helpers (e.g., track duration)
│   └── checkEnv.ts            # Validates environment variables on startup
├── songMetadataGenerator.ts   # Class that uses LangChain+OpenAI to generate metadata
├── main.ts                    # Main entry, listens to step-updated events & routes steps
├── package.json
├── tsconfig.json
└── README.md                  # This file
```

Key highlights:

*   **`main.ts`**: Entry point that initializes **Nevermined** payments, subscribes to steps for this agent’s DID, and routes to step handlers (`handleInitStep`, `handleAutoGenerateMetadataStep`, `handleBuildSongStep`).
*   **`songMetadataGenerator.ts`**: Orchestrates **LangChain** + **OpenAI** calls to produce lyrics, a title, and tags.
*   **`clients/sunoClient.ts`**: Talks to the **Suno** API for generating music. It can poll for status, retrieve the final track URL, and handle errors gracefully.

* * *

**Architecture & Workflow**
---------------------------

When the **Song Generator Agent** receives a new **task** (usually labeled `init` for the first step), it checks if the user provided metadata (lyrics, title, tags). If not, the agent creates an intermediate step to **auto-generate metadata** via `SongMetadataGenerator`. Finally, it proceeds to the **buildSong** step, which:

1.  Calls **Suno** to start a music generation job.
2.  Periodically checks the status until it’s either `SUCCESS` or `FAILED`.
3.  Logs and returns the final audio URL, duration, and metadata to **Nevermined**.

### Step-by-Step Flow

1.  **init**
    
    *   Checks for existing metadata in `step.input_artifacts`.
    *   If missing, creates `autoGenerateMetadata` then `buildSong`.
    *   Otherwise, creates `buildSong` directly.
2.  **autoGenerateMetadata**
    
    *   Invokes the `SongMetadataGenerator` to produce a new title, lyrics, and tags.
    *   Stores them in `output_artifacts`.
3.  **buildSong**
    
    *   Uses `SunoClient` to create a music generation job.
    *   Waits for completion (by periodically checking status).
    *   Retrieves the final audio file, calculates duration, and updates `output_artifacts`.

* * *

**Usage**
---------

1.  **Configure** `.env` with the relevant keys.
    
2.  **Start** the agent in development mode:
    
    ```bash
    yarn dev
    ```
    
    The agent will then log into **Nevermined** and wait for any `step-updated` events targeting its `AGENT_DID`.
    
3.  **Send a Prompt**
    
    *   Typically, a higher-level Orchestrator (e.g., the **Music Video Orchestrator**) dispatches tasks that mention this Song Generator’s DID.
    *   Once triggered, the agent spawns steps for metadata creation (if needed) and final audio generation.

* * *

**How It Works Internally**
---------------------------

1.  **Nevermined Subscription**
    
    *   `Payments.getInstance({...})` authenticates with the **Nevermined** server.
    *   `payments.query.subscribe(processSteps(payments), {...})` sets up an event listener.
2.  **Processing Steps**
    
    *   A function `processSteps(...)` receives each `step-updated` event.
    *   It fetches the latest step info with `payments.query.getStep(...)`.
    *   Based on `step.name`, it calls the corresponding handler function.
3.  **Handlers**
    
    *   **`handleInitStep()`**: Checks for existing metadata. If missing, creates two sub-steps: `autoGenerateMetadata`, then `buildSong`. If present, only creates `buildSong`.
    *   **`handleAutoGenerateMetadataStep()`**: Uses **LangChain** + **OpenAI** to produce a JSON object with `title`, `lyrics`, `tags`.
    *   **`handleBuildSongStep()`**: Calls **Suno** using `SunoClient`. Waits until the job is complete, then stores the final track details.
4.  **Logging & Error Handling**
    
    *   Each function logs relevant info or errors with the custom `Logger`.
    *   If any step fails (e.g., Suno returns an error), the handler updates the step to `Failed`.
5.  **Output Artifacts**
    
    *   Agents store data in `output_artifacts` (e.g., an array of objects describing the final song).
    *   This is how other steps or orchestrators retrieve the MP3 URL, duration, or lyrics.

* * *

**Development & Testing**
-------------------------

### Running Locally

*   **Start** the service in dev mode:
    
    ```bash
    yarn dev
    ```
    
*   By default, it subscribes to the `AGENT_DID` in your `.env`.
    

### Building for Production

```bash
yarn build
```

* * *

**License**
-----------

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