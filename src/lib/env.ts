import { z } from "zod";

const environmentSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    CONTENT_ADMIN_EMAILS: z.string().optional(),
    CONTENT_ADMIN_SECRET: z.string().min(1).optional(),
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

export function contentAdminEmails(environment: Record<string, unknown> = process.env) {
    return (environmentSchema.parse(environment).CONTENT_ADMIN_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
}

export function contentAdminSecret(environment: Record<string, unknown> = process.env) {
    return environmentSchema.parse(environment).CONTENT_ADMIN_SECRET ?? null;
}