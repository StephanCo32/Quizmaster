import type { Metadata } from "next";

import { PlayerJoin } from "@/components/player/player-join";

export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
    return <PlayerJoin />;
}