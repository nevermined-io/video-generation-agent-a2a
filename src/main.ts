import "dotenv/config";
import {
  Payments,
  EnvironmentName,
  AgentExecutionStatus,
  generateStepId,
} from "@nevermined-io/payments";
import { Logger } from "./utils/logger";
import { SunoClient } from "./clients/sunoClient";
import {
  NVM_API_KEY,
  NVM_ENVIRONMENT,
  AGENT_DID,
  SUNO_API_KEY,
  OPENAI_API_KEY,
  IS_DUMMY,
  DUMMY_JOB_ID,
} from "./config/env";
import { SongMetadataGenerator } from "./songMetadataGenerator";

/* ------------------------------------------------------------------
   STEP HANDLERS
   ------------------------------------------------------------------ */

/**
 * Checks if the current step already has required metadata (lyrics, title, tags).
 * @param step - The step object from the payments API.
 * @returns True if metadata is present, false otherwise.
 */
function hasMetadata(step: any): boolean {
  if (!step.input_artifacts) return false;
  try {
    if (Array.isArray(step.input_artifacts) && step.input_artifacts[0]) {
      return !!(
        step.input_artifacts[0].lyrics &&
        step.input_artifacts[0].title &&
        step.input_artifacts[0].tags
      );
    }
  } catch {
    Logger.error(
      `Could not parse input_artifacts as JSON: ${step.input_artifacts}`
    );
  }
  return false;
}

/**
 * Creates one or two steps after "init", depending on whether metadata is present.
 * If no metadata => steps: [autoGenerateMetadata, buildSong].
 * If metadata => steps: [buildSong].
 *
 * @param step - The "init" step data
 * @param payments - The Payments instance
 */
async function handleInitStep(step: any, payments: Payments): Promise<void> {
  Logger.info(`[init] step_id=${step.step_id} -> Checking for metadata...`);

  const stepsToCreate: any[] = [];
  let previousStepId = step.step_id;

  if (!hasMetadata(step)) {
    Logger.info(
      "No metadata found -> creating 'autoGenerateMetadata' then 'buildSong'..."
    );
    const metadataStepId = generateStepId();

    stepsToCreate.push({
      step_id: metadataStepId,
      task_id: step.task_id,
      predecessor: previousStepId,
      name: "autoGenerateMetadata",
      is_last: false,
    });

    previousStepId = metadataStepId;
  }

  stepsToCreate.push({
    step_id: generateStepId(),
    task_id: step.task_id,
    predecessor: previousStepId,
    name: "buildSong",
    is_last: true,
  });

  const creation = await payments.query.createSteps(step.did, step.task_id, {
    steps: stepsToCreate,
  });
  if (creation.status !== 201) {
    Logger.error(`Failed creating steps: ${JSON.stringify(creation.data)}`);
    await markStepFailed(step, payments, "init -> could not create sub-steps");
    return;
  }

  // Finally, mark init as completed
  await payments.query.updateStep(step.did, {
    ...step,
    step_status: AgentExecutionStatus.Completed,
    output: step.input_query || "A generic acoustic folk song",
    output_artifacts: step.input_artifacts,
  });
}

/**
 * Calls a LangChain-based metadata generator to produce { lyrics, title, tags },
 * and stores them in this step's artifacts. Then creates the "buildSong" step.
 *
 * @param step - The current step data
 * @param payments - The Payments instance
 */
async function handleAutoGenerateMetadataStep(
  step: any,
  payments: Payments
): Promise<void> {
  Logger.info(
    `[autoGenerateMetadata] step_id=${step.step_id} -> Generating metadata...`
  );

  try {
    const generator = new SongMetadataGenerator(OPENAI_API_KEY);
    const idea = step.input_query || "A generic acoustic folk song";
    const { title, lyrics, tags } = await generator.generateMetadata(idea);

    // Store the generated metadata in output_artifacts
    await payments.query.updateStep(step.did, {
      ...step,
      step_status: AgentExecutionStatus.Completed,
      output: "Successfully generated metadata via LangChain",
      output_artifacts: [{ title, lyrics, tags, idea }],
    });
  } catch (error) {
    Logger.error(`autoGenerateMetadata error: ${(error as Error).message}`);
    await markStepFailed(
      step,
      payments,
      `autoGenerateMetadata: ${(error as Error).message}`
    );
  }
}

