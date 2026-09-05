import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Baseline config: SSR/Server Actions work without R2/D1.
// Add R2 incremental cache + DO queue later for ISR/revalidatePath persistence.
// See https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig();
