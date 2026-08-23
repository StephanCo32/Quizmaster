export default function HostLoading() {
    return (
        <main className="broadcast-shell state-screen" aria-busy="true">
            <div className="state-block">
                <span className="broadcast-kicker">Host channel</span>
                <h1>Loading control room...</h1>
                <div className="loading-bars" aria-hidden="true"><span /><span /><span /></div>
            </div>
        </main>
    );
}