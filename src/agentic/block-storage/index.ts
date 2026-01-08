/**
 * Block Storage Module
 *
 * Re-exports para acesso conveniente.
 *
 * @module agentic/block-storage
 */

export * from "./types";
export * from "./factory";
export { JsonBlockStorage } from "./json-backend";
export { QdrantBlockStorage } from "./qdrant-backend";
