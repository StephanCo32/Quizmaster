import Link from "next/link";

type RoleShellProps = {
    code: string;
    eyebrow: string;
    title: string;
    description: string;
    status: string;
};

export function RoleShell({
    code,
    eyebrow,
    title,
    description,
    status,
}: RoleShellProps) {
    return (
        <main className="role-shell">
            <header className="role-header">
                <Link href="/" className="brand-lockup">
                    <span className="brand-mark" aria-hidden="true">Q</span>
                    <span>Quizmaster</span>
                </Link>
                <span className="view-code">{code}</span>
            </header>
            <section className="role-content">
                <div>
                    <p className="eyebrow">{eyebrow}</p>
                    <h1>{title}</h1>
                    <p className="lede">{description}</p>
                </div>
                <div className="status-panel" aria-label="Application status">
                    <span className="status-dot" aria-hidden="true" />
                    <div>
                        <p>System status</p>
                        <strong>{status}</strong>
                    </div>
                </div>
            </section>
            <footer className="role-footer">
                <span>Realtime party console</span>
                <span>Frankfurt · EU</span>
            </footer>
        </main>
    );
}