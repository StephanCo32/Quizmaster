import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parseEnvironment } from "@/lib/env";

export async function createSupabaseServerClient() {
    const environment = parseEnvironment(process.env);
    const cookieStore = await cookies();

    return createServerClient(
        environment.NEXT_PUBLIC_SUPABASE_URL,
        environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: (cookiesToSet) => {
                    for (const { name, value, options } of cookiesToSet) {
                        cookieStore.set(name, value, options);
                    }
                },
            },
        },
    );
}