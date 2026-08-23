export const lobbyInvalidationEvent = "projection-invalidated";

export type LobbyInvalidation = {
    gameSessionId: string;
    revision: number;
};

export function lobbyChannel(gameSessionId: string) {
    return `game-session:${gameSessionId}`;
}