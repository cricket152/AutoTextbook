import { createDatabaseClient, createSiteContext, requireUser, errorResponse, BackendError } from './_qoder/backend.mjs';
import { createStorageClient } from './_qoder/storage.mjs';
import { createApplication } from './routes.mjs';

const handle = createApplication({
  db: createDatabaseClient(),
  storage: createStorageClient(),
  requireUser,
  BackendError
});

Deno.serve(async request => {
  let context;
  try {
    context = createSiteContext(request);
    return await handle(context);
  } catch (error) {
    return errorResponse(error, context?.requestId);
  }
});
