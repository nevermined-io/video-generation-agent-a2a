import dotenv from "dotenv";

dotenv.config();

export const NVM_API_KEY = process.env.NVM_API_KEY!;
export const NVM_ENVIRONMENT = process.env.NVM_ENVIRONMENT || "testing";
export const AGENT_DID = process.env.AGENT_DID!;
export const SUNO_API_KEY = process.env.SUNO_API_KEY!;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
export const IS_DUMMY = process.env.IS_DUMMY === "true";
export const DUMMY_JOB_ID = process.env.DUMMY_JOB_ID!;
