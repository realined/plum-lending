// A privacy boundary failure must abort the whole run, never become a partial export.
export class DataBoundaryError extends Error {
  constructor() {
    super("SEED_DATA_BOUNDARY");
    this.name = "DataBoundaryError";
  }
}
