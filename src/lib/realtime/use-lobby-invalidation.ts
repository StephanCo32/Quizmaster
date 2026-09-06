"use client";

import { useLobbySynchronization } from "./use-lobby-synchronization";

export function useLobbyInvalidation(options: { gameSessionId: string; revision: number; refetch: () => Promise<void> }) {
    useLobbySynchronization(options);
}