/**
 * Calls SunoClient to generate the actual audio track from the prompt + metadata,
 * returning in output_artifacts:
 * [{
 *   tags,
 *   lyrics,
 *   title,
 *   duration,
 *   songUrl
 * }]
 *
 * @param step - The current step data
 * @param payments - The Payments instance
 */
async function handleBuildSongStep(
  step: any,
  payments: Payments
): Promise<void> {
  Logger.info(
    `[buildSong] step_id=${step.step_id} -> Generating audio with Suno...`
  );

  try {
    // Parse metadata from input_artifacts if present
    const [{ tags, lyrics, title, idea }] = step.input_artifacts;

    const client = new SunoClient(SUNO_API_KEY);
    let jobId: string;
    if (IS_DUMMY) {
      Logger.warn("Using dummy job ID for testing...");
      jobId = DUMMY_JOB_ID;
    } else {
      jobId = await client.generateSong(idea, { tags, title, lyrics });
    }

    await client.waitForCompletion(jobId);

    const songData = await client.getSong(jobId);
    Logger.info(`Song generated with job id ${jobId}`);

    const finalOutput = [
      {
        tags,
        lyrics,
        title,
        duration: songData.music.duration,
        songUrl: songData.music.audioUrl,
      },
    ];
    Logger.info(`Song URL: ${songData.music.audioUrl}`);

    await payments.query.updateStep(step.did, {
      ...step,
      step_status: AgentExecutionStatus.Completed,
      output: "Song generation completed",
      output_artifacts: finalOutput,
    });
  } catch (error) {
    Logger.error(`buildSong error: ${(error as Error).message}`);
    await markStepFailed(
      step,
      payments,
      `buildSong: ${(error as Error).message}`
    );
  }
}

/**
 * Marks a step as failed with a given error message.
 * @param step - The step to be updated
 * @param payments - The Payments instance
 * @param reason - The error or failure reason
 */
async function markStepFailed(
  step: any,
  payments: Payments,
  reason: string
): Promise<void> {
  await payments.query.updateStep(step.did, {
    ...step,
    step_status: AgentExecutionStatus.Failed,
    output: reason,
  });
}

/* ------------------------------------------------------------------
   MAIN PROCESSSTEPS + SUBSCRIPTION
   ------------------------------------------------------------------ */

/**
 * Routes each step to the appropriate handler function.
 *
 * @param payments - The Payments instance
 * @returns A function to handle "step-updated" events
 */
function processSteps(payments: Payments) {
  return async (data: any) => {
    try {
      const eventData = JSON.parse(data);
      const step = await payments.query.getStep(eventData.step_id);

      if (step.step_status !== AgentExecutionStatus.Pending) {
        Logger.warn(
          `Skipping step ${step.step_id} because status is ${step.step_status}`
        );
        return;
      }

      Logger.info(
        `Song Generator Agent -> Step: "${step.name}", ID=${step.step_id}`
      );

      switch (step.name) {
        case "init":
          await handleInitStep(step, payments);
          break;
        case "autoGenerateMetadata":
          await handleAutoGenerateMetadataStep(step, payments);
          break;
        case "buildSong":
          await handleBuildSongStep(step, payments);
          break;
        default:
          Logger.warn(`Unknown step name: ${step.name}. Marking as failed...`);
          await markStepFailed(step, payments, `Unknown step: ${step.name}`);
      }
    } catch (error) {
      Logger.error(`Error in processSteps: ${(error as Error).message}`);
    }
  };
}

/**
 * Initializes the agent: sets up the Payments instance and subscribes to "step-updated" events.
 */
async function main() {
  try {
    const payments = Payments.getInstance({
      nvmApiKey: NVM_API_KEY,
      environment: NVM_ENVIRONMENT as EnvironmentName,
    });

    if (!payments.isLoggedIn) {
      throw new Error("Failed to authenticate with Nevermined Payments.");
    }

    await payments.query.subscribe(processSteps(payments), {
      joinAccountRoom: false,
      joinAgentRooms: [AGENT_DID],
      subscribeEventTypes: ["step-updated"],
      getPendingEventsOnSubscribe: false,
    });

    if (IS_DUMMY) {
      Logger.warn("Running in dummy mode. No transactions will be made.");
    }

    Logger.success(
      "Song Generator Agent is running and listening for steps..."
    );
  } catch (error) {
    Logger.error(`Initialization error: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
