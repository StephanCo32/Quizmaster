import { z } from "zod";

const environmentSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function parseEnvironment(environment: Record<string, unknown>) {
    const result = environmentSchema.safeParse(environment);

    if (!result.success) {
        const invalidVariables = [
            ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
        ];

        throw new Error(`Invalid environment variables: ${invalidVariables.join(", ")}`);
    }

    return result.data;
}