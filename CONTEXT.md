# Quizmaster

Quizmaster runs synchronous, in-room party games through distinct host, player, and public-overview browser views. A game session contains a lobby and one or more configured game rounds.

## People and Places

**Host**:
An authenticated organizer who creates and controls a game session.
_Avoid_: Admin, game master

**Player**:
An anonymous participant in a game session, identified by a browser-held identity and a lobby-scoped nickname and color. Nicknames are case-insensitively unique and may change only in Lobby; a random color is assigned on first join and retained through every Rejoin.
_Avoid_: User, guest

**Lobby**:
The pre-game state of a game session where players join and can return using their browser identity.
_Avoid_: Room, waiting room

**Game session**:
An in-room event controlled by one Host, with a shared public overview and a set of Players.
_Avoid_: Game, room

**Game session state**:
The named lifecycle phase of a Game session: Setup, Lobby, Live, or Finished. A Host moves the session forward; Live may be paused and resumed without changing its state.
_Avoid_: Mode, phase

**Pause**:
A temporary condition within a Live Game session that locks player input and freezes an Active Game round's timer until the Host resumes it.
_Avoid_: Stop, cancellation

**Rejoin**:
The return of an existing Player to a Game session using their original browser-held identity. A Player may rejoin after the Lobby closes, but a new Player may join only while the session is in Lobby.
_Avoid_: Late join, reconnect

## Gameplay

**Game round**:
A configured, playable instance of one game type within a game session.
_Avoid_: Game, match

**Game round state**:
The named lifecycle phase of a Game round: Pending, Active, Resolving, or Complete. Resolving locks player input while the round's outcome is determined, and Complete rounds are immutable.
_Avoid_: Mode, phase

**Game type**:
A reusable set of rules and views used to configure and play game rounds.
_Avoid_: Game mode, mini-game

**Public overview**:
A shared display that shows the current game session state to people in the room.
_Avoid_: Overview, projector view

**Display session**:
A time-limited, read-only authorization to view one Game session through its Public overview. It is not a Host or Player identity.
_Avoid_: Display account, viewer account

**Scoreboard**:
The visible ranking of Players in a game session according to recorded score adjustments.
_Avoid_: Leaderboard

**Score adjustment**:
An auditable change to a Player's score, recorded by a Game round resolution or an explicit Host correction after the Game session is Finished. A Host correction records its author, time, and signed point delta; it needs no reason.
_Avoid_: Score edit, point update