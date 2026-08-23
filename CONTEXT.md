# Quizmaster

Quizmaster runs synchronous, in-room party games through distinct host, player, and public-overview browser views. A game session contains a lobby and one or more configured game rounds.

## People and Places

**Host**:
An authenticated organizer who creates and controls a game session.
_Avoid_: Admin, game master

**Player**:
An anonymous participant in a Game session through a Party membership. A Player retains the Party membership's nickname and color in every successor Game session.
_Avoid_: User, guest

**Browser identity**:
An anonymous identity retained by one browser across Parties. It proves control of separate Party memberships for Rejoin but carries no shared nickname, color, score, or profile between them.
_Avoid_: Player account, global Player

**Party**:
A Host-owned group that persists across a sequence of Game sessions. Party memberships, nicknames, colors, and cumulative Party scores persist while each successor Game session resets readiness and session scores.
_Avoid_: Persistent Lobby, room

**Party membership**:
The association between one Browser identity and one Party. It owns the Player's case-insensitively unique nickname, stable assigned color, Party score, and access status; the nickname may change only while the current Game session is in Lobby.
_Avoid_: Player account, Game-session membership

**Party code**:
A short, rotatable public locator for a Party. Knowing it grants no authority by itself; new Party membership is available only while the current Game session is in Lobby and joining is open.
_Avoid_: Access token, Game-session code

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
A revocable, read-only authorization for one shared screen to follow a Party through its current and successor Game sessions. A Party has at most one active Display session, and it is not a Host or Player identity.
_Avoid_: Display account, viewer account

**Scoreboard**:
The visible ranking of Players in a game session according to recorded score adjustments.
_Avoid_: Leaderboard

**Party score**:
A Player's cumulative score across the Game sessions in one Party. It is shown separately from the current Game session's Scoreboard.
_Avoid_: Scoreboard, lifetime score

**Score adjustment**:
An auditable change to a Player's score, recorded by a Game round resolution or an explicit Host correction after the Game session is Finished. A Host correction records its author, time, and signed point delta; it needs no reason and updates the derived Party score.
_Avoid_: Score edit, point update
