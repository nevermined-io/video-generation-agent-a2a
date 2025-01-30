[![banner](https://raw.githubusercontent.com/nevermined-io/assets/main/images/logo/banner_logo.png)](https://nevermined.io)

Song Generator Agent (TypeScript)
=========================================================

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript Version](https://img.shields.io/badge/typescript-%5E5.7.0-blue)](https://www.typescriptlang.org/)
[![MIT License](https://img.shields.io/badge/license-MIT-green)](https://opensource.org/licenses/MIT)

A TypeScript implementation for interacting with Suno's AI Music Generation API, following SOLID principles and professional coding standards. Now featuring an intermediate step for automatic lyrics generation using LangChain and OpenAI.

## Features ✨

- **Full TypeScript Support** with strict type checking
- **SOLID-Compliant Architecture**
- **Comprehensive Error Handling**
- **Configurable Generation Parameters**
- **Real-Time Progress Monitoring**
- **JSDoc Documentation**
- **Environment-Based Configuration**
- **Automatic Lyrics Generation** using LangChain and OpenAI
- **Integration with Nevermined Payments** for task and step management
- **Modular Architecture** for maintainability and scalability

## Installation ⚙️

```bash
git clone https://github.com/nevermined-io/song-generation-agent.git
cd song-generation-agent
yarn install
```

## Configuration ⚙️

1. **Create the `.env` file:**

    ```bash
    cp .env.example .env
    ```

2. **Add your API keys and configurations:**

    ```env
    SUNO_API_KEY=your_suno_api_key
    OPENAI_API_KEY=your_openai_api_key
    NVM_API_KEY=your_nevermined_api_key
    NVM_ENVIRONMENT=testing # or production
    AGENT_DID=your_agent_did
    ```

## Usage 🚀

### Running the Agent

The Song Generator Agent operates as a background service that listens for tasks via the Nevermined API. It processes each task by dividing it into manageable steps, handling metadata generation, and interacting with the Suno API to generate music.

To start the agent:

```bash
yarn dev
```

**Note:** Ensure that your `.env` file is properly configured with all necessary API keys and environment variables before running the agent.

## Architecture 🏗️

```
├── .vscode/
│   └── launch.json               # VS Code debug configuration
├── src/
│   ├── clients/
│   │   └── sunoClient.ts         # Suno API client implementation
│   ├── config/
│   │   └── env.ts                # Environment variable configuration
│   ├── interfaces/
│   │   └── apiResponses.ts       # Type definitions for API responses
│   ├── utils/
│   │   ├── logger.ts             # Custom logging utility
│   │   ├── utils.ts              # General utility functions
│   │   └── checkEnv.ts           # Environment validation logic
│   ├── songMetadataGenerator.ts  # Lyrics and metadata generator using LangChain
│   └── main.ts                   # Main application entry point
├── .env.example                  # Environment variable template
├── .gitignore                    # Git exclusion rules
├── package.json                  # Project dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # Project documentation
```

## How It Works 🧠

The **Song Generator Agent** utilizes the **Nevermined Payments** library to receive tasks, divide them into steps, and manage them sequentially. Here's a detailed breakdown of the workflow:

1. **Task Reception:**
   - The agent subscribes to `step-updated` events from Nevermined.
   - Upon receiving a task (`init`), the agent checks if the necessary metadata (lyrics, title, tags) is already present.

2. **Step Management:**
   - **Step 1: `init`**
     - Verifies the presence of metadata.
     - If metadata is missing, it creates two new steps:
       - `autoGenerateMetadata`: Generates metadata using LangChain and OpenAI.
       - `buildSong`: Generates the song using the generated metadata.
     - If metadata is present, it directly creates the `buildSong` step.

   - **Step 2: `autoGenerateMetadata`**
     - Utilizes `SongMetadataGenerator` to generate `title`, `lyrics`, and `tags` based on a provided idea or prompt.
     - Stores the generated metadata in `output_artifacts`.
     - Marks the step as completed.

   - **Step 3: `buildSong`**
     - Uses `SunoClient` to send a request to Suno's API with the metadata.
     - Monitors the generation progress through `waitForCompletion`.
     - Stores the generated song's URL and duration in `output_artifacts`.
     - Marks the step as completed.

3. **Step Updates:**
   - Each time a step is completed or fails, the agent updates the step's status in Nevermined using `payments.query.updateStep`.
   - In case of errors, the agent marks the step as `Failed` with a descriptive message.

## Documentation 📚

### SunoClient Class

#### Methods:
- `generateSong(prompt: string, options?: SongOptions): Promise<string>`
- `checkStatus(jobId: string): Promise<StatusResponse>`
- `getSong(jobId: string): Promise<SongResponse>`
- `waitForCompletion(jobId: string, interval?: number): Promise<void>`

### SongMetadataGenerator Class

#### Methods:
- `generateMetadata(idea: string): Promise<SongMetadata>`

#### Interfaces:
- `SongMetadata`
  - `title: string`
  - `lyrics: string`
  - `tags: string[]`

### Response Interfaces
- `GenerateSongResponse`
- `StatusResponse` 
- `SongResponse`
- `MusicTrack`
- `SongOptions`

## Development 🛠️

Start the development server:
```bash
yarn dev
```

Build the production version:
```bash
yarn build
```

## Testing ✅

Run unit tests:
```bash
yarn test
```

## Contributing 🤝

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

---

## Additional Details on Implementation

### Integration with Nevermined Payments

The **Song Generator Agent** leverages the **Nevermined Payments** library to handle task reception and step management. Here's how the integration works:

1. **Agent Initialization:**
   - An instance of `Payments` is created using the provided credentials (`NVM_API_KEY` and `NVM_ENVIRONMENT`).
   - The agent subscribes to `step-updated` events to receive notifications about new tasks or updates to existing steps.

2. **Processing Steps:**
   - Upon receiving a `step-updated` event, the agent retrieves the step details using `payments.query.getStep`.
   - Depending on the step's name (`init`, `autoGenerateMetadata`, `buildSong`), the agent invokes the corresponding handler function.
   - Each handler performs its specific task and updates the step's status using `payments.query.updateStep`.

3. **Creating Steps:**
   - The `handleInitStep` function determines whether metadata generation is required.
   - If metadata is missing, it creates the `autoGenerateMetadata` and `buildSong` steps using `payments.query.createSteps`.
   - If metadata is present, it directly creates the `buildSong` step.

4. **Error Handling:**
   - If any step fails, the agent marks the step as `Failed` with a descriptive reason using `payments.query.updateStep`.

### Workflow Diagram

```
+-----------------------+
|  Nevermined Payments  |
+----------+------------+
           |
           v
+-----------------------+
|  Song Generator Agent |
+----------+------------+
           |
           | (Step: init)
           |
           v
+-----------------------+
|    Handle Init Step   |
+----------+------------+
           |
           |-- If no metadata -->
           |       |
           |       v
           | +------------------------+
           | | Handle AutoGenerate    |
           | |     Metadata Step      |
           | +-----------+------------+
           |             |
           |             v
           | +------------------------+
           | |  Handle Build Song     |
           | +-----------+------------+
           |
           |-- If metadata -->
                   |
                   v
         +------------------------+
         |   Handle Build Song    |
         +------------------------+
```

### Dependencies and Additional Configuration

- **LangChain and OpenAI:**
  - Ensure you have the correct OpenAI API keys in your `.env` file.
  - LangChain is used for generating lyrics via the `SongMetadataGenerator`.

- **Music-Metadata:**
  - Utilized to extract the duration of generated tracks.

- **Nevermined Payments:**
  - Configured with `NVM_API_KEY`, `NVM_ENVIRONMENT`, and `AGENT_DID` for authentication and task management.

## Support Files

### `.env.example`

```env
SUNO_API_KEY=
OPENAI_API_KEY=
NVM_API_KEY=
NVM_ENVIRONMENT=testing
AGENT_DID=
```

### `.gitignore`

```
# Dependencies
node_modules/

# Build artifacts
dist/

# Environment
.env

# IDE
.vscode/
.idea/

# OS
.DS_Store
```

---

## Final Considerations

1. **Accessing Private Functions for Testing:**
   - For testing purposes, you're accessing private functions via casting to `any`. While acceptable in this context, consider restructuring your code to facilitate testing without exposing private functions.

2. **TypeScript and Jest Configuration:**
   - Ensure your TypeScript (`tsconfig.json`) and Jest (`jest.config.ts`) configurations are properly set up to handle ESM and CommonJS interoperability.

3. **Error Handling and Logging:**
   - Utilize the `Logger` class to maintain consistent logging and facilitate debugging.

4. **Extensibility and Maintainability:**
   - The modular architecture allows for easy addition of new functionalities, such as additional steps or integrations with other APIs.

5. **Security:**
   - Keep your API keys secure and avoid exposing them in the repository.

---


License
-------

```
Copyright 2025 Nevermined AG

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```