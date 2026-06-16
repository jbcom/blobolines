import { createWorld } from "koota";

/**
 * The single ECS world instance. Traits and systems register against this.
 * Game entities (blob, trampolines, crystals, particles) live here so render
 * components and sim systems share one source of truth.
 */
export const gameWorld = createWorld();